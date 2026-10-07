export type DayPart = "FULL" | "AM" | "PM";

export interface AssignmentRange {
  id?: number;
  start_date: string | null; // ISO date
  end_date: string | null; // ISO date
  status: string;
  task_name: string;
  day_part?: DayPart;
}

export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/**
 * Whether two ranges that already overlap by date actually collide, once
 * half-day (AM/PM) granularity is taken into account. Half-days only mean
 * anything for a single-day task on one exact date — any overlap spanning
 * more than one day, or between two different dates, is always a real
 * conflict regardless of day_part.
 */
function dayPartsCollide(
  a: { start_date: string; end_date: string; day_part?: DayPart },
  b: { start_date: string; end_date: string; day_part?: DayPart }
): boolean {
  const aSingleDay = a.start_date === a.end_date;
  const bSingleDay = b.start_date === b.end_date;
  if (!aSingleDay || !bSingleDay || a.start_date !== b.start_date) {
    return true; // spans multiple days or different dates — half-day granularity doesn't apply
  }
  const aPart = a.day_part ?? "FULL";
  const bPart = b.day_part ?? "FULL";
  return aPart === "FULL" || bPart === "FULL" || aPart === bPart;
}

/**
 * Returns the existing assignments (for one developer) that overlap the
 * candidate date range. Completed tasks never count as conflicts, an
 * assignment never conflicts with itself when editing, and two half-day
 * (AM/PM) tasks on the same single day don't conflict unless they share a
 * half or either is a full-day task.
 */
export function findConflicts(
  candidate: { id?: number; start_date: string; end_date: string; day_part?: DayPart },
  existing: AssignmentRange[]
): AssignmentRange[] {
  return existing.filter(
    (a) =>
      a.id !== candidate.id &&
      a.status !== "Completed" &&
      a.start_date !== null &&
      a.end_date !== null &&
      rangesOverlap(candidate.start_date, candidate.end_date, a.start_date, a.end_date) &&
      dayPartsCollide(candidate, { start_date: a.start_date, end_date: a.end_date, day_part: a.day_part })
  );
}
