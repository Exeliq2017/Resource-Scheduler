export interface OverdueCheckable {
  end_date: string | null;
  status: string;
}

export interface BacklogCheckable {
  developer_id: number | null;
  start_date: string | null;
  end_date: string | null;
  due_date: string | null;
}

/** A scheduled (non-backlog) task whose end date has passed and isn't Completed. */
export function isOverdueScheduled(assignment: OverdueCheckable, todayISO: string): boolean {
  return assignment.end_date !== null && assignment.end_date < todayISO && assignment.status !== "Completed";
}

/** A backlog task (still missing developer and/or dates) whose due date has passed. */
export function isOverdueBacklog(assignment: BacklogCheckable, todayISO: string): boolean {
  const isBacklog = !assignment.developer_id || !assignment.start_date || !assignment.end_date;
  return isBacklog && assignment.due_date !== null && assignment.due_date < todayISO;
}

/** Due within the next N days (inclusive), not already overdue. `horizonISO` is today + N days. */
export function isDueSoonBacklog(assignment: BacklogCheckable, todayISO: string, horizonISO: string): boolean {
  const isBacklog = !assignment.developer_id || !assignment.start_date || !assignment.end_date;
  if (!isBacklog || !assignment.due_date) return false;
  return assignment.due_date >= todayISO && assignment.due_date <= horizonISO;
}
