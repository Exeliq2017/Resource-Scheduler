import { db } from "../db/connection.js";
import { computeAvailability, type AssignmentLite } from "./availability.js";
import { computeWeeklyWorkload } from "./weeklyWorkload.js";
import { getLeavesByDeveloper, isDeveloperOnLeave } from "./leaves.js";
import { getHolidaySet } from "../routes/holidays.js";
import { getAffinityScore } from "./affinity.js";
import { todayDate, toISODate, parseISODate, toDisplayDate, earliestSuggestionDate } from "./dateUtils.js";
import { findEarliestSlot, type BusyRange } from "./slotFinder.js";

type Priority = "High" | "Medium" | "Low";

interface DeveloperRow {
  id: number;
  name: string;
  role: string;
}

interface BacklogTaskRow {
  id: number;
  task_name: string;
  priority: Priority;
  due_date: string | null;
  estimated_days: number | null;
  preferred_developer_id: number | null;
}

export interface SuggestionCandidate {
  developerId: number;
  developerName: string;
  score: number;
  reasons: string[];
  suggestedStart: string;
  suggestedEnd: string;
  suggestedDayPart: "FULL";
  meetsDueDate: boolean;
  /** Due date minus projected finish, in days; negative = will miss it; null when there's no due date. */
  slackDays: number | null;
}

const PRIORITY_WEIGHT: Record<Priority, number> = { High: 1.3, Medium: 1.0, Low: 0.8 };
// Large enough to dominate the priority multiplier and jitter (both single-digit swings) so a
// task's preferred developer wins the top pick in every normal case, while still leaving other
// candidates ranked below (visible via the scoring detail view) if the preference is unworkable.
const PREFERRED_DEVELOPER_BONUS = 50;

function daysBetween(aISO: string, bISO: string): number {
  return Math.round((parseISODate(bISO).getTime() - parseISODate(aISO).getTime()) / 86_400_000);
}

function addDaysISO(iso: string, days: number): string {
  return toISODate(addDaysToDate(parseISODate(iso), days));
}

