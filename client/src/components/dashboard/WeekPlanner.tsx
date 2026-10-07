import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import { CalendarRange, Check, ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge, PriorityBadge } from "../ui/Badge";
import { AssignmentEditDialog } from "../schedule/AssignmentEditDialog";
import { toSegments, type Segment } from "../schedule/TimelineView";
import { usePlanner, useSubmitAIFeedback, useUpdateAssignment } from "../../api/hooks";
import type { PlannerDeveloper, PlannerProposal } from "../../api/types";
import { formatDate } from "../../lib/formatDate";

const LABEL_WIDTH = 170;
const ROW_HEIGHT = 58;
const HEADER_HEIGHT = 44;

function dayWidthFor(days: number): number {
  if (days <= 7) return 108;
  if (days <= 10) return 88;
  if (days <= 14) return 66;
  return 50;
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  return { dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()], text: formatDate(iso).slice(0, 5) };
}

export function WeekPlanner() {
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0);
  const [dismissed, setDismissed] = useState<number[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | "all" | null>(null);

  const { data, isLoading } = usePlanner(offset, dismissed);
  const updateAssignment = useUpdateAssignment();
  const submitFeedback = useSubmitAIFeedback();

  const proposals = useMemo(
    () => (data?.developers ?? []).flatMap((d) => d.proposals).sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0)),
    [data]
  );

  const rowsById = useMemo(
    () => new Map((data?.developers ?? []).map((dev) => [dev.developer.id, toSegments(dev.cells)])),
    [data]
  );

  async function accept(p: PlannerProposal): Promise<boolean> {
    try {
      const updated = await updateAssignment.mutateAsync({
        id: p.assignmentId,
        developer_id: p.developerId,
        start_date: p.start,
        end_date: p.end,
        day_part: "FULL",
      });
      submitFeedback.mutate({ taskName: p.taskName, developerId: p.developerId, weight: 2 });
      if (updated.conflicts && updated.conflicts.length > 0) {
        alert(`Heads up: "${p.taskName}" now overlaps ${updated.conflicts.length} other task(s) for ${p.developerName} — both are kept.`);
      }
      return true;
    } catch {
      alert(`Could not schedule "${p.taskName}".`);
      return false;
    }
  }

  async function acceptOne(p: PlannerProposal) {
    setBusyId(p.assignmentId);
    await accept(p);
    setBusyId(null);
  }

  function dismiss(id: number) {
    setDismissed((ids) => [...ids, id].sort((a, b) => a - b));
  }

  async function acceptAll() {
    setBusyId("all");
    for (const p of proposals) {
      if (!(await accept(p))) break;
    }
    setBusyId(null);
  }

  if (isLoading || !data) {
    return (
      <Card>
        <p className="text-sm text-slate-400">Loading planner&hellip;</p>
      </Card>
    );
  }

  const dayWidth = dayWidthFor(data.windowDays);
  const closedDates = new Set(data.days.filter((d) => d.closed).map((d) => d.date));
  const rangeLabel =
    offset === 0
      ? `Next ${data.windowDays} days`
      : `Days ${offset * data.windowDays + 1}–${(offset + 1) * data.windowDays} ahead`;

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <CalendarRange size={16} className="text-brand-600" />
          <h3 className="text-sm font-semibold text-slate-800">Look-ahead planner</h3>
          <span className="text-xs text-slate-400">
            {rangeLabel} &middot; {formatDate(data.windowStart)} &rarr; {formatDate(data.windowEnd)}
          </span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">
            <span className="font-medium text-state-free">{data.summary.freeDays}</span> free day
            {data.summary.freeDays === 1 ? "" : "s"} across the team &middot;{" "}
            <span className="font-medium text-violet-600">{data.summary.proposedDays}</span> filled by suggestions
          </span>
          <button
            onClick={() => setOffset((o) => Math.max(0, o - 1))}
            disabled={offset === 0}
            title="Earlier"
            className="rounded-lg p-1.5 text-slate-500 ring-1 ring-surface-border hover:bg-surface-muted disabled:opacity-40"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => setOffset((o) => Math.min(data.maxOffset, o + 1))}
            disabled={offset >= data.maxOffset}
            title="Later"
            className="rounded-lg p-1.5 text-slate-500 ring-1 ring-surface-border hover:bg-surface-muted disabled:opacity-40"
          >
            <ChevronRight size={14} />
          </button>
          <button onClick={() => navigate("/settings")} className="text-xs text-slate-400 hover:text-brand-600 hover:underline">
            Change window
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <Legend swatch="bg-state-busyBg ring-brand-300" label="Task" />
        <Legend swatch="bg-state-urgentBg ring-state-urgent" label="Urgent" />
        <Legend swatch="bg-amber-100 ring-2 ring-amber-400" label="Double-booked" />
        <Legend swatch="bg-state-leaveBg ring-state-leave" label="Leave" />
        <Legend swatch="bg-state-offBg ring-slate-300" label="Off" />
        <Legend swatch="bg-state-freeBg/50 ring-state-free" label="Free" />
        <Legend swatch="bg-violet-100 ring-violet-400" label="Suggested" />
        {data.days.some((d) => d.closed) && <Legend swatch="bg-slate-200 ring-slate-300" label="Closed (past 5 PM)" />}
      </div>

      <div className="flex overflow-hidden rounded-xl border border-surface-border">
        <div className="shrink-0 border-r border-surface-border" style={{ width: LABEL_WIDTH }}>
          <div
            className="flex items-center border-b border-surface-border px-3 text-xs font-medium uppercase tracking-wide text-slate-500"
            style={{ height: HEADER_HEIGHT }}
          >
            Developer
          </div>
          {data.developers.map((dev) => (
            <DeveloperLabel key={dev.developer.id} dev={dev} laneCount={rowsById.get(dev.developer.id)?.laneCount ?? 1} />
          ))}
        </div>

        <div className="overflow-x-auto">
          <div style={{ width: data.days.length * dayWidth }}>
            <div className="flex border-b border-surface-border" style={{ height: HEADER_HEIGHT }}>
              {data.days.map((day, i) => {
                const { dow, text } = dayLabel(day.date);
                const isToday = offset === 0 && i === 0;
                return (
                  <div
                    key={day.date}
                    style={{ width: dayWidth }}
                    className={clsx(
                      "flex flex-col items-center justify-center text-[11px] leading-tight",
                      day.closed ? "bg-slate-200/70 text-slate-400" : isToday ? "bg-brand-50 font-semibold text-brand-700" : day.isWorkingDay ? "text-slate-500" : "bg-state-offBg text-slate-400"
                    )}
                  >
                    <span>{dow}</span>
                    <span>{text}</span>
                  </div>
                );
              })}
            </div>

            {data.developers.map((dev) => (
              <PlannerRow
                key={dev.developer.id}
                dev={dev}
                segments={rowsById.get(dev.developer.id)?.segments ?? []}
                laneCount={rowsById.get(dev.developer.id)?.laneCount ?? 1}
                windowStart={data.windowStart}
                windowEnd={data.windowEnd}
                dayWidth={dayWidth}
                closedDates={closedDates}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onEditTask={setEditingId}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Sparkles size={15} className="text-violet-600" />
          <h4 className="text-sm font-semibold text-slate-800">Suggested fills from the backlog</h4>
          <div className="ml-auto flex items-center gap-2">
            {dismissed.length > 0 && (
              <button onClick={() => setDismissed([])} className="text-xs text-slate-400 hover:text-brand-600 hover:underline">
                Show {dismissed.length} dismissed
              </button>
            )}
            <button onClick={() => navigate("/schedule")} className="text-xs text-slate-400 hover:text-brand-600 hover:underline">
              Adjust in Schedule &rarr;
            </button>
            {proposals.length > 1 && (
              <Button size="sm" onClick={acceptAll} disabled={busyId !== null}>
                <Check size={13} /> Accept all ({proposals.length})
              </Button>
            )}
          </div>
        </div>

        {proposals.length === 0 ? (
          <p className="text-sm text-slate-400">
            {data.summary.freeDays === 0
              ? "No free slots in this window — nothing to fill."
              : "No backlog task fits the free slots in this window."}
          </p>
        ) : (
          <ProposalsTable
            items={proposals}
            selectedId={selectedId}
            disabled={busyId !== null}
            onSelect={(id) => setSelectedId(id === selectedId ? null : id)}
            onAccept={acceptOne}
            onDismiss={dismiss}
          />
        )}

        {data.later.length > 0 && (
          <div className="mt-4">
            <h4 className="mb-1 text-sm font-semibold text-slate-800">Waiting for their preferred developer</h4>
            <p className="mb-2 text-xs text-slate-500">
              These go to their preferred developer, who has no free slot in this window — so they are not given to anyone else.
            </p>
            <ProposalsTable
              items={data.later}
              selectedId={null}
              disabled={busyId !== null}
              onSelect={() => undefined}
              onAccept={acceptOne}
              onDismiss={dismiss}
            />
          </div>
        )}

        {data.unplaced.length > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            <span className="font-medium text-slate-600">No slot in this window:</span>{" "}
            {data.unplaced.map((u) => u.taskName).join(", ")}
          </p>
        )}
      </div>

      {editingId !== null && <AssignmentEditDialog assignmentId={editingId} onClose={() => setEditingId(null)} />}
    </Card>
  );
}

