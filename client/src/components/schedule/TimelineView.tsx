import { useMemo, useState } from "react";
import clsx from "clsx";
import { useScheduleGrid, useUpdateAssignment } from "../../api/hooks";
import type { AssignmentRef, GridCell, GridRow, HalfState } from "../../api/types";
import { AssignmentEditDialog } from "./AssignmentEditDialog";
import { formatDate } from "../../lib/formatDate";

const DAY_WIDTH = 34;
const ROW_HEIGHT = 46;
const HEADER_HEIGHT = 44;
const LABEL_WIDTH = 160;

type Half = "FULL" | "AM" | "PM";

export interface Segment {
  startIndex: number;
  span: number;
  half: Half;
  state: HalfState;
  assignment: AssignmentRef;
  /** 0 when this is the only task in its time slot; 1, 2, ... when double-booked, stacking below lane 0. */
  lane: number;
  /** True when this segment's dates overlap another task for the same developer — flagged visually. */
  overlapping: boolean;
}

/** Do two segments occupy any of the same half-day? A FULL segment occupies both AM and PM. */
function segmentsOverlap(a: Segment, b: Segment): boolean {
  const rangeOverlap = a.startIndex <= b.startIndex + b.span - 1 && b.startIndex <= a.startIndex + a.span - 1;
  if (!rangeOverlap) return false;
  const halvesOf = (s: Segment) => (s.half === "FULL" ? ["AM", "PM"] : [s.half]);
  return halvesOf(a).some((h) => halvesOf(b).includes(h));
}

/**
 * Greedily stacks overlapping segments into lanes (like a calendar's side-by-side event columns),
 * so a double-booked developer shows both tasks clearly instead of one hiding the other. Segments
 * that don't overlap anything share lane 0, matching the original single-lane layout exactly.
 */
function assignLanes(segments: Segment[]): number {
  const sorted = [...segments].sort((a, b) => a.startIndex - b.startIndex || b.span - a.span);
  const laneLast: Segment[] = [];
  for (const seg of sorted) {
    const laneIndex = laneLast.findIndex((last) => !segmentsOverlap(last, seg));
    if (laneIndex === -1) {
      seg.lane = laneLast.length;
      laneLast.push(seg);
    } else {
      seg.lane = laneIndex;
      laneLast[laneIndex] = seg;
    }
  }
  return laneLast.length || 1;
}

/**
 * Full-day assignments populate both halves of every covered day identically and are merged
 * into one multi-day block. AM/PM assignments only ever cover a single day, so each one is its
 * own segment. A developer can be double-booked (allowed with a warning elsewhere), so a cell may
 * carry more than one assignment — each gets its own segment, and `assignLanes` keeps overlapping
 * ones from being drawn on top of each other.
 */
export function toSegments(cells: GridCell[]): { segments: Segment[]; laneCount: number } {
  const segments: Segment[] = [];
  const seen = new Set<number>();

  cells.forEach((cell, i) => {
    for (const a of cell.am.assignments) {
      if (a.dayPart !== "FULL" && a.dayPart !== "AM") continue;
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      if (a.dayPart === "FULL") {
        let span = 1;
        while (i + span < cells.length && cells[i + span].am.assignments.some((x) => x.id === a.id)) span++;
        segments.push({ startIndex: i, span, half: "FULL", state: cell.am.state, assignment: a, lane: 0, overlapping: false });
      } else {
        segments.push({ startIndex: i, span: 1, half: "AM", state: cell.am.state, assignment: a, lane: 0, overlapping: false });
      }
    }
    for (const a of cell.pm.assignments) {
      if (a.dayPart !== "PM" || seen.has(a.id)) continue;
      seen.add(a.id);
      segments.push({ startIndex: i, span: 1, half: "PM", state: cell.pm.state, assignment: a, lane: 0, overlapping: false });
    }
  });

  for (const seg of segments) {
    seg.overlapping = segments.some((other) => other !== seg && segmentsOverlap(seg, other));
  }
  const laneCount = assignLanes(segments);
  return { segments, laneCount };
}

function halfBackground(state: HalfState, isToday: boolean): string {
  if (state === "OFF") return "bg-state-offBg";
  if (state === "LEAVE") return "bg-state-leaveBg";
  return isToday ? "bg-brand-50/50" : "";
}

