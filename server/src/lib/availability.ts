import { addDays, parseISODate, toISODate, todayDate, maxDate } from "./dateUtils.js";
import { nextWorkingDay } from "./workingDays.js";

export interface AssignmentLite {
  id: number;
  task_name: string;
  start_date: string;
  end_date: string;
  status: string;
}

export interface AvailabilityInfo {
  lastTaskEndDate: string | null;
  nextFreeWorkingDay: string;
  currentOrNextTask: AssignmentLite | null;
  statusLabel: string;
}

export function computeAvailability(
  assignments: AssignmentLite[],
  holidays?: Set<string>,
  today: Date = todayDate()
): AvailabilityInfo {
  const active = assignments.filter((a) => a.status !== "Completed");
  const todayISO = toISODate(today);

  const lastTaskEndDate =
    active.length === 0
      ? null
      : active.reduce((max, a) => (a.end_date > max ? a.end_date : max), active[0].end_date);

  const searchFrom =
    lastTaskEndDate && lastTaskEndDate >= todayISO ? addDays(parseISODate(lastTaskEndDate), 1) : today;
  const nextFreeWorkingDay = toISODate(nextWorkingDay(maxDate(searchFrom, today), holidays));

  const upcoming = active
    .filter((a) => a.end_date >= todayISO)
    .sort((a, b) => (a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0));
  const currentOrNextTask = upcoming[0] ?? null;

  const statusLabel =
    !lastTaskEndDate || lastTaskEndDate < todayISO
      ? "Free now"
      : `Busy till ${formatShort(lastTaskEndDate)}`;

  return { lastTaskEndDate, nextFreeWorkingDay, currentOrNextTask, statusLabel };
}

function formatShort(iso: string): string {
  const d = parseISODate(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(d.getDate()).padStart(2, "0")}-${months[d.getMonth()]}`;
}