function ProposalsTable({
  items,
  selectedId,
  disabled,
  onSelect,
  onAccept,
  onDismiss,
}: {
  items: PlannerProposal[];
  selectedId: number | null;
  disabled: boolean;
  onSelect: (id: number) => void;
  onAccept: (p: PlannerProposal) => void;
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-surface-border">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-[27%]" />
          <col className="w-[8%]" />
          <col className="w-[13%]" />
          <col className="w-[17%]" />
          <col className="w-[13%]" />
          <col className="w-[22%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-surface-border bg-surface-muted text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">Task</th>
            <th className="px-2 py-2">Priority</th>
            <th className="px-2 py-2">Developer</th>
            <th className="px-2 py-2">Dates</th>
            <th className="px-2 py-2">Due</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border">
          {items.map((p) => {
            const selected = selectedId === p.assignmentId;
            return (
              <tr
                key={p.assignmentId}
                onClick={() => onSelect(p.assignmentId)}
                className={clsx("cursor-pointer align-top", selected ? "bg-violet-50" : "hover:bg-surface-muted/60")}
              >
                <td className="px-3 py-2">
                  <div className="truncate text-sm font-medium text-slate-800" title={p.taskName}>
                    {p.taskName}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-slate-400" title={p.reasons.join(" · ")}>
                    {p.reasons.join(" · ")}
                  </div>
                </td>
                <td className="whitespace-nowrap px-2 py-2">
                  <PriorityBadge priority={p.priority} />
                </td>
                <td className="truncate px-2 py-2 text-sm text-violet-700" title={p.developerName}>
                  {p.developerName}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-xs text-slate-500">
                  {formatDate(p.start)} &ndash; {formatDate(p.end)} ({p.estimatedDays}d)
                </td>
                <td className="whitespace-nowrap px-2 py-2">
                  {p.dueDate ? (
                    <Badge tone={p.meetsDueDate ? "success" : "danger"}>
                      {p.meetsDueDate ? formatDate(p.dueDate) : `misses ${formatDate(p.dueDate)}`}
                    </Badge>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm" onClick={() => onAccept(p)} disabled={disabled}>
                      <Check size={13} /> Accept
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => onDismiss(p.assignmentId)} disabled={disabled}>
                      <X size={13} />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DeveloperLabel({ dev, laneCount }: { dev: PlannerDeveloper; laneCount: number }) {
  const remaining = dev.freeWorkingDays - dev.proposedWorkingDays;
  return (
    <div className="flex flex-col justify-center gap-0.5 border-b border-surface-border px-3" style={{ height: ROW_HEIGHT * laneCount }}>
      <div className="flex items-center gap-1.5">
        <span className="truncate text-sm font-medium text-slate-800">{dev.developer.name}</span>
        {dev.developer.excludeFromSuggestions && <Badge tone="lead">Lead</Badge>}
      </div>
      <div className="text-[11px] leading-tight text-slate-400">
        {dev.freeWorkingDays === 0 ? (
          <span>{dev.leaveDays > 0 && dev.busyWorkingDays === 0 ? "On leave" : "Fully booked"}</span>
        ) : (
          <span className="text-state-free">
            {dev.freeWorkingDays} free day{dev.freeWorkingDays === 1 ? "" : "s"}
          </span>
        )}
        {dev.proposedWorkingDays > 0 && (
          <span className="text-violet-600">
            {" "}
            &middot; {remaining <= 0 ? "all filled" : `${remaining} left`}
          </span>
        )}
      </div>
    </div>
  );
}

function PlannerRow({
  dev,
  segments,
  laneCount,
  windowStart,
  windowEnd,
  dayWidth,
  closedDates,
  selectedId,
  onSelect,
  onEditTask,
}: {
  dev: PlannerDeveloper;
  segments: Segment[];
  laneCount: number;
  windowStart: string;
  windowEnd: string;
  dayWidth: number;
  closedDates: Set<string>;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onEditTask: (id: number) => void;
}) {
  const rowHeight = ROW_HEIGHT * laneCount;

  return (
    <div className="relative border-b border-surface-border" style={{ height: rowHeight }}>
      {dev.cells.map((cell, i) => {
        const closed = closedDates.has(cell.date) && cell.am.state === "FREE" && cell.pm.state === "FREE";
        const free = !closed && cell.am.state === "FREE" && cell.pm.state === "FREE";
        const leave = cell.am.state === "LEAVE";
        return (
          <div
            key={cell.date}
            style={{ position: "absolute", left: i * dayWidth, top: 0, width: dayWidth, height: "100%" }}
            className={clsx(
              "border-r border-surface-border/60",
              cell.am.state === "OFF" && "bg-state-offBg",
              leave && "bg-state-leaveBg",
              free && "bg-state-freeBg/40",
              closed && "bg-slate-200/70"
            )}
            title={
              leave
                ? `On leave${cell.am.leaveReason ? ` — ${cell.am.leaveReason}` : ""}`
                : free
                  ? "Free"
                  : closed
                    ? "Past 5 PM — nothing is suggested for the rest of today"
                    : undefined
            }
          >
            {leave && <span className="flex h-full items-center justify-center text-[11px] font-medium text-purple-700">Leave</span>}
            {free && <span className="flex h-full items-center justify-center text-[11px] text-state-free/70">free</span>}
          </div>
        );
      })}

      {segments.map((seg) => {
        const isHalf = seg.half !== "FULL";
        const laneTop = seg.lane * ROW_HEIGHT;
        const top = laneTop + (isHalf ? (seg.half === "AM" ? 3 : ROW_HEIGHT / 2 + 1) : 6);
        const height = isHalf ? ROW_HEIGHT / 2 - 4 : ROW_HEIGHT - 12;
        const urgent = seg.state === "URGENT";
        return (
          <button
            key={`${seg.assignment.id}-${seg.half}`}
            onClick={() => onEditTask(seg.assignment.id)}
            style={{ position: "absolute", left: seg.startIndex * dayWidth + 2, top, width: seg.span * dayWidth - 4, height }}
            className={clsx(
              "flex items-center overflow-hidden rounded-md px-2 text-left text-xs font-medium shadow-sm ring-1 hover:brightness-95",
              urgent
                ? "bg-state-urgentBg text-orange-800 ring-state-urgent"
                : seg.overlapping
                  ? "bg-amber-100 text-amber-900 ring-2 ring-amber-400"
                  : "bg-state-busyBg text-brand-800 ring-brand-300"
            )}
            title={`${seg.assignment.taskName} (${formatDate(seg.assignment.startDate)} → ${formatDate(seg.assignment.endDate)})${isHalf ? ` — ${seg.half}` : ""}${seg.overlapping ? " — double-booked" : ""}`}
          >
            <span className="truncate">{seg.assignment.taskName}</span>
          </button>
        );
      })}

      {dev.proposals.map((p) => {
        const startIndex = Math.max(0, daysBetween(windowStart, p.start));
        const endIndex = Math.min(daysBetween(windowStart, windowEnd), daysBetween(windowStart, p.end));
        const span = endIndex - startIndex + 1;
        if (span < 1) return null;
        const selected = selectedId === p.assignmentId;
        return (
          <button
            key={p.assignmentId}
            onClick={() => onSelect(selected ? null : p.assignmentId)}
            style={{ position: "absolute", left: startIndex * dayWidth + 2, top: 6, width: span * dayWidth - 4, height: ROW_HEIGHT - 12 }}
            className={clsx(
              "flex items-center gap-1 overflow-hidden rounded-md border-2 border-dashed px-2 text-left text-xs font-medium",
              selected ? "border-violet-500 bg-violet-200 text-violet-900" : "border-violet-400 bg-violet-100/80 text-violet-800 hover:bg-violet-100"
            )}
            title={`Suggested: ${p.taskName} (${formatDate(p.start)} → ${formatDate(p.end)})`}
          >
            <Sparkles size={11} className="shrink-0" />
            <span className="truncate">{p.taskName}</span>
          </button>
        );
      })}
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={clsx("h-3 w-3 rounded ring-1", swatch)} />
      {label}
    </div>
  );
}
