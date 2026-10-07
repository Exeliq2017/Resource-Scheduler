import { useEffect, useState } from "react";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { DayPartToggle } from "./DayPartToggle";
import { useAssignments, useDeleteAssignment, useMoveToBacklog, useUpdateAssignment } from "../../api/hooks";
import type { DayPart, Priority, Status } from "../../api/types";

const PRIORITIES: Priority[] = ["High", "Medium", "Low"];
const STATUSES: Status[] = ["Planned", "Ongoing", "On Hold", "Completed"];

export function AssignmentEditDialog({ assignmentId, onClose }: { assignmentId: number; onClose: () => void }) {
  const { data: assignments } = useAssignments();
  const updateAssignment = useUpdateAssignment();
  const deleteAssignment = useDeleteAssignment();
  const moveToBacklog = useMoveToBacklog();
  const assignment = assignments?.find((a) => a.id === assignmentId);

  const [form, setForm] = useState(assignment);
  useEffect(() => setForm(assignment), [assignment]);

  if (!form) {
    return (
      <Dialog open onClose={onClose} title="Task">
        <p className="text-sm text-slate-400">Loading&hellip;</p>
      </Dialog>
    );
  }

  const isSingleDay = form.start_date === form.end_date;

  function save() {
    if (!form) return;
    updateAssignment.mutate(
      {
        id: form.id,
        task_name: form.task_name,
        start_date: form.start_date,
        end_date: form.end_date,
        priority: form.priority,
        status: form.status,
        notes: form.notes ?? undefined,
        day_part: isSingleDay ? form.day_part : "FULL",
        is_fixed: form.is_fixed,
      },
      {
        onSuccess: (updated) => {
          onClose();
          if (updated.conflicts && updated.conflicts.length > 0) {
            alert(
              `Heads up: this now overlaps ${updated.conflicts.length} other task(s) for ${form.developer_name ?? "this developer"} — both are kept.`
            );
          }
        },
        onError: () => alert("Could not save this task."),
      }
    );
  }

  return (
    <Dialog open onClose={onClose} title={form.developer_name ?? "Task"}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Task name</label>
          <input
            value={form.task_name}
            onChange={(e) => setForm({ ...form, task_name: e.target.value })}
            className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Start date</label>
            <input
              type="date"
              value={form.start_date ?? ""}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">End date</label>
            <input
              type="date"
              value={form.end_date ?? ""}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}
              className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            >
              {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as Status })}
              className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            >
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        {isSingleDay && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">When</label>
            <DayPartToggle
              value={form.day_part ?? "FULL"}
              onChange={(v: DayPart) => setForm({ ...form, day_part: v })}
            />
          </div>
        )}
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.is_fixed === 1}
            onChange={(e) => setForm({ ...form, is_fixed: e.target.checked ? 1 : 0 })}
          />
          Fixed &mdash; never auto-shift this task
        </label>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Notes</label>
          <textarea
            value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between">
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            if (confirm(`Delete "${form.task_name}"?`)) {
              deleteAssignment.mutate(form.id, { onSuccess: onClose });
            }
          }}
        >
          Delete
        </Button>
        {form.status !== "Completed" && form.developer_id !== null && form.start_date !== null && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (confirm(`Move "${form.task_name}" back to the backlog? Its developer and dates will be cleared.`)) {
                moveToBacklog.mutate(form.id, { onSuccess: onClose });
              }
            }}
          >
            Move to backlog
          </Button>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </div>
      </div>
    </Dialog>
  );
}
