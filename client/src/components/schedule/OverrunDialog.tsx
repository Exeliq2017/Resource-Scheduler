import { useEffect, useState } from "react";
import clsx from "clsx";
import { AlertTriangle } from "lucide-react";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { useApplyOverrun, useOverrunPreview } from "../../api/hooks";
import type { Assignment } from "../../api/types";
import { formatDate } from "../../lib/formatDate";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDaysISO(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function OverrunDialog({ task, onClose }: { task: Assignment; onClose: () => void }) {
  const preview = useOverrunPreview();
  const apply = useApplyOverrun();
  const [extraDays, setExtraDays] = useState("");
  const [mode, setMode] = useState<"split" | "extend">("split");
  const [dueDate, setDueDate] = useState(task.due_date ?? addDaysISO(todayISO(), 7));

  const days = Number(extraDays);
  const valid = days >= 1;

  useEffect(() => {
    if (mode === "extend" && valid) preview.mutate({ assignment_id: task.id, extra_days: days });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, days, valid, task.id]);

  function confirmApply() {
    if (!valid) return;
    apply.mutate(
      { assignment_id: task.id, extra_days: days, mode, due_date: mode === "split" ? dueDate : undefined },
      { onSuccess: onClose }
    );
  }

  const plan = mode === "extend" ? preview.data : undefined;

  return (
    <Dialog open onClose={onClose} title={`Overran — ${task.task_name}`} width="max-w-xl">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">How many more working days does it need?</label>
          <input
            type="number"
            min={1}
            value={extraDays}
            onChange={(e) => setExtraDays(e.target.value)}
            className="w-28 rounded-lg border border-surface-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["split", "Split into backlog", "Close this task and re-plan the remainder"],
              ["extend", "Extend", "Stretch the end date, push later tasks forward"],
            ] as const
          ).map(([value, title, hint]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={clsx(
                "rounded-lg border p-3 text-left",
                mode === value ? "border-brand-400 bg-brand-50" : "border-surface-border hover:bg-surface-muted"
              )}
            >
              <div className="text-sm font-medium text-slate-800">{title}</div>
              <div className="text-xs text-slate-500">{hint}</div>
            </button>
          ))}
        </div>

        {mode === "split" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Due date for the remainder</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-lg border border-surface-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
            <p className="mt-1 text-xs text-slate-400">
              The remainder goes to the backlog with {task.developer_name} as recommended developer.
            </p>
          </div>
        )}

        {mode === "extend" && valid && (
          <div className="space-y-2">
            {preview.isPending && <p className="text-sm text-slate-400">Calculating&hellip;</p>}
            {plan && (
              <>
                <p className="text-sm text-slate-600">
                  New end date: <span className="font-medium">{formatDate(plan.newEnd)}</span>
                </p>
                {plan.moves.length === 0 ? (
                  <p className="text-sm text-slate-500">No later tasks need to move.</p>
                ) : (
                  <ul className="space-y-1 text-sm text-slate-700">
                    {plan.moves.map((m) => (
                      <li key={m.id} className="rounded bg-surface-muted px-3 py-1.5">
                        <span className="font-medium">{m.taskName}</span>: {formatDate(m.oldStart)} &ndash; {formatDate(m.oldEnd)}{" "}
                        &rarr; {formatDate(m.newStart)} &ndash; {formatDate(m.newEnd)}
                      </li>
                    ))}
                  </ul>
                )}
                {plan.warnings.length > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <ul className="space-y-1">
                      {plan.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={confirmApply} disabled={!valid || apply.isPending || (mode === "split" && !dueDate)}>
          {mode === "split" ? "Split to backlog" : plan && plan.warnings.length > 0 ? "Extend anyway" : "Extend"}
        </Button>
      </div>
    </Dialog>
  );
}
