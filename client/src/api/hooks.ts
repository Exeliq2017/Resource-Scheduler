import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  Assignment,
  AvailabilityRow,
  DashboardSummary,
  Developer,
  DeveloperLeave,
  Holiday,
  NotificationItem,
  ScheduleGrid,
  UrgentShiftPreview,
  ApplyUrgentShiftResult,
  WeeklyWorkloadRow,
  ConflictRow,
  DayPart,
  SuggestionCandidate,
  AIInsights,
  TaskSuggestionDetail,
  OverrunPlan,
  AppSettings,
  PlannerData,
} from "./types";

// ---- Developers ----
export function useDevelopers() {
  return useQuery({ queryKey: ["developers"], queryFn: () => api.get<Developer[]>("/developers") });
}

export function useCreateDeveloper() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; role?: string; notes?: string }) => api.post<Developer>("/developers", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["developers"] }),
  });
}

export function useUpdateDeveloper() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<Developer>) => api.patch<Developer>(`/developers/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["developers"] });
      qc.invalidateQueries({ queryKey: ["availability"] });
    },
  });
}

export function useArchiveDeveloper() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/developers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["developers"] }),
  });
}

// ---- Assignments ----
export function useAssignments(filters?: { developer_id?: number; status?: string; backlog?: boolean }) {
  const params = new URLSearchParams();
  if (filters?.developer_id) params.set("developer_id", String(filters.developer_id));
  if (filters?.status) params.set("status", filters.status);
  if (filters?.backlog !== undefined) params.set("backlog", String(filters.backlog));
  const qs = params.toString();
  return useQuery({
    queryKey: ["assignments", filters],
    queryFn: () => api.get<Assignment[]>(`/assignments${qs ? `?${qs}` : ""}`),
  });
}

// Tasks with no developer and/or no dates yet — a quick brain-dump list to schedule later.
export function useBacklog() {
  return useAssignments({ backlog: true });
}

function invalidateScheduleQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["assignments"] });
  qc.invalidateQueries({ queryKey: ["availability"] });
  qc.invalidateQueries({ queryKey: ["scheduleGrid"] });
  qc.invalidateQueries({ queryKey: ["weeklyWorkload"] });
  qc.invalidateQueries({ queryKey: ["summary"] });
  qc.invalidateQueries({ queryKey: ["notifications"] });
  qc.invalidateQueries({ queryKey: ["ai"] });
  qc.invalidateQueries({ queryKey: ["planner"] });
}

export function useCreateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Assignment> & { override?: boolean }) => api.post<Assignment>("/assignments", data),
    onSuccess: () => invalidateScheduleQueries(qc),
  });
}

export function useUpdateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<Assignment> & { override?: boolean }) =>
      api.patch<Assignment>(`/assignments/${id}`, data),
    onSuccess: () => invalidateScheduleQueries(qc),
  });
}

export function useMoveToBacklog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<Assignment>(`/assignments/${id}/move-to-backlog`),
    onSuccess: () => invalidateScheduleQueries(qc),
  });
}

export function useOverrunPreview() {
  return useMutation({
    mutationFn: (data: { assignment_id: number; extra_days: number }) =>
      api.post<OverrunPlan>("/overrun/preview", data),
  });
}

export function useApplyOverrun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { assignment_id: number; extra_days: number; mode: "extend" | "split"; due_date?: string }) =>
      api.post<unknown>("/overrun/apply", data),
    onSuccess: () => invalidateScheduleQueries(qc),
  });
}

export function useDeleteAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/assignments/${id}`),
    onSuccess: () => invalidateScheduleQueries(qc),
  });
}

export function useBulkSetStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { ids: number[]; status: string }) => api.post("/assignments/bulk-status", data),
    onSuccess: () => invalidateScheduleQueries(qc),
  });
}

export async function checkConflicts(params: {
  developer_id: number;
  start_date: string;
  end_date: string;
  exclude_id?: number;
  day_part?: DayPart;
}): Promise<ConflictRow[]> {
  const qs = new URLSearchParams({
    developer_id: String(params.developer_id),
    start_date: params.start_date,
    end_date: params.end_date,
    ...(params.exclude_id ? { exclude_id: String(params.exclude_id) } : {}),
    ...(params.day_part ? { day_part: params.day_part } : {}),
  });
  const res = await api.get<{ conflicts: ConflictRow[] }>(`/assignments/conflicts?${qs.toString()}`);
  return res.conflicts;
}

// ---- Availability ----
export function useAvailability() {
  return useQuery({ queryKey: ["availability"], queryFn: () => api.get<AvailabilityRow[]>("/availability") });
}

// Gap-aware "when could they start a task of this length" — see server/src/lib/slotFinder.ts.
export function useNextAvailableSlot(estimatedDays: number) {
  return useQuery({
    queryKey: ["availability", "next-slot", estimatedDays],
    queryFn: () => api.get<{ developerId: number; nextAvailableDate: string }[]>(`/availability/next-slot?estimated_days=${estimatedDays}`),
  });
}

// ---- Schedule grid ----
export function useScheduleGrid(days: number) {
  return useQuery({
    queryKey: ["scheduleGrid", days],
    queryFn: () => api.get<ScheduleGrid>(`/schedule/grid?days=${days}`),
  });
}

