import { useEffect, useMemo, useState } from "react";
import { BarChart2, CalendarPlus, Inbox, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Combobox } from "../ui/Combobox";
import { Dialog } from "../ui/Dialog";
import { ConflictBanner } from "./ConflictBanner";
import { DayPartToggle } from "./DayPartToggle";
import {
  checkConflicts,
  useBacklog,
  useBacklogSuggestions,
  useCreateAssignment,
  useDeleteAssignment,
  useDevelopers,
  useNextAvailableSlot,
  useSubmitAIFeedback,
  useTaskSuggestionDetail,
  useUpdateAssignment,
} from "../../api/hooks";
import type { Assignment, ConflictRow, DayPart, Priority, SuggestionCandidate } from "../../api/types";
import { formatDate } from "../../lib/formatDate";

const PRIORITIES: Priority[] = ["High", "Medium", "Low"];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDaysISO(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Aditya — free now" (green) / "Priyansh — free 21-09-2026" (amber), gap-aware per the task's estimate. */
function availabilityOptions(
  developers: { id: number; name: string }[],
  nextSlots?: { developerId: number; nextAvailableDate: string }[]
) {
  const today = todayISO();
  const byId = new Map((nextSlots ?? []).map((row) => [row.developerId, row.nextAvailableDate]));
  return developers.map((d) => {
    const date = byId.get(d.id);
    const isFreeNow = date === today;
    const freeLabel = !date ? "" : isFreeNow ? "free now" : `free ${formatDate(date)}`;
    return {
      value: String(d.id),
      label: freeLabel ? `${d.name} — ${freeLabel}` : d.name,
      labelNode: freeLabel ? (
        <>
          {d.name} — <span className={isFreeNow ? "font-medium text-emerald-600" : "font-medium text-amber-600"}>{freeLabel}</span>
        </>
      ) : undefined,
    };
  });
}

const PRIORITY_RANK: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 };

function daysInBacklog(createdAt: string): number {
  const created = new Date(createdAt.replace(" ", "T") + "Z").getTime();
  return Math.max(0, Math.floor((Date.now() - created) / 86_400_000));
}

/**
 * At-risk first: overdue, then least slack before the due date (negative = will miss it) using the
 * top suggestion — which already reflects a preferred developer's availability — then oldest in
 * the backlog, then priority.
 */
function orderBacklog(items: Assignment[], suggestions?: Record<string, SuggestionCandidate | null>): Assignment[] {
  const today = todayISO();
  const key = (a: Assignment) => {
    const overdue = a.due_date !== null && a.due_date < today ? 0 : 1;
    const slack = suggestions?.[a.id]?.slackDays ?? Number.POSITIVE_INFINITY;
    return { overdue, slack, created: a.created_at, priority: PRIORITY_RANK[a.priority] };
  };
  return [...items].sort((x, y) => {
    const a = key(x);
    const b = key(y);
    if (a.overdue !== b.overdue) return a.overdue - b.overdue;
    if (a.slack !== b.slack) return a.slack < b.slack ? -1 : 1;
    if (a.created !== b.created) return a.created < b.created ? -1 : 1;
    return a.priority - b.priority;
  });
}

