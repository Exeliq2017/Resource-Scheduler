import { useMemo, useState } from "react";
import { Trash2, CheckCircle2, Lock, TimerReset, Undo2 } from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { QuickAddRow } from "./QuickAddRow";
import { BacklogSection } from "./BacklogSection";
import { OverrunDialog } from "./OverrunDialog";
import {
  useAssignments,
  useBulkSetStatus,
  useDeleteAssignment,
  useMoveToBacklog,
  useDevelopers,
  useUpdateAssignment,
} from "../../api/hooks";
import type { Assignment, Priority, Status } from "../../api/types";
import { formatDate } from "../../lib/formatDate";

const PRIORITIES: Priority[] = ["High", "Medium", "Low"];
const STATUSES: Status[] = ["Planned", "Ongoing", "On Hold", "Completed"];
const ACTIVE_STATUS_FILTERS: Status[] = ["Planned", "Ongoing", "On Hold"];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDaysISO(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isStartingToday(a: Assignment, today: string): boolean {
  return Boolean(a.developer_id) && a.start_date === today && a.status === "Planned";
}
function needsCompletionCheck(a: Assignment, yesterday: string): boolean {
  return a.end_date === yesterday && a.status !== "Completed";
}

// Double-booking is allowed (a developer may juggle two tasks at their own discretion) — this is
// never blocking, just a heads-up after the save already went through.
function warnIfConflicts(updated: Assignment, developerName?: string | null) {
  if (updated.conflicts && updated.conflicts.length > 0) {
    alert(`Heads up: this now overlaps ${updated.conflicts.length} other task(s) for ${developerName ?? "this developer"} — both are kept.`);
  }
}

export function ListView({
  quickAddOpen,
  onQuickAddOpenChange,
}: {
  quickAddOpen: boolean;
  onQuickAddOpenChange: (open: boolean) => void;
}) {
  const { data: developers } = useDevelopers();
  const [developerFilter, setDeveloperFilter] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const { data: assignments, isLoading } = useAssignments({
    backlog: false,
    ...(developerFilter === "all" ? {} : { developer_id: developerFilter }),
  });
  const updateAssignment = useUpdateAssignment();
  const deleteAssignment = useDeleteAssignment();
  const moveToBacklog = useMoveToBacklog();
  const bulkSetStatus = useBulkSetStatus();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [overrunTask, setOverrunTask] = useState<Assignment | null>(null);

  const today = todayISO();
  const yesterday = addDaysISO(today, -1);

  const filtered = useMemo(() => {
    const active = (assignments ?? []).filter((a) => a.status !== "Completed");
    return active.filter((a) => statusFilter === "all" || a.status === statusFilter);
  }, [assignments, statusFilter]);

  const completed = useMemo(() => (assignments ?? []).filter((a) => a.status === "Completed"), [assignments]);

  const recentTaskNames = useMemo(() => (assignments ?? []).map((a) => a.task_name), [assignments]);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <BacklogSection />

      {quickAddOpen ? (
        <QuickAddRow recentTaskNames={recentTaskNames} />
      ) : (
        <button
          onClick={() => onQuickAddOpenChange(true)}
          className="w-full rounded-xl border border-dashed border-surface-border bg-white px-4 py-3 text-left text-sm text-slate-400 hover:border-brand-300 hover:text-brand-600"
        >
          + Quick-add a task&hellip;
        </button>
      )}

      <div className="flex items-center gap-2">
        <select
          value={developerFilter}
          onChange={(e) => setDeveloperFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
          className="rounded-lg border border-surface-border bg-white px-2.5 py-1.5 text-sm"
        >
          <option value="all">All developers</option>
          {developers?.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as Status | "all")}
          className="rounded-lg border border-surface-border bg-white px-2.5 py-1.5 text-sm"
        >
          <option value="all">All statuses</option>
          {ACTIVE_STATUS_FILTERS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>

        {selected.size > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-500">{selected.size} selected</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                bulkSetStatus.mutate({ ids: Array.from(selected), status: "Completed" }, { onSuccess: () => setSelected(new Set()) });
              }}
            >
              <CheckCircle2 size={14} /> Mark Completed
            </Button>
          </div>
        )}
      </div>

      <Card className="!p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface-muted text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="w-8 px-4 py-3"></th>
              <th className="px-3 py-3">Developer</th>
              <th className="px-3 py-3">Task</th>
              <th className="px-3 py-3">Start</th>
              <th className="px-3 py-3">End</th>
              <th className="px-3 py-3">Duration</th>
              <th className="px-3 py-3">Priority</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {isLoading && (
              <tr><td colSpan={9} className="px-4 py-6 text-center text-slate-400">Loading&hellip;</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-6 text-center text-slate-400">No assignments yet.</td></tr>
            )}
            {filtered.map((a) => {
              const startingToday = isStartingToday(a, today);
              const verifyCompletion = needsCompletionCheck(a, yesterday);
              return (
              <tr
                key={a.id}
                className={
                  "hover:bg-surface-muted/60 " +
                  (startingToday ? "bg-amber-50/60" : verifyCompletion ? "bg-sky-50/60" : "")
                }
              >
                <td className="px-4 py-2.5">
                  <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleSelect(a.id)} />
                </td>
                <td className="px-3 py-2.5 font-medium text-slate-800">
                  {a.developer_name}
                  {a.is_urgent === 1 && <span className="ml-1.5 text-state-urgent">&#9889;</span>}
                </td>
                <td className="px-3 py-2.5 text-slate-700">
                  {a.task_name}
                  {a.is_fixed === 1 && <Lock size={12} className="ml-1.5 inline text-slate-400" aria-label="Fixed" />}
                  {a.day_part !== "FULL" && (
                    <span className="ml-1.5 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-medium text-slate-500">
                      {a.day_part}
                    </span>
                  )}
                  {startingToday && (
                    <span className="ml-1.5">
                      <Badge tone="warning">Starts today</Badge>
                    </span>
                  )}
                  {verifyCompletion && (
                    <span className="ml-1.5">
                      <Badge tone="info">Verify completion</Badge>
                    </span>
                  )}
                  {a.end_date !== null && a.end_date <= today && (
                    <button
                      onClick={() => setOverrunTask(a)}
                      className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200 hover:bg-amber-100"
                    >
                      <TimerReset size={11} /> Overran?
                    </button>
                  )}
                </td>
                <td className="px-3 py-2.5 text-slate-500">
                  <input
                    key={a.start_date ?? ""}
                    type="date"
                    defaultValue={a.start_date ?? ""}
                    onBlur={(e) =>
                      e.target.value !== a.start_date &&
                      updateAssignment.mutate(
                        { id: a.id, start_date: e.target.value },
                        { onSuccess: (updated) => warnIfConflicts(updated, a.developer_name) }
                      )
                    }
                    className="rounded border-none bg-transparent px-1 py-0.5 text-slate-500 hover:bg-white focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-200"
                  />
                </td>
                <td className="px-3 py-2.5 text-slate-500">
                  <input
                    key={a.end_date ?? ""}
                    type="date"
                    defaultValue={a.end_date ?? ""}
                    onBlur={(e) =>
                      e.target.value !== a.end_date &&
                      updateAssignment.mutate(
                        { id: a.id, end_date: e.target.value },
                        { onSuccess: (updated) => warnIfConflicts(updated, a.developer_name) }
                      )
                    }
                    className="rounded border-none bg-transparent px-1 py-0.5 text-slate-500 hover:bg-white focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-200"
                  />
                </td>
                <td className="px-3 py-2.5 text-slate-500">{a.duration_days}d</td>
                <td className="px-3 py-2.5">
                  <select
                    value={a.priority}
                    onChange={(e) => updateAssignment.mutate({ id: a.id, priority: e.target.value as Priority })}
                    className="cursor-pointer rounded border-none bg-transparent text-xs focus:outline-none focus:ring-1 focus:ring-brand-200"
                  >
                    {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2.5">
                  <select
                    value={a.status}
                    onChange={(e) => updateAssignment.mutate({ id: a.id, status: e.target.value as Status })}
                    className="cursor-pointer rounded border-none bg-transparent text-xs focus:outline-none focus:ring-1 focus:ring-brand-200"
                  >
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                  {a.status !== "Completed" && (
                    <button
                      onClick={() =>
                        confirm(`Move "${a.task_name}" back to the backlog? Its developer and dates will be cleared.`) &&
                        moveToBacklog.mutate(a.id)
                      }
                      title="Move back to backlog"
                      className="rounded p-1 text-slate-300 hover:bg-brand-50 hover:text-brand-600"
                    >
                      <Undo2 size={15} />
                    </button>
                  )}
                  <button
                    onClick={() => confirm(`Delete "${a.task_name}"?`) && deleteAssignment.mutate(a.id)}
                    className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {overrunTask && <OverrunDialog task={overrunTask} onClose={() => setOverrunTask(null)} />}

      {completed.length > 0 && (
        <Card className="!p-0 overflow-hidden opacity-90">
          <div className="border-b border-surface-border bg-surface-muted px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500">
            Completed ({completed.length})
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2">Developer</th>
                <th className="px-3 py-2">Task</th>
                <th className="px-3 py-2">Dates</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {completed.map((a) => (
                <tr key={a.id} className="text-slate-500">
                  <td className="px-3 py-2">{a.developer_name}</td>
                  <td className="px-3 py-2">{a.task_name}</td>
                  <td className="px-3 py-2">{formatDate(a.start_date)} &rarr; {formatDate(a.end_date)}</td>
                  <td className="px-3 py-2">{a.priority}</td>
                  <td className="px-3 py-2">
                    <select
                      value={a.status}
                      onChange={(e) => updateAssignment.mutate({ id: a.id, status: e.target.value as Status })}
                      className="cursor-pointer rounded border-none bg-transparent text-xs focus:outline-none focus:ring-1 focus:ring-brand-200"
                    >
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => confirm(`Delete "${a.task_name}"?`) && deleteAssignment.mutate(a.id)}
                      className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
