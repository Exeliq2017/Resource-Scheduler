import { useEffect, useState } from "react";
import clsx from "clsx";
import { Zap, RotateCcw, CheckCircle2 } from "lucide-react";
import { PageHeader } from "../layout/AppShell";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import {
  useApplyUrgentShift,
  useDevelopers,
  usePreviewUrgentShift,
  useUndoUrgentShift,
} from "../../api/hooks";
import type { ApplyUrgentShiftResult } from "../../api/types";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MODES = [
  { value: "Shift" as const, label: "Shift", blurb: "Pause the ongoing task, resume after — all future tasks slide forward." },
  { value: "Split" as const, label: "Split", blurb: "Cut the ongoing task short now, add a follow-up row for the remainder later." },
];

export function UrgentReassignmentPage() {
  const { data: developers } = useDevelopers();
  const [developerId, setDeveloperId] = useState<number | "">("");
  const [taskName, setTaskName] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [duration, setDuration] = useState(1);
  const [mode, setMode] = useState<"Shift" | "Split">("Shift");

  const preview = usePreviewUrgentShift();
  const apply = useApplyUrgentShift();
  const undo = useUndoUrgentShift();
  const [applied, setApplied] = useState<ApplyUrgentShiftResult | null>(null);
  const [undone, setUndone] = useState(false);

  const ready = developerId !== "" && taskName.trim() && startDate && duration > 0;

  useEffect(() => {
    if (!ready) return;
    const handle = setTimeout(() => {
      preview.mutate({
        developer_id: Number(developerId),
        urgent_start: startDate,
        urgent_duration_days: duration,
        mode,
      });
    }, 200);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [developerId, startDate, duration, mode, ready]);

  function handleApply() {
    if (!ready) return;
    apply.mutate(
      { developer_id: Number(developerId), task_name: taskName.trim(), urgent_start: startDate, urgent_duration_days: duration, mode },
      { onSuccess: (result) => { setApplied(result); setUndone(false); } }
    );
  }

  function handleUndo() {
    if (!applied) return;
    undo.mutate(applied, { onSuccess: () => setUndone(true) });
  }

  const developerName = developers?.find((d) => d.id === developerId)?.name;

  return (
    <div>
      <PageHeader
        title="Urgent Reassignment"
        subtitle="Insert urgent work and automatically reshuffle the affected schedule — no macros, no manual retyping."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2 h-fit">
          <h3 className="mb-4 text-sm font-semibold text-slate-800">1. Urgent task details</h3>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Developer to assign</label>
              <select
                value={developerId}
                onChange={(e) => setDeveloperId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              >
                <option value="">Choose developer&hellip;</option>
                {developers?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Urgent task name</label>
              <input
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="e.g. LG Work"
                className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Start date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Duration (calendar days)</label>
                <input
                  type="number"
                  min={1}
                  value={duration}
                  onChange={(e) => setDuration(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Insert mode</label>
              <div className="space-y-2">
                {MODES.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMode(m.value)}
                    className={clsx(
                      "w-full rounded-lg border p-3 text-left text-sm transition-colors",
                      mode === m.value ? "border-brand-400 bg-brand-50" : "border-surface-border hover:bg-surface-muted"
                    )}
                  >
                    <div className="font-medium text-slate-800">{m.label}</div>
                    <div className="text-xs text-slate-500">{m.blurb}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button className="mt-5 w-full" onClick={handleApply} disabled={!ready || apply.isPending || !!applied}>
            <Zap size={15} /> Apply Urgent Reassignment
          </Button>

          {applied && !undone && (
            <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <span className="flex items-center gap-1.5"><CheckCircle2 size={15} /> Applied successfully</span>
              <button onClick={handleUndo} className="flex items-center gap-1 font-medium underline hover:no-underline">
                <RotateCcw size={13} /> Undo
              </button>
            </div>
          )}
          {undone && <div className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">Change undone.</div>}
        </Card>

        <Card className="lg:col-span-3 h-fit">
          <h3 className="mb-4 text-sm font-semibold text-slate-800">2. Affected tasks — live preview</h3>
          {!ready ? (
            <p className="text-sm text-slate-400">Fill in the developer, task, start date, and duration to see the preview.</p>
          ) : preview.isPending && !preview.data ? (
            <p className="text-sm text-slate-400">Calculating&hellip;</p>
          ) : preview.data && preview.data.affected.length === 0 ? (
            <p className="text-sm text-slate-500">
              No existing tasks are affected — {developerName} has nothing scheduled during or after this window.
            </p>
          ) : (
            <div className="space-y-3">
              {preview.data?.affected.map((row) => (
                <div key={row.id} className="rounded-lg border border-surface-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-800">{row.taskName}</span>
                    <Badge tone={row.type === "ONGOING" ? "brand" : "default"}>{row.type}</Badge>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
                    <span className="line-through">{row.currentStart} &rarr; {row.currentEnd}</span>
                    <span>&rarr;</span>
                    <span className="font-medium text-slate-700">{row.newStart} &rarr; {row.newEnd}</span>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">{row.action}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