function addDaysToDate(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * Small deterministic pseudo-random offset from a cheap integer hash of (taskId, developerId).
 * Breaks exact score ties (common when several developers are equally free) so suggestions
 * spread across the team instead of always landing on whoever sorts first alphabetically —
 * without ever overriding a real scoring difference (component scores run 20-30+ points; this
 * caps at ~3).
 */
function tieBreakJitter(taskId: number, developerId: number): number {
  const seed = Math.imul(taskId, 2654435761) ^ Math.imul(developerId, 40503);
  return (Math.abs(seed) % 601) / 100 - 3; // -3.00 .. +3.00
}

/**
 * Scores one developer as a candidate for one backlog task, combining: can they make the
 * due date (and by how much slack), priority, current workload balance, and learned
 * affinity for similar task names. Higher is better; a negative score means the developer
 * cannot make the due date at all with their current load.
 */
function scoreCandidate(
  task: BacklogTaskRow,
  dev: DeveloperRow,
  assignments: AssignmentLite[],
  holidays: Set<string>,
  leaveDates: Set<string>,
  today: Date
): SuggestionCandidate {
  const withLeave = [
    ...assignments,
    ...Array.from(leaveDates).map((d, i) => ({
      id: -1 - i,
      task_name: "On Leave",
      start_date: d,
      end_date: d,
      status: "Ongoing",
    })),
  ];
  const availability = computeAvailability(withLeave, holidays, today);
  const todayISO = toISODate(today);
  const reasons: string[] = [];

  let score = 0;

  const estimatedDays = task.estimated_days ?? 1;
  const busyRanges: BusyRange[] = [
    ...assignments
      .filter((a) => a.status !== "Completed")
      .map((a) => ({ start: a.start_date, end: a.end_date })),
    ...Array.from(leaveDates).map((d) => ({ start: d, end: d })),
  ];
  // Gap-aware: unlike `availability.nextFreeWorkingDay` (which only looks past the *last*
  // committed task), this checks for an earlier open window long enough for this task, so a
  // short task can slot in before later work already on the developer's calendar. Never
  // suggests starting on the current day once it's past the 5 PM cutoff.
  const suggestedStart = findEarliestSlot(busyRanges, estimatedDays, holidays, earliestSuggestionDate());
  const suggestedEnd = addDaysISO(suggestedStart, estimatedDays - 1);
  const daysUntilFree = daysBetween(todayISO, suggestedEnd);
  let meetsDueDate = true;
  let slackDays: number | null = null;
  if (task.due_date) {
    const daysUntilDue = daysBetween(todayISO, task.due_date);
    const slack = daysUntilDue - daysUntilFree;
    slackDays = slack;
    meetsDueDate = slack >= 0;
    if (meetsDueDate) {
      score += Math.max(0, 30 - slack * 2); // tighter-but-feasible fits score higher (more useful pick)
      reasons.push(
        slack === 0
          ? `Finishes exactly by the ${toDisplayDate(task.due_date)} due date (starting ${toDisplayDate(suggestedStart)}, ${estimatedDays}d estimate)`
          : `Free ${toDisplayDate(suggestedStart)}, finishes with ${slack}d of slack before the ${toDisplayDate(task.due_date)} due date`
      );
    } else {
      score -= 40 + Math.abs(slack) * 3;
      reasons.push(`Wouldn't finish until ${toDisplayDate(suggestedEnd)}, ${Math.abs(slack)}d past the due date`);
    }
  } else {
    score += Math.max(0, 20 - daysUntilFree * 2);
    reasons.push(availability.statusLabel);
  }

  const buckets = computeWeeklyWorkload(assignments, 2, holidays, today, leaveDates);
  const totalWorking = buckets.reduce((s, b) => s + b.workingDaysInWeek, 0);
  const totalBusy = buckets.reduce((s, b) => s + b.busyDays, 0);
  const busyRatio = totalWorking > 0 ? totalBusy / totalWorking : 0;
  score += (1 - busyRatio) * 20;
  if (busyRatio < 0.5) reasons.push(`Lightest load — only ${Math.round(busyRatio * 100)}% booked over the next 2 weeks`);

  // Total active task count as a coarser balancing signal — the 2-week day-ratio above reads as
  // 0% for anyone with no imminent dated work even if they're already holding several tasks.
  const activeTaskCount = assignments.filter((a) => a.status !== "Completed").length;
  score -= activeTaskCount * 2;

  const affinity = getAffinityScore(task.task_name, dev.id, today);
  if (affinity > 0) {
    score += Math.min(affinity, 25);
    reasons.push(`Has handled similar tasks before (affinity ${affinity.toFixed(1)})`);
  }

  score *= PRIORITY_WEIGHT[task.priority];
  score += tieBreakJitter(task.id, dev.id);

  if (task.preferred_developer_id === dev.id) {
    score += PREFERRED_DEVELOPER_BONUS;
    reasons.unshift("Preferred developer for this task");
  }

  return {
    developerId: dev.id,
    developerName: dev.name,
    score: Math.round(score * 10) / 10,
    reasons,
    suggestedStart,
    suggestedEnd,
    suggestedDayPart: "FULL",
    meetsDueDate,
    slackDays,
  };
}

function rankCandidates(task: BacklogTaskRow): SuggestionCandidate[] {
  const developers = db
    .prepare("SELECT id, name, role FROM developers WHERE is_active = 1 AND exclude_from_suggestions = 0 ORDER BY name")
    .all() as DeveloperRow[];

  // A task's preferred developer is always scored, even if normally excluded from suggestions
  // (e.g. the Software Lead) or otherwise unlisted — "only they can fix their own bug" overrides
  // the general exclusion.
  if (task.preferred_developer_id && !developers.some((d) => d.id === task.preferred_developer_id)) {
    const preferred = db
      .prepare("SELECT id, name, role FROM developers WHERE id = ? AND is_active = 1")
      .get(task.preferred_developer_id) as DeveloperRow | undefined;
    if (preferred) developers.push(preferred);
  }

  const holidays = getHolidaySet();
  const leavesByDeveloper = getLeavesByDeveloper();
  const today = todayDate();

  return developers
    .map((dev) => {
      const assignments = db
        .prepare(
          "SELECT id, task_name, start_date, end_date, status FROM assignments WHERE developer_id = ? AND start_date IS NOT NULL AND end_date IS NOT NULL"
        )
        .all(dev.id) as AssignmentLite[];
      const leaves = leavesByDeveloper.get(dev.id) ?? [];
      const leaveDates = new Set(leaves.flatMap((l) => expandDateRange(l.start_date, l.end_date)));
      return scoreCandidate(task, dev, assignments, holidays, leaveDates, today);
    })
    .sort((a, b) => b.score - a.score);
}

function expandDateRange(startISO: string, endISO: string): string[] {
  const dates: string[] = [];
  let cursor = parseISODate(startISO);
  const end = parseISODate(endISO);
  while (cursor.getTime() <= end.getTime()) {
    dates.push(toISODate(cursor));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
  }
  return dates;
}

/** Ranked developer suggestions for one backlog task, best first. */
export function suggestAllocation(assignmentId: number): SuggestionCandidate[] {
  const task = db
    .prepare("SELECT id, task_name, priority, due_date, estimated_days, preferred_developer_id FROM assignments WHERE id = ?")
    .get(assignmentId) as BacklogTaskRow | undefined;
  if (!task) return [];
  return rankCandidates(task);
}

/** Top suggestion for every backlog task, keyed by assignment id — used to render chips without N requests. */
export function suggestAllForBacklog(): Record<number, SuggestionCandidate | null> {
  const backlogTasks = db
    .prepare(
      `SELECT id, task_name, priority, due_date, estimated_days, preferred_developer_id FROM assignments
       WHERE developer_id IS NULL OR start_date IS NULL OR end_date IS NULL`
    )
    .all() as BacklogTaskRow[];

  const result: Record<number, SuggestionCandidate | null> = {};
  for (const task of backlogTasks) {
    const ranked = rankCandidates(task);
    result[task.id] = ranked[0] ?? null;
  }
  return result;
}
