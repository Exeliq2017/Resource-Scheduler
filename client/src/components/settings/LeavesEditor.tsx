import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Combobox } from "../ui/Combobox";
import { useCreateLeave, useDeleteLeave, useDevelopers, useLeaves } from "../../api/hooks";
import { formatDate } from "../../lib/formatDate";

export function LeavesEditor() {
  const { data: developers } = useDevelopers();
  const { data: leaves } = useLeaves();
  const createLeave = useCreateLeave();
  const deleteLeave = useDeleteLeave();

  const [developerId, setDeveloperId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const developerOptions = (developers ?? []).map((d) => ({ value: String(d.id), label: d.name }));
  const canSubmit = developerId !== null && startDate && endDate && endDate >= startDate;

  function submit() {
    if (!canSubmit || developerId === null) return;
    createLeave.mutate(
      { developer_id: developerId, start_date: startDate, end_date: endDate, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          setDeveloperId(null);
          setStartDate("");
          setEndDate("");
          setReason("");
        },
      }
    );
  }

  return (
    <Card>
      <h3 className="mb-4 text-sm font-semibold text-slate-800">Planned leave</h3>
      <p className="mb-3 text-xs text-slate-500">
        Time off a developer already knows about — factored into their availability, the Timeline, and workload reports, same as a company holiday.
      </p>

      <div className="mb-4 space-y-2">
        <Combobox
          options={developerOptions}
          value={developers?.find((d) => d.id === developerId)?.name ?? ""}
          onChange={(v) => setDeveloperId(Number(v))}
          placeholder="Choose developer…"
        />
        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="min-w-0 shrink-0 rounded-lg border border-surface-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="min-w-0 shrink-0 rounded-lg border border-surface-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="min-w-[100px] flex-1 rounded-lg border border-surface-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <Button onClick={submit} disabled={!canSubmit} className="shrink-0">
            <Plus size={15} />
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        {leaves?.length === 0 && <p className="text-sm text-slate-400">No planned leave configured.</p>}
        {leaves?.map((l) => (
          <div key={l.id} className="flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2 text-sm">
            <span>
              <span className="font-medium text-slate-700">{l.developer_name}</span> &middot; {formatDate(l.start_date)} &rarr; {formatDate(l.end_date)}
              {l.reason && <span className="text-slate-500"> &middot; {l.reason}</span>}
            </span>
            <button onClick={() => deleteLeave.mutate(l.id)} className="text-slate-300 hover:text-red-500">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}
