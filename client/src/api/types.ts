export interface Developer {
  id: number;
  name: string;
  role: string;
  notes: string | null;
  is_active: number;
  exclude_from_suggestions: number;
  created_at: string;
  updated_at: string;
}

export type Priority = "High" | "Medium" | "Low";
export type Status = "Planned" | "Ongoing" | "Completed" | "On Hold";

export type DayPart = "FULL" | "AM" | "PM";

export interface Assignment {
  id: number;
  developer_id: number | null;
  developer_name?: string | null;
  task_name: string;
  start_date: string | null;
  end_date: string | null;
  due_date: string | null;
  duration_days: number | null;
  priority: Priority;
  status: Status;
  is_urgent: number;
  notes: string | null;
  day_part: DayPart;
  estimated_days: number | null;
  preferred_developer_id: number | null;
  preferred_developer_name?: string | null;
  is_fixed: number;
  created_at: string;
  updated_at: string;
  /** Present on a create/update response when the developer now has overlapping work — informational only, never blocks the save. */
  conflicts?: ConflictRow[];
}

export function isBacklogAssignment(a: Pick<Assignment, "developer_id" | "start_date" | "end_date">): boolean {
  return !a.developer_id || !a.start_date || !a.end_date;
}

export interface DeveloperLeave {
  id: number;
  developer_id: number;
  developer_name?: string;
  start_date: string;
  end_date: string;
  reason: string | null;
}

export interface AvailabilityRow {
  developer: Pick<Developer, "id" | "name" | "role" | "notes">;
  lastTaskEndDate: string | null;
  nextFreeWorkingDay: string;
  currentOrNextTask: { id: number; task_name: string; start_date: string; end_date: string } | null;
  statusLabel: string;
  onLeave: DeveloperLeave | null;
}

export interface ConflictRow {
  id: number;
  task_name: string;
  start_date: string;
  end_date: string;
  status: string;
}

export type HalfState = "OFF" | "LEAVE" | "FREE" | "BUSY" | "URGENT";

export interface AssignmentRef {
  id: number;
  taskName: string;
  priority: Priority;
  startDate: string;
  endDate: string;
  dayPart: DayPart;
}

export interface HalfCell {
  state: HalfState;
  leaveReason?: string;
  /** Every assignment covering this half — normally 0 or 1, but 2+ when a developer is double-booked. */
  assignments: AssignmentRef[];
}

export interface GridCell {
  date: string;
  am: HalfCell;
  pm: HalfCell;
}

export interface GridRow {
  developer: Pick<Developer, "id" | "name" | "role">;
  cells: GridCell[];
}

export interface ScheduleGrid {
  dates: string[];
  rows: GridRow[];
}

export interface WeekBucket {
  weekStart: string;
  weekEnd: string;
  workingDaysInWeek: number;
  busyDays: number;
}

export interface WeeklyWorkloadRow {
  developer: Pick<Developer, "id" | "name">;
  buckets: WeekBucket[];
}

export interface AffectedRowPreview {
  id: number;
  taskName: string;
  currentStart: string;
  currentEnd: string;
  newStart: string;
  newEnd: string;
  type: "ONGOING" | "UPCOMING";
  action: string;
  followUp?: { start: string; end: string };
}

export interface UrgentShiftPreview {
  urgentEnd: string;
  affected: AffectedRowPreview[];
}

export interface ApplyUrgentShiftResult {
  urgentAssignmentId: number;
  updatedIds: number[];
  followUpIds: number[];
  previousDates: { id: number; start_date: string; end_date: string }[];
}

export interface Holiday {
  id: number;
  date: string;
  label: string;
}

export interface DashboardSummary {
  freeNow: { developer: Pick<Developer, "id" | "name" | "role"> }[];
  busyToday: { developer: Pick<Developer, "id" | "name" | "role">; task: Assignment }[];
  onLeaveToday: { developer: Pick<Developer, "id" | "name" | "role">; leave: DeveloperLeave }[];
  urgentUpcoming: Assignment[];
  conflicts: { developer: Pick<Developer, "id" | "name" | "role">; conflicts: ConflictRow[] }[];
  backlogCount: number;
  overdueCount: number;
  lastUpdatedAt: string | null;
  recentActivity: { id: number; created_at: string; message: string }[];
}

export type NotificationSeverity = "high" | "medium" | "low";

export interface NotificationItem {
  id: string;
  type: string;
  severity: NotificationSeverity;
  message: string;
  relatedAssignmentId?: number;
  relatedDeveloperId?: number;
}

export interface SuggestionCandidate {
  developerId: number;
  developerName: string;
  score: number;
  reasons: string[];
  suggestedStart: string;
  suggestedEnd: string;
  suggestedDayPart: DayPart;
  meetsDueDate: boolean;
  slackDays: number | null;
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

export type AIInsightSource = "local" | "claude";

export interface AIInsights {
  source: AIInsightSource;
  summary: string;
  suggestions: (SuggestionCandidate & { assignmentId: number; taskName: string })[];
}

export interface TaskSuggestionDetail {
  candidates: SuggestionCandidate[];
  narrative: string | null;
  source: AIInsightSource;
}

export interface AppSettings {
  plannerDays: number;
}

export interface PlannerProposal {
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

export interface PlannerDeveloper {
  developer: Pick<Developer, "id" | "name" | "role"> & { excludeFromSuggestions: boolean };
  cells: GridCell[];
  freeWorkingDays: number;
  busyWorkingDays: number;
  leaveDays: number;
  proposedWorkingDays: number;
  proposals: PlannerProposal[];
}

export interface PlannerData {
  windowStart: string;
  windowEnd: string;
  days: { date: string; isWorkingDay: boolean; closed: boolean }[];
  windowDays: number;
  offset: number;
  maxOffset: number;
  developers: PlannerDeveloper[];
  /** Preferred-developer tasks whose developer has no free slot in this window (dates are after it). */
  later: PlannerProposal[];
  unplaced: { assignmentId: number; taskName: string; reason: string }[];
  summary: { freeDays: number; proposedDays: number };
}