export function BacklogSection() {
  const { data: backlog, isLoading } = useBacklog();
  const { data: suggestions } = useBacklogSuggestions();
  const { data: developers } = useDevelopers();
  const createAssignment = useCreateAssignment();

  const [taskName, setTaskName] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [dueDate, setDueDate] = useState("");
  const [estimatedDays, setEstimatedDays] = useState("");
  const [preferredDeveloperId, setPreferredDeveloperId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [scheduleId, setScheduleId] = useState<number | null>(null);
  const [appliedSuggestion, setAppliedSuggestion] = useState<SuggestionCandidate | null>(null);

  const canSubmit = taskName.trim().length > 0 && dueDate.length > 0 && Number(estimatedDays) > 0;
  const { data: nextSlots } = useNextAvailableSlot(Number(estimatedDays) || 1);
  const preferredOptions = availabilityOptions(developers ?? [], nextSlots);
  const orderedBacklog = useMemo(() => orderBacklog(backlog ?? [], suggestions), [backlog, suggestions]);

  function submit() {
    if (!canSubmit) return;
    createAssignment.mutate(
      {
        task_name: taskName.trim(),
        priority,
        due_date: dueDate,
        estimated_days: Number(estimatedDays),
        preferred_developer_id: preferredDeveloperId ?? undefined,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          setTaskName("");
          setPriority("Medium");
          setDueDate("");
          setEstimatedDays("");
          setPreferredDeveloperId(null);
          setNotes("");
        },
      }
    );
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <Inbox size={15} className="text-slate-400" /> Backlog
          {backlog && backlog.length > 0 && (
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
              {backlog.length}
            </span>
          )}
        </h3>
        <p className="text-xs text-slate-400">Sorted by risk, then age &middot; assign a developer and dates later</p>
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        <input
          value={taskName}
          onChange={(e) => setTaskName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="+ Quick-add a task to the backlog…"
          className="min-w-[180px] flex-1 rounded-lg border border-surface-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
          className="shrink-0 rounded-lg border border-surface-border px-2 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        >
          {PRIORITIES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <div className="shrink-0">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-lg border border-surface-border px-2 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <div className="mt-1 flex gap-1 text-xs">
            {[
              { label: "+3d", value: addDaysISO(todayISO(), 3) },
              { label: "+1w", value: addDaysISO(todayISO(), 7) },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => setDueDate(chip.value)}
                className="rounded bg-white px-1.5 py-0.5 text-slate-500 ring-1 ring-surface-border hover:text-brand-600"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <input
            type="number"
            min={1}
            value={estimatedDays}
            onChange={(e) => setEstimatedDays(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Est."
            title="Estimated work days"
            className="w-16 rounded-lg border border-surface-border px-2 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <span className="whitespace-nowrap text-xs text-slate-400">day(s)</span>
        </div>
        <Button onClick={submit} disabled={!canSubmit} className="shrink-0">
          <Plus size={15} /> Add
        </Button>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="min-w-[180px] flex-1">
          <Combobox
            options={preferredOptions}
            value={developers?.find((d) => d.id === preferredDeveloperId)?.name ?? ""}
            onChange={(v) => setPreferredDeveloperId(Number(v))}
            placeholder="Recommended developer (optional)"
          />
        </div>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Notes (optional)"
          className="min-w-[180px] flex-1 rounded-lg border border-surface-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </div>
      {(!dueDate || !(Number(estimatedDays) > 0)) && taskName.trim().length > 0 && (
        <p className="mb-3 -mt-2 text-xs text-amber-600">A due date and estimated work days are required for backlog tasks.</p>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-400">Loading&hellip;</p>
      ) : !backlog || backlog.length === 0 ? (
        <p className="text-sm text-slate-400">Nothing in the backlog — quick-add anything that comes to mind above.</p>
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-[26%]" />
              <col className="w-[8%]" />
              <col className="w-[12%]" />
              <col className="w-[7%]" />
              <col className="w-[13%]" />
              <col className="w-[19%]" />
              <col className="w-[6%]" />
              <col className="w-[9%]" />
            </colgroup>
            <thead>
              <tr className="border-y border-surface-border bg-surface-muted text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Task</th>
                <th className="px-2 py-2">Priority</th>
                <th className="px-2 py-2">Due</th>
                <th className="px-2 py-2">Est.</th>
                <th className="px-2 py-2">Preferred</th>
                <th className="px-2 py-2">Suggested</th>
                <th className="px-2 py-2">Age</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {orderedBacklog.map((item) => (
                <BacklogRow
                  key={item.id}
                  item={item}
                  suggestion={suggestions?.[item.id] ?? null}
                  expanded={scheduleId === item.id}
                  appliedSuggestion={scheduleId === item.id ? appliedSuggestion : null}
                  onToggleSchedule={() => {
                    const opening = scheduleId !== item.id;
                    setScheduleId(opening ? item.id : null);
                    setAppliedSuggestion(opening ? (suggestions?.[item.id] ?? null) : null);
                  }}
                  onApplySuggestion={(s) => {
                    setScheduleId(item.id);
                    setAppliedSuggestion(s);
                  }}
                  onScheduled={() => {
                    setScheduleId(null);
                    setAppliedSuggestion(null);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

const COLUMN_COUNT = 8;

function BacklogRow({
  item,
  suggestion,
  expanded,
  appliedSuggestion,
  onToggleSchedule,
  onApplySuggestion,
  onScheduled,
}: {
  item: Assignment;
  suggestion: SuggestionCandidate | null;
  expanded: boolean;
  appliedSuggestion: SuggestionCandidate | null;
  onToggleSchedule: () => void;
  onApplySuggestion: (s: SuggestionCandidate) => void;
  onScheduled: () => void;
}) {
  const deleteAssignment = useDeleteAssignment();
  const [editing, setEditing] = useState(false);
  const [scoringOpen, setScoringOpen] = useState(false);

  const today = todayISO();
  const dueTone: "danger" | "warning" | "default" =
    !item.due_date || item.due_date >= today ? (item.due_date && item.due_date <= addDaysISO(today, 2) ? "warning" : "default") : "danger";

  const priorityClass =
    item.priority === "High" ? "text-red-600" : item.priority === "Low" ? "text-slate-400" : "text-amber-600";

  const riskBadge =
    suggestion?.slackDays != null && suggestion.slackDays < 0 ? (
      <Badge tone="danger">Misses due</Badge>
    ) : suggestion?.slackDays != null && suggestion.slackDays <= 2 ? (
      <Badge tone="warning">{suggestion.slackDays}d slack</Badge>
    ) : null;

  return (
    <>
      <tr className="align-top hover:bg-surface-muted/60">
        <td className="px-3 py-2">
          <div className="truncate text-sm font-medium text-slate-800" title={item.task_name}>
            {item.task_name}
          </div>
          {item.notes && (
            <div className="mt-0.5 truncate text-xs text-slate-400" title={item.notes}>
              {item.notes}
            </div>
          )}
        </td>
        <td className={`whitespace-nowrap px-2 py-2 text-xs font-medium ${priorityClass}`}>{item.priority}</td>
        <td className="whitespace-nowrap px-2 py-2">
          {item.due_date ? (
            <Badge tone={dueTone}>
              {item.due_date < today ? "Overdue" : formatDate(item.due_date)}
            </Badge>
          ) : (
            <span className="text-xs text-slate-400">No due date</span>
          )}
        </td>
        <td className="whitespace-nowrap px-2 py-2 text-xs text-slate-600">{item.estimated_days ? `${item.estimated_days}d` : "—"}</td>
        <td className="truncate px-2 py-2 text-xs" title={item.preferred_developer_name ?? undefined}>
          {item.preferred_developer_name ? <Badge tone="lead">{item.preferred_developer_name}</Badge> : <span className="text-slate-300">—</span>}
        </td>
        <td className="px-2 py-2">
          {expanded ? (
            <span className="text-xs italic text-slate-400">Scheduling below&hellip;</span>
          ) : suggestion ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onApplySuggestion(suggestion)}
                title={suggestion.reasons.join(" · ")}
                className="inline-flex min-w-0 items-center gap-1 truncate rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 hover:bg-violet-100"
              >
                <Sparkles size={11} className="shrink-0" />
                <span className="truncate">
                  {suggestion.developerName} · {formatDate(suggestion.suggestedStart)}
                </span>
                {!suggestion.meetsDueDate && <span className="shrink-0 text-amber-600">(tight)</span>}
              </button>
              <button
                onClick={() => setScoringOpen(true)}
                title="View scoring breakdown"
                className="shrink-0 rounded p-1 text-slate-300 hover:bg-surface-muted hover:text-slate-500"
              >
                <BarChart2 size={13} />
              </button>
              {riskBadge}
            </div>
          ) : (
            <span className="text-xs text-slate-300">No match</span>
          )}
        </td>
        <td className="whitespace-nowrap px-2 py-2 text-xs text-slate-500">{daysInBacklog(item.created_at)}d</td>
        <td className="whitespace-nowrap px-3 py-2 text-right">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => setEditing(true)}
              title="Edit task"
              className="rounded p-1.5 text-slate-300 hover:bg-surface-muted hover:text-slate-500"
            >
              <Pencil size={14} />
            </button>
            <Button size="sm" variant="secondary" onClick={onToggleSchedule}>
              <CalendarPlus size={13} />
            </Button>
            <button
              onClick={() => confirm(`Remove "${item.task_name}" from the backlog?`) && deleteAssignment.mutate(item.id)}
              className="rounded p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={COLUMN_COUNT} className="px-3 pb-3">
            <BacklogEditPanel item={item} onDone={() => setEditing(false)} />
          </td>
        </tr>
      )}
      {expanded && (
        <tr>
          <td colSpan={COLUMN_COUNT} className="px-3 pb-3">
            <ScheduleForm item={item} suggestion={appliedSuggestion} onDone={onScheduled} />
          </td>
        </tr>
      )}
      {scoringOpen && <ScoringDialog assignmentId={item.id} taskName={item.task_name} onClose={() => setScoringOpen(false)} />}
    </>
  );
}

function BacklogEditPanel({ item, onDone }: { item: Assignment; onDone: () => void }) {
  const { data: developers } = useDevelopers();
  const updateAssignment = useUpdateAssignment();

  const [taskName, setTaskName] = useState(item.task_name);
  const [priority, setPriority] = useState<Priority>(item.priority);
  const [dueDate, setDueDate] = useState(item.due_date ?? "");
  const [estimatedDays, setEstimatedDays] = useState(String(item.estimated_days ?? ""));
  const [preferredDeveloperId, setPreferredDeveloperId] = useState<number | null>(item.preferred_developer_id);
  const [notes, setNotes] = useState(item.notes ?? "");

  const { data: nextSlots } = useNextAvailableSlot(Number(estimatedDays) || 1);
  const preferredOptions = availabilityOptions(developers ?? [], nextSlots);
  const canSave = taskName.trim().length > 0 && dueDate.length > 0 && Number(estimatedDays) > 0;

  function save() {
    if (!canSave) return;
    updateAssignment.mutate(
      {
        id: item.id,
        task_name: taskName.trim(),
        priority,
        due_date: dueDate,
        estimated_days: Number(estimatedDays),
        preferred_developer_id: preferredDeveloperId,
        notes: notes.trim() || null,
      },
      { onSuccess: onDone }
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-brand-100 bg-brand-50/40 p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Task name</label>
          <input
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            {PRIORITIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Due date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Estimated days</label>
          <input
            type="number"
            min={1}
            value={estimatedDays}
            onChange={(e) => setEstimatedDays(e.target.value)}
            className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Recommended developer</label>
          <div className="flex items-center gap-1">
            <Combobox
              options={preferredOptions}
              value={developers?.find((d) => d.id === preferredDeveloperId)?.name ?? ""}
              onChange={(v) => setPreferredDeveloperId(Number(v))}
              placeholder="None"
            />
            {preferredDeveloperId !== null && (
              <button
                type="button"
                onClick={() => setPreferredDeveloperId(null)}
                title="Clear preference"
                className="shrink-0 rounded p-1.5 text-slate-300 hover:bg-white hover:text-slate-500"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Notes</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" onClick={save} disabled={!canSave}>
          Save
        </Button>
      </div>
    </div>
  );
}

function ScoringDialog({
  assignmentId,
  taskName,
  onClose,
}: {
  assignmentId: number;
  taskName: string;
  onClose: () => void;
}) {
  const detail = useTaskSuggestionDetail();

  useEffect(() => {
    detail.mutate(assignmentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  return (
    <Dialog open onClose={onClose} title={`Scoring — ${taskName}`} width="max-w-xl">
      {detail.isPending && <p className="text-sm text-slate-400">Scoring candidates&hellip;</p>}
      {detail.data && (
        <div className="space-y-2">
          {detail.data.candidates.map((c, i) => (
            <div
              key={c.developerId}
              className={`rounded-lg border p-3 ${i === 0 ? "border-violet-200 bg-violet-50/40" : "border-surface-border"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">
                  {i + 1}. {c.developerName}
                </span>
                <span className="text-sm font-mono text-slate-500">score {c.score}</span>
              </div>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs text-slate-600">
                {c.reasons.map((r, ri) => (
                  <li key={ri}>{r}</li>
                ))}
              </ul>
              {!c.meetsDueDate && <p className="mt-1 text-xs font-medium text-amber-600">Misses the due date</p>}
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}

function ScheduleForm({
  item,
  suggestion,
  onDone,
}: {
  item: Assignment;
  suggestion: SuggestionCandidate | null;
  onDone: () => void;
}) {
  const { data: developers } = useDevelopers();
  const updateAssignment = useUpdateAssignment();
  const submitFeedback = useSubmitAIFeedback();

  const [developerId, setDeveloperId] = useState<number | null>(suggestion?.developerId ?? item.developer_id);
  const [startDate, setStartDate] = useState(suggestion?.suggestedStart ?? item.start_date ?? todayISO());
  const suggestedDuration = suggestion
    ? Math.round(
        (new Date(suggestion.suggestedEnd).getTime() - new Date(suggestion.suggestedStart).getTime()) / 86_400_000
      ) + 1
    : (item.estimated_days ?? item.duration_days ?? 1);
  const [duration, setDuration] = useState(suggestedDuration);
  const [conflicts, setConflicts] = useState<ConflictRow[]>([]);
  const [dayPart, setDayPart] = useState<DayPart>(suggestion?.suggestedDayPart ?? item.day_part ?? "FULL");

  const endDate = addDaysISO(startDate, duration - 1);
  const isSingleDay = startDate === endDate;

  useEffect(() => {
    if (!isSingleDay && dayPart !== "FULL") setDayPart("FULL");
  }, [isSingleDay, dayPart]);

  useEffect(() => {
    if (!developerId || !startDate || !endDate) {
      setConflicts([]);
      return;
    }
    const handle = setTimeout(() => {
      checkConflicts({
        developer_id: developerId,
        start_date: startDate,
        end_date: endDate,
        exclude_id: item.id,
        day_part: isSingleDay ? dayPart : undefined,
      })
        .then(setConflicts)
        .catch(() => setConflicts([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [developerId, startDate, endDate, item.id, isSingleDay, dayPart]);

  const developerOptions = (developers ?? []).map((d) => ({ value: String(d.id), label: d.name }));

  function save() {
    if (!developerId) return;
    updateAssignment.mutate(
      {
        id: item.id,
        developer_id: developerId,
        start_date: startDate,
        end_date: endDate,
        day_part: isSingleDay ? dayPart : "FULL",
      },
      {
        onSuccess: () => {
          if (suggestion && suggestion.developerId === developerId) {
            submitFeedback.mutate({ taskName: item.task_name, developerId, weight: 2 });
          }
          onDone();
        },
      }
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-brand-100 bg-brand-50/40 p-3">
      {suggestion && (
        <p className="mb-2 flex items-start gap-1 text-xs text-violet-700">
          <Sparkles size={12} className="mt-0.5 shrink-0" /> {suggestion.reasons.join(" · ")}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[160px] flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-500">Developer</label>
          <Combobox
            options={developerOptions}
            value={developers?.find((d) => d.id === developerId)?.name ?? ""}
            onChange={(v) => setDeveloperId(Number(v))}
            placeholder="Choose developer…"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Start date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-surface-border px-2 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Duration (days)</label>
          <input
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(Math.max(1, Number(e.target.value)))}
            className="w-20 rounded-lg border border-surface-border px-2 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        {isSingleDay && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">When</label>
            <DayPartToggle value={dayPart} onChange={setDayPart} />
          </div>
        )}
        <Button size="sm" onClick={save} disabled={!developerId}>
          Save
        </Button>
      </div>
      <div className="mt-2">
        <ConflictBanner conflicts={conflicts} developerName={developers?.find((d) => d.id === developerId)?.name} />
      </div>
    </div>
  );
}
