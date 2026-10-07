import { useRef, useState } from "react";
import { Download, Plus, Trash2, Upload } from "lucide-react";
import { PageHeader } from "../layout/AppShell";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { useAddHoliday, useDeleteHoliday, useHolidays } from "../../api/hooks";
import { api } from "../../api/client";
import { LeavesEditor } from "./LeavesEditor";
import { AISettingsCard } from "./AISettingsCard";
import { PlannerSettingsCard } from "./PlannerSettingsCard";

export function SettingsPage() {
  const { data: holidays } = useHolidays();
  const addHoliday = useAddHoliday();
  const deleteHoliday = useDeleteHoliday();
  const [date, setDate] = useState("");
  const [label, setLabel] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<string | null>(null);

  function submitHoliday() {
    if (!date) return;
    addHoliday.mutate({ date, label }, { onSuccess: () => { setDate(""); setLabel(""); } });
  }

  async function handleImportFile(file: File) {
    const text = await file.text();
    const result = await api.post<{ imported: number }>("/import-export/import", { csv: text });
    setImportResult(`Imported ${result.imported} assignment(s).`);
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Holidays, planned leave, planner window, and one-time data import/export" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-slate-800">Company holidays</h3>
          <p className="mb-3 text-xs text-slate-500">
            Extra non-working days on top of the standard rule (Sundays off, plus the 2nd and 4th Saturday of every month).
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="min-w-0 shrink-0 rounded-lg border border-surface-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (e.g. Diwali)"
              className="min-w-[100px] flex-1 rounded-lg border border-surface-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
            <Button onClick={submitHoliday} className="shrink-0"><Plus size={15} /></Button>
          </div>
          <div className="space-y-1.5">
            {holidays?.length === 0 && <p className="text-sm text-slate-400">No extra holidays configured.</p>}
            {holidays?.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2 text-sm">
                <span>{h.date} {h.label && <span className="text-slate-500">&middot; {h.label}</span>}</span>
                <button onClick={() => deleteHoliday.mutate(h.id)} className="text-slate-300 hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </Card>

        <LeavesEditor />

        <PlannerSettingsCard />

        <AISettingsCard />

        <Card className="lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-slate-800">Import &amp; export</h3>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs text-slate-500">
                Export all current assignments as a CSV backup.
              </p>
              <Button variant="secondary" onClick={() => window.open("/api/import-export/export.csv", "_blank")}>
                <Download size={15} /> Export CSV
              </Button>
            </div>
            <div className="border-t border-surface-border pt-4">
              <p className="mb-2 text-xs text-slate-500">
                One-time import from a CSV with columns Developer, Task, Start Date, End Date, Priority, Status, Notes. New developer names are created automatically.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleImportFile(e.target.files[0])}
              />
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                <Upload size={15} /> Import CSV
              </Button>
              {importResult && <p className="mt-2 text-xs text-emerald-600">{importResult}</p>}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
