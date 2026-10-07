export interface StartCheckable {
  developer_id: number | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
}

export interface CompletionCheckable {
  end_date: string | null;
  status: string;
}

/** A fully scheduled task starting today that hasn't been moved to Ongoing yet. */
export function isStartingToday(assignment: StartCheckable, todayISO: string): boolean {
  const isFullyScheduled = Boolean(assignment.developer_id) && Boolean(assignment.start_date) && Boolean(assignment.end_date);
  return isFullyScheduled && assignment.start_date === todayISO && assignment.status === "Planned";
}

/** A task whose end date was yesterday — a one-time nudge to verify it actually got finished. */
export function needsCompletionCheck(assignment: CompletionCheckable, yesterdayISO: string): boolean {
  return assignment.end_date !== null && assignment.end_date === yesterdayISO && assignment.status !== "Completed";
}