function addDaysISO(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDay(iso: string) {
  const d = new Date(iso);
  return { num: d.getDate(), dow: ["S", "M", "T", "W", "T", "F", "S"][d.getDay()] };
}

// Double-booking is allowed (a developer may juggle two tasks at their own discretion) — this is
// never blocking, just a heads-up after the drag/resize already saved.
function warnIfConflicts(updated: { conflicts?: { id: number }[] }, developerName?: string) {
  if (updated.conflicts && updated.conflicts.length > 0) {
    alert(`Heads up: this now overlaps ${updated.conflicts.length} other task(s) for ${developerName ?? "this developer"} — both are kept.`);
  }
}

export function TimelineView() {
  const [days, setDays] = useState(35);
  const { data, isLoading } = useScheduleGrid(days);
  const updateAssignment = useUpdateAssignment();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [drag, setDrag] = useState<{
    developerId: number;
    assignmentId: number;
    mode: "move" | "resize";
    startX: number;
    startIndex: number;
    span: number;
    offsetDays: number;
  } | null>(null);

  const todayIndex = 0; // grid always starts at today

  function beginDrag(
    e: React.MouseEvent,
    mode: "move" | "resize",
    developerId: number,
    assignmentId: number,
    startIndex: number,
    span: number
  ) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    setDrag({ developerId, assignmentId, mode, startX, startIndex, span, offsetDays: 0 });

    function onMove(ev: MouseEvent) {
      const deltaPx = ev.clientX - startX;
      const deltaDays = Math.round(deltaPx / DAY_WIDTH);
      setDrag((prev) => (prev ? { ...prev, offsetDays: deltaDays } : prev));
    }
    function onUp(ev: MouseEvent) {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const deltaPx = ev.clientX - startX;
      const deltaDays = Math.round(deltaPx / DAY_WIDTH);
      setDrag(null);
      if (deltaDays === 0 || !data) return;

      const assignment = data.rows
        .flatMap((r) => r.cells)
        .flatMap((c) => [...c.am.assignments, ...c.pm.assignments])
        .find((a) => a.id === assignmentId);
      if (!assignment) return;

      const devName = data.rows.find((r) => r.developer.id === developerId)?.developer.name;

      if (mode === "move") {
        updateAssignment.mutate(
          {
            id: assignmentId,
            start_date: addDaysISO(assignment.startDate, deltaDays),
            end_date: addDaysISO(assignment.endDate, deltaDays),
          },
          {
            onSuccess: (updated) => warnIfConflicts(updated, devName),
            onError: () => alert("Could not move task."),
          }
        );
      } else {
        const newSpan = Math.max(1, span + deltaDays);
        updateAssignment.mutate(
          { id: assignmentId, end_date: addDaysISO(assignment.startDate, newSpan - 1) },
          {
            onSuccess: (updated) => warnIfConflicts(updated, devName),
            onError: () => alert("Could not resize task."),
          }
        );
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const rowsWithSegments = useMemo(
    () => data?.rows.map((row: GridRow) => ({ row, ...toSegments(row.cells) })) ?? [],
    [data]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {[14, 35, 60].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={clsx(
              "rounded-lg px-3 py-1.5 text-sm font-medium",
              days === d ? "bg-brand-50 text-brand-700" : "bg-white text-slate-500 ring-1 ring-surface-border hover:text-slate-700"
            )}
          >
            {d} days
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
          <Legend swatch="bg-state-busyBg ring-state-busy" label="Busy" />
          <Legend swatch="bg-state-urgentBg ring-state-urgent" label="Urgent" />
          <Legend swatch="bg-amber-100 ring-2 ring-amber-400" label="Double-booked" />
          <Legend swatch="bg-state-freeBg ring-state-free" label="Free" />
          <Legend swatch="bg-state-leaveBg ring-state-leave" label="Leave" />
          <Legend swatch="bg-state-offBg ring-slate-300" label="Off" />
        </div>
      </div>

      {isLoading || !data ? (
        <div className="text-sm text-slate-400">Loading&hellip;</div>
      ) : (
        <div className="flex overflow-hidden rounded-xl border border-surface-border bg-white shadow-card">
          <div className="shrink-0 border-r border-surface-border" style={{ width: LABEL_WIDTH }}>
            <div className="flex items-center border-b border-surface-border px-3 text-xs font-medium uppercase tracking-wide text-slate-500" style={{ height: HEADER_HEIGHT }}>
              Developer
            </div>
            {rowsWithSegments.map(({ row, laneCount }) => (
              <div
                key={row.developer.id}
                className="flex items-center border-b border-surface-border px-3 text-sm font-medium text-slate-800"
                style={{ height: ROW_HEIGHT * laneCount }}
              >
                {row.developer.name}
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <div style={{ width: data.dates.length * DAY_WIDTH }}>
              <div className="flex border-b border-surface-border" style={{ height: HEADER_HEIGHT }}>
                {data.dates.map((date, i) => {
                  const { num, dow } = formatDay(date);
                  return (
                    <div
                      key={date}
                      style={{ width: DAY_WIDTH }}
                      className={clsx(
                        "flex flex-col items-center justify-center text-[10px] leading-tight",
                        i === todayIndex ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-400"
                      )}
                    >
                      <span>{dow}</span>
                      <span>{num}</span>
                    </div>
                  );
                })}
              </div>

              {rowsWithSegments.map(({ row, segments, laneCount }) => {
                const rowHeight = ROW_HEIGHT * laneCount;
                return (
                  <div key={row.developer.id} className="relative border-b border-surface-border" style={{ height: rowHeight }}>
                    {row.cells.map((cell, i) => (
                      <div
                        key={cell.date}
                        style={{ position: "absolute", left: i * DAY_WIDTH, top: 0, width: DAY_WIDTH, height: "100%" }}
                        className="border-r border-surface-border/60"
                      >
                        {cell.am.assignments.length === 0 && (
                          <div
                            title={cell.am.state === "LEAVE" ? `On leave${cell.am.leaveReason ? ` — ${cell.am.leaveReason}` : ""}` : undefined}
                            className={clsx("absolute inset-x-0 top-0 h-1/2", halfBackground(cell.am.state, i === todayIndex))}
                          />
                        )}
                        {cell.pm.assignments.length === 0 && (
                          <div
                            title={cell.pm.state === "LEAVE" ? `On leave${cell.pm.leaveReason ? ` — ${cell.pm.leaveReason}` : ""}` : undefined}
                            className={clsx("absolute inset-x-0 bottom-0 h-1/2", halfBackground(cell.pm.state, i === todayIndex))}
                          />
                        )}
                      </div>
                    ))}

                    {segments.map((seg) => {
                      const isDraggingThis = drag?.assignmentId === seg.assignment.id;
                      const offset = isDraggingThis ? drag.offsetDays : 0;
                      const left = (seg.startIndex + (drag?.mode === "move" && isDraggingThis ? offset : 0)) * DAY_WIDTH;
                      const width = (seg.span + (drag?.mode === "resize" && isDraggingThis ? offset : 0)) * DAY_WIDTH;
                      const urgent = seg.state === "URGENT";
                      const isHalf = seg.half !== "FULL";
                      const laneTop = seg.lane * ROW_HEIGHT;
                      const top = laneTop + (isHalf ? (seg.half === "AM" ? 2 : ROW_HEIGHT / 2 + 1) : 5);
                      const height = isHalf ? ROW_HEIGHT / 2 - 3 : ROW_HEIGHT - 10;
                      return (
                        <div
                          key={`${seg.assignment.id}-${seg.half}`}
                          onMouseDown={(e) => beginDrag(e, "move", row.developer.id, seg.assignment.id, seg.startIndex, seg.span)}
                          onClick={(e) => {
                            if (!isDraggingThis) setEditingId(seg.assignment.id);
                            e.stopPropagation();
                          }}
                          style={{ position: "absolute", left, top, width: Math.max(width - 3, DAY_WIDTH - 3), height }}
                          className={clsx(
                            "group flex cursor-grab items-center overflow-hidden rounded-md px-2 text-xs font-medium shadow-sm ring-1 active:cursor-grabbing",
                            urgent
                              ? "bg-state-urgentBg text-orange-800 ring-state-urgent"
                              : seg.overlapping
                                ? "bg-amber-100 text-amber-900 ring-2 ring-amber-400"
                                : "bg-state-busyBg text-brand-800 ring-brand-300"
                          )}
                          title={`${seg.assignment.taskName} (${formatDate(seg.assignment.startDate)} → ${formatDate(seg.assignment.endDate)})${isHalf ? ` — ${seg.half}` : ""}${seg.overlapping ? " — double-booked" : ""}`}
                        >
                          <span className="truncate">{seg.assignment.taskName}</span>
                          {!isHalf && (
                            <div
                              onMouseDown={(e) => beginDrag(e, "resize", row.developer.id, seg.assignment.id, seg.startIndex, seg.span)}
                              className="absolute right-0 top-0 h-full w-2 cursor-ew-resize opacity-0 group-hover:opacity-100"
                            >
                              <div className="mx-auto h-full w-0.5 bg-current opacity-40" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {editingId !== null && <AssignmentEditDialog assignmentId={editingId} onClose={() => setEditingId(null)} />}
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
