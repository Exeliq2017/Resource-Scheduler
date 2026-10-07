import { addDays, toISODate } from "./dateUtils.js";

/**
 * Working week is Mon-Sat. Sundays are off, and the 2nd and 4th Saturday of
 * every month are off (week-of-month = floor((day-1)/7)+1), matching the
 * original workbook's rule. `holidays` is a Set of ISO ("YYYY-MM-DD") dates
 * for one-off company holidays layered on top of the base rule.
 */
export function isNonWorkingDay(date: Date, holidays?: Set<string>): boolean {
  const dow = date.getDay(); // 0 = Sunday .. 6 = Saturday
  if (dow === 0) return true;
  if (dow === 6) {
    const weekOfMonth = Math.floor((date.getDate() - 1) / 7) + 1;
    if (weekOfMonth === 2 || weekOfMonth === 4) return true;
  }
  if (holidays?.has(toISODate(date))) return true;
  return false;
}

const MAX_LOOKAHEAD_DAYS = 366;

export function nextWorkingDay(date: Date, holidays?: Set<string>): Date {
  let candidate = date;
  let iterations = 0;
  while (isNonWorkingDay(candidate, holidays)) {
    candidate = addDays(candidate, 1);
    iterations += 1;
    if (iterations > MAX_LOOKAHEAD_DAYS) {
      throw new Error("nextWorkingDay: exceeded lookahead cap — check holiday configuration");
    }
  }
  return candidate;
}

export function countWorkingDaysInRange(start: Date, end: Date, holidays?: Set<string>): number {
  let count = 0;
  let cursor = start;
  while (cursor.getTime() <= end.getTime()) {
    if (!isNonWorkingDay(cursor, holidays)) count += 1;
    cursor = addDays(cursor, 1);
  }
  return count;
}

export function listNonWorkingDaysInRange(start: Date, end: Date, holidays?: Set<string>): Date[] {
  const result: Date[] = [];
  let cursor = start;
  while (cursor.getTime() <= end.getTime()) {
    if (isNonWorkingDay(cursor, holidays)) result.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return result;
}
