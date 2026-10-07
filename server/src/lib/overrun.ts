import { addDays, parseISODate, toISODate, toDisplayDate } from "./dateUtils.js";
import { countWorkingDaysInRange, nextWorkingDay } from "./workingDays.js";

export interface OverrunTask {
  id: number;
  task_name: string;
  start_date: string;
  end_date: string;
  due_date: string | null;
  status: string;
  is_fixed: number;
}

export interface OverrunMove {
  id: number;
  taskName: string;
  oldStart: string;
  oldEnd: string;
  newStart: string;
  newEnd: string;
}

export interface OverrunPlan {
  newEnd: string;
  moves: OverrunMove[];
  warnings: string[];
}

interface Range {
  start: string;
  end: string;
}

function shift(iso: string, days: number): string {
  return toISODate(addDays(parseISODate(iso), days));
}

// The date `n` working days after `iso` (n = 0 returns `iso` itself, snapped to a working day).
function addWorkingDays(iso: string, n: number, holidays: Set<string>): string {
  let cursor = nextWorkingDay(parseISODate(iso), holidays);
  for (let i = 0; i < n; i++) cursor = nextWorkingDay(addDays(cursor, 1), holidays);
  return toISODate(cursor);
}

function overlaps(a: Range, b: Range): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/**
 * Extends an overrunning task by `extraDays` working days (Sundays, 2nd/4th Saturdays and holidays
 * don't count, so the new end date is always a working day) and pushes later, non-fixed tasks of the same developer
 * forward only as far as needed — each keeps its own duration and hops past fixed tasks rather than
 * overlapping them. Fixed tasks never move; if the extended range itself runs into one, that's
 * reported as a warning (the conflict is unavoidable) instead.
 */
export function computeExtendPlan(
  task: OverrunTask,
  extraDays: number,
  todayISO: string,
  siblings: OverrunTask[],
  holidays: Set<string> = new Set()
): OverrunPlan {
  const anchor = task.end_date > shift(todayISO, -1) ? task.end_date : shift(todayISO, -1);
  const newEnd = addWorkingDays(shift(anchor, 1), extraDays - 1, holidays);
  const active = siblings.filter((s) => s.id !== task.id && s.status !== "Completed");
  const warnings: string[] = [];

  const placed: Range[] = [{ start: task.start_date, end: newEnd }];
  for (const fixed of active.filter((s) => s.is_fixed === 1)) {
    const fixedRange = { start: fixed.start_date, end: fixed.end_date };
    placed.push(fixedRange);
    if (fixed.start_date > task.end_date && overlaps({ start: task.start_date, end: newEnd }, fixedRange)) {
      warnings.push(
        `Fixed task "${fixed.task_name}" (${toDisplayDate(fixed.start_date)} – ${toDisplayDate(
          fixed.end_date
        )}) can't move, so the extended task will overlap it.`
      );
    }
  }

  const moves: OverrunMove[] = [];
  const movable = active
    .filter((s) => s.is_fixed !== 1 && s.start_date > task.end_date)
    .sort((a, b) => (a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0));

  for (const s of movable) {
    const length = Math.max(1, countWorkingDaysInRange(parseISODate(s.start_date), parseISODate(s.end_date), holidays));
    let start = s.start_date;
    let end = s.end_date;
    let hit = placed.filter((p) => overlaps({ start, end }, p));
    while (hit.length > 0) {
      start = addWorkingDays(shift(hit.reduce((max, p) => (p.end > max ? p.end : max), hit[0].end), 1), 0, holidays);
      end = addWorkingDays(start, length - 1, holidays);
      hit = placed.filter((p) => overlaps({ start, end }, p));
    }
    placed.push({ start, end });
    if (start !== s.start_date) {
      moves.push({ id: s.id, taskName: s.task_name, oldStart: s.start_date, oldEnd: s.end_date, newStart: start, newEnd: end });
      if (s.due_date && end > s.due_date) {
        warnings.push(`"${s.task_name}" would now finish ${toDisplayDate(end)}, after its ${toDisplayDate(s.due_date)} due date.`);
      }
    }
  }

  return { newEnd, moves, warnings };
}
