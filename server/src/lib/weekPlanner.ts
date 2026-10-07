import { addDays, parseISODate, toISODate, toDisplayDate } from "./dateUtils.js";
import { findEarliestSlot, type BusyRange } from "./slotFinder.js";

type Priority = "High" | "Medium" | "Low";

export interface PlannerDev {
  id: number;
  name: string;
  /** Normally excluded from suggestions (e.g. the Software Lead) — still eligible if a task prefers them. */
  excluded: boolean;
  busy: BusyRange[];
  activeTaskCount: number;
}

export interface PlannerBacklogTask {
  id: number;
  task_name: string;
  priority: Priority;
  due_date: string | null;
  estimated_days: number | null;
  preferred_developer_id: number | null;
  created_at: string;
}

export interface FillProposal {
  assignmentId: number;
  taskName: string;
  priority: Priority;
  dueDate: string | null;
  estimatedDays: number;
  developerId: number;
  developerName: string;
  start: string;
  end: string;
  meetsDueDate: boolean;
  slackDays: number | null;
  reasons: string[];
}

export interface UnplacedTask {
  assignmentId: number;
  taskName: string;
  reason: string;
}

export interface PlanFillInput {
  windowStart: string;
  windowEnd: string;
  /** Earliest day a suggestion may start (today, or tomorrow once past the 5 PM cutoff). */
  today: Date;
  holidays: Set<string>;
  developers: PlannerDev[];
  backlog: PlannerBacklogTask[];
  affinity: (taskName: string, developerId: number) => number;
}

const PRIORITY_RANK: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 };

function daysBetween(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000);
}

function addDaysISO(iso: string, days: number): string {
  return toISODate(addDays(parseISODate(iso), days));
}

/**
 * Tasks with a preferred developer claim slots first (so a general task can't take the slot a
 * preferred-developer task needs), then soonest due date (none last), priority, oldest first.
 */
function byUrgency(a: PlannerBacklogTask, b: PlannerBacklogTask): number {
  const aPref = a.preferred_developer_id !== null;
  const bPref = b.preferred_developer_id !== null;
  if (aPref !== bPref) return aPref ? -1 : 1;
  if (a.due_date !== b.due_date) {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date < b.due_date ? -1 : 1;
  }
  if (a.priority !== b.priority) return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
  return a.id - b.id;
}

/**
 * Greedily fills developers' free slots inside [windowStart, windowEnd] with backlog tasks.
 * Each task goes to the best-fit developer (preferred, learned affinity, earliest start, lighter
 * load); every placement is committed to that developer's busy list, so later tasks fill what's
 * left and nothing overlaps. A task only counts if it *starts* inside the window (it may run past it).
 *
 * A task with a preferred developer always goes to that developer — never to someone else. If
 * their next free slot is beyond the window it's returned in `later` (still with dates, so it can
 * be accepted) rather than being handed to another developer's free slot.
 */
export function planFill(input: PlanFillInput): {
  proposals: FillProposal[];
  later: FillProposal[];
  unplaced: UnplacedTask[];
} {
  const { windowStart, windowEnd, today, holidays, backlog, affinity } = input;
  const from = parseISODate(windowStart).getTime() > today.getTime() ? parseISODate(windowStart) : today;
  const devs = input.developers.map((d) => ({ ...d, busy: [...d.busy], placed: 0 }));

  const proposals: FillProposal[] = [];
  const later: FillProposal[] = [];
  const unplaced: UnplacedTask[] = [];

  for (const task of [...backlog].sort(byUrgency)) {
    const estimatedDays = Math.max(1, task.estimated_days ?? 1);
    const eligible = devs.filter((d) => !d.excluded || d.id === task.preferred_developer_id);

    let best: { dev: (typeof devs)[number]; start: string; score: number; affinity: number } | null = null;

    const preferred = task.preferred_developer_id !== null ? devs.find((d) => d.id === task.preferred_developer_id) : undefined;
    if (preferred) {
      best = {
        dev: preferred,
        start: findEarliestSlot(preferred.busy, estimatedDays, holidays, from),
        score: 0,
        affinity: affinity(task.task_name, preferred.id),
      };
    }
    for (const dev of preferred ? [] : eligible) {
      const start = findEarliestSlot(dev.busy, estimatedDays, holidays, from);
      if (start > windowEnd) continue;
      const aff = affinity(task.task_name, dev.id);
      const score =
        (task.preferred_developer_id === dev.id ? 100 : 0) +
        Math.min(aff, 25) -
        daysBetween(windowStart, start) * 3 -
        (dev.activeTaskCount + dev.placed);
      if (!best || score > best.score || (score === best.score && dev.id < best.dev.id)) {
        best = { dev, start, score, affinity: aff };
      }
    }

    if (!best) {
      unplaced.push({
        assignmentId: task.id,
        taskName: task.task_name,
        reason: `No developer has a free ${estimatedDays}-day slot starting in this window`,
      });
      continue;
    }

    const end = addDaysISO(best.start, estimatedDays - 1);
    best.dev.busy.push({ start: best.start, end });
    best.dev.placed += 1;

    const reasons: string[] = [];
    if (task.preferred_developer_id === best.dev.id) reasons.push("Preferred developer for this task");
    if (best.affinity > 0) reasons.push("Has handled similar tasks before");
    if (best.start > windowEnd) {
      reasons.push(`${best.dev.name} has no free slot in this window — next free ${toDisplayDate(best.start)}`);
    }
    reasons.push(`Free ${toDisplayDate(best.start)} – ${toDisplayDate(end)}`);

    let slackDays: number | null = null;
    if (task.due_date) {
      slackDays = daysBetween(end, task.due_date);
      reasons.push(
        slackDays >= 0
          ? `Finishes ${slackDays}d before the ${toDisplayDate(task.due_date)} due date`
          : `Finishes ${Math.abs(slackDays)}d after the ${toDisplayDate(task.due_date)} due date`
      );
    }

    const proposal: FillProposal = {
      assignmentId: task.id,
      taskName: task.task_name,
      priority: task.priority,
      dueDate: task.due_date,
      estimatedDays,
      developerId: best.dev.id,
      developerName: best.dev.name,
      start: best.start,
      end,
      meetsDueDate: slackDays === null || slackDays >= 0,
      slackDays,
      reasons,
    };
    (best.start <= windowEnd ? proposals : later).push(proposal);
  }

  return { proposals, later, unplaced };
}