// ---- Weekly workload ----
export function useWeeklyWorkload(weeks = 5) {
  return useQuery({
    queryKey: ["weeklyWorkload", weeks],
    queryFn: () => api.get<WeeklyWorkloadRow[]>(`/weekly-workload?weeks=${weeks}`),
  });
}

// ---- Urgent shift ----
export function usePreviewUrgentShift() {
  return useMutation({
    mutationFn: (data: {
      developer_id: number;
      urgent_start: string;
      urgent_duration_days: number;
      mode: "Shift" | "Split";
    }) => api.post<UrgentShiftPreview>("/urgent-shift/preview", data),
  });
}

export function useApplyUrgentShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      developer_id: number;
      task_name: string;
      urgent_start: string;
      urgent_duration_days: number;
      mode: "Shift" | "Split";
    }) => api.post<ApplyUrgentShiftResult>("/urgent-shift/apply", data),
    onSuccess: () => invalidateScheduleQueries(qc),
  });
}

export function useUndoUrgentShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ApplyUrgentShiftResult) =>
      api.post<void>("/urgent-shift/undo", {
        urgent_assignment_id: data.urgentAssignmentId,
        follow_up_ids: data.followUpIds,
        previous_dates: data.previousDates,
      }),
    onSuccess: () => invalidateScheduleQueries(qc),
  });
}

// ---- Holidays ----
export function useHolidays() {
  return useQuery({ queryKey: ["holidays"], queryFn: () => api.get<Holiday[]>("/holidays") });
}

export function useAddHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { date: string; label?: string }) => api.post<Holiday>("/holidays", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["holidays"] });
      invalidateScheduleQueries(qc);
    },
  });
}

export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/holidays/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["holidays"] });
      invalidateScheduleQueries(qc);
    },
  });
}

// ---- Planned leave ----
export function useLeaves(developerId?: number) {
  const qs = developerId ? `?developer_id=${developerId}` : "";
  return useQuery({
    queryKey: ["leaves", developerId],
    queryFn: () => api.get<DeveloperLeave[]>(`/leaves${qs}`),
  });
}

export function useCreateLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { developer_id: number; start_date: string; end_date: string; reason?: string }) =>
      api.post<DeveloperLeave>("/leaves", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leaves"] });
      invalidateScheduleQueries(qc);
    },
  });
}

export function useDeleteLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/leaves/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leaves"] });
      invalidateScheduleQueries(qc);
    },
  });
}

// ---- Notifications ----
export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<NotificationItem[]>("/notifications"),
    refetchInterval: 45_000,
  });
}

// ---- Summary ----
export function useSummary() {
  return useQuery({
    queryKey: ["summary"],
    queryFn: () => api.get<DashboardSummary>("/summary"),
    refetchInterval: 60_000,
  });
}

// ---- AI suggestions ----
export function useBacklogSuggestions() {
  return useQuery({
    queryKey: ["ai", "suggestions", "backlog"],
    queryFn: () => api.get<Record<string, SuggestionCandidate | null>>("/ai/suggestions/backlog"),
    refetchInterval: 60_000,
  });
}

// Manual-trigger only (button click via refetch()) — the endpoint may call Claude, so it
// must never run automatically on mount or poll.
export function useAIInsights() {
  return useQuery({
    queryKey: ["ai", "insights"],
    queryFn: () => api.get<AIInsights>("/ai/insights"),
    enabled: false,
  });
}

// Full ranked candidate list + reasons for one backlog task — fetched on demand (icon click),
// always local-only (useClaude: false) so viewing scoring detail never costs a Claude call.
export function useTaskSuggestionDetail() {
  return useMutation({
    mutationFn: (assignmentId: number) =>
      api.post<TaskSuggestionDetail>(`/ai/suggest/${assignmentId}`, { useClaude: false }),
  });
}

export function useResetAffinity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<void>("/ai/affinity"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai"] }),
  });
}

export function useAIConfig() {
  return useQuery({
    queryKey: ["ai", "config"],
    queryFn: () => api.get<{ configured: boolean }>("/ai/config"),
  });
}

export function useSetAIConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (apiKey: string) => api.post<{ configured: boolean }>("/ai/config", { apiKey }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai", "config"] }),
  });
}

// Records that a suggestion was accepted (or a task completed) so the local engine's
// affinity learning improves — called after applying a suggested developer.
export function useSubmitAIFeedback() {
  return useMutation({
    mutationFn: (data: { taskName: string; developerId: number; weight?: number }) => api.post("/ai/feedback", data),
  });
}

// ---- App settings & Dashboard look-ahead planner ----
export function useAppSettings() {
  return useQuery({ queryKey: ["settings"], queryFn: () => api.get<AppSettings>("/settings") });
}

export function useUpdateAppSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<AppSettings>) => api.put<AppSettings>("/settings", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["planner"] });
    },
  });
}

// `offset` shifts the window forward by whole windows; `excludeIds` are dismissed suggestions so
// their slots get re-flowed to other backlog tasks.
export function usePlanner(offset: number, excludeIds: number[]) {
  const qs = new URLSearchParams({ offset: String(offset) });
  if (excludeIds.length > 0) qs.set("exclude", excludeIds.join(","));
  return useQuery({
    queryKey: ["planner", offset, excludeIds],
    queryFn: () => api.get<PlannerData>(`/planner?${qs.toString()}`),
    placeholderData: (previous) => previous,
    refetchInterval: 60_000,
  });
}
