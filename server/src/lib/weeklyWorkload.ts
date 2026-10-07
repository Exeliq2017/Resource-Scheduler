import { addDays, toISODate, todayDate } from "./dateUtils.js";
import { isNonWorkingDay } from "./workingDays.js";
import type { AssignmentLite } from "./availability.js";

export interface WeekBucket {
  weekStart: string;
  weekEnd: string;
  workingDaysInWeek: number;
  busyDays: number;
}

function startOfWeekMonday(date: Date): Date {
  const dow = date.getDay(); // 0 = Sunday .. 6 = Saturday
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDays(date, diff);
}

/**
 * Busy working-days per week for one developer, restricted to that week's
 * actual working days (Mon-Sat block, minus any off-Saturday/holiday) —
 * fixes the original sheet's over-count on weeks with a 2nd/4th Saturday off.
 */
export function computeWeeklyWorkload(
  assignments: AssignmentLite[],
  weeksCount: number,
  holidays?: Set<string>,
  today: Date = todayDate(),
  leaveDates?: Set<string>
): WeekBucket[] {
  const active = assignments.filter((a) => a.status !== "Completed");
  const buckets: WeekBucket[] = [];
  let weekStart = startOfWeekMonday(today);

  for (let w = 0; w < weeksCount; w++) {
    const weekEnd = addDays(weekStart, 5); // Mon..Sat
    let workingDaysInWeek = 0;
    let busyDays = 0;
    let cursor = weekStart;
    while (cursor.getTime() <= weekEnd.getTime()) {
      const iso = toISODate(cursor);
      if (!isNonWorkingDay(cursor, holidays) && !leaveDates?.has(iso)) {
        workingDaysInWeek += 1;
        const isBusy = active.some((a) => a.start_date <= iso && iso <= a.end_date);
        if (isBusy) busyDays += 1;
      }
      cursor = addDays(cursor, 1);
    }
    buckets.push({
      weekStart: toISODate(weekStart),
      weekEnd: toISODate(weekEnd),
      workingDaysInWeek,
      busyDays,
    });
    weekStart = addDays(weekStart, 7);
  }

  return buckets;
}
