import { addDays, parseISODate, toISODate } from "./dateUtils.js";
import { nextWorkingDay } from "./workingDays.js";

export interface BusyRange {
  start: string;
  end: string;
}

function addDaysISO(iso: string, days: number): string {
  return toISODate(addDays(parseISODate(iso), days));
}

/** Merges overlapping or adjacent (touching, no gap between) ranges into a sorted, disjoint list. */
function mergeRanges(ranges: BusyRange[]): BusyRange[] {
  const sorted = [...ranges].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  const merged: BusyRange[] = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last && r.start <= addDaysISO(last.end, 1)) {
      if (r.end > last.end) last.end = r.end;
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}

/**
 * Finds the earliest date a developer could start a task lasting `estimatedDays` calendar days,
 * given their already-busy date ranges — unlike `computeAvailability`'s `nextFreeWorkingDay`
 * (which only looks past the *last* committed task), this checks gaps between busy ranges too,
 * so a short task can slot into a free window before later work already on the books.
 */
export function findEarliestSlot(
  busyRanges: BusyRange[],
  estimatedDays: number,
  holidays: Set<string> | undefined,
  today: Date
): string {
  const merged = mergeRanges(busyRanges);
  let cursor = toISODate(nextWorkingDay(today, holidays));

  for (const busy of merged) {
    if (cursor < busy.start) {
      const gapEnd = addDaysISO(busy.start, -1);
      const slotEnd = addDaysISO(cursor, estimatedDays - 1);
      if (slotEnd <= gapEnd) return cursor;
    }
    if (cursor <= busy.end) {
      cursor = toISODate(nextWorkingDay(addDays(parseISODate(busy.end), 1), holidays));
    }
  }

  return cursor;
}
