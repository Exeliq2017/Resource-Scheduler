import { X } from "lucide-react";
import { useAssignments, useDevelopers, useUpdateDeveloper } from "../../api/hooks";
import { PriorityBadge, StatusBadge } from "../ui/Badge";
import { formatDate } from "../../lib/formatDate";

export function DeveloperPanel({ developerId, onClose }: { developerId: number; onClose: () => void }) {
  const { data: developers } = useDevelopers();
  const { data: assignments } = useAssignments({ developer_id: developerId });
  const updateDeveloper = useUpdateDeveloper();
  const dev = developers?.find((d) => d.id === developerId);

  const sorted = [...(assignments ?? [])].sort((a, b) => {
    if (!a.start_date && !b.start_date) return 0;
    if (!a.start_date) return -1; // not-yet-scheduled items float to the top
    if (!b.start_date) return 1;
    return a.start_date < b.start_date ? 1 : -1;
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-surface-border px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{dev?.name}</h2>
            <p className="text-sm text-slate-500">{dev?.role}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-surface-muted">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5">
          <label className="mb-4 flex items-center gap-2 rounded-lg bg-surface-muted p-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={dev?.exclude_from_suggestions === 1}
              onChange={(e) =>
                dev && updateDeveloper.mutate({ id: dev.id, exclude_from_suggestions: e.target.checked ? 1 : 0 })
              }
            />
            Software Lead — exclude from AI suggestions
          </label>
          {dev?.notes && <p className="mb-4 rounded-lg bg-surface-muted p-3 text-sm text-slate-600">{dev.notes}</p>}
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Task history &amp; timeline</h3>
          {sorted.length === 0 ? (
            <p className="text-sm text-slate-400">No assignments recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {sorted.map((a) => (
                <div key={a.id} className="rounded-lg border border-surface-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-800">{a.task_name}</span>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    {a.start_date && a.end_date ? (
                      <>
                        <span>{formatDate(a.start_date)} &rarr; {formatDate(a.end_date)}</span>
                        <span>&middot;</span>
                        <span>{a.duration_days}d</span>
                      </>
                    ) : (
                      <span className="italic text-slate-400">Not yet scheduled</span>
                    )}
                    <PriorityBadge priority={a.priority} />
                    {a.is_urgent === 1 && <span className="text-state-urgent font-medium">Urgent</span>}
                  </div>
                  {a.notes && <p className="mt-1.5 text-xs text-slate-500">{a.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
