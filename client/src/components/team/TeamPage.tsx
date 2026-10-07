import { useMemo, useState } from "react";
import { Plus, ChevronRight, Archive } from "lucide-react";
import { PageHeader } from "../layout/AppShell";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { useArchiveDeveloper, useAvailability, useCreateDeveloper, useDevelopers } from "../../api/hooks";
import type { AvailabilityRow } from "../../api/types";
import { formatDate } from "../../lib/formatDate";
import { DeveloperPanel } from "./DeveloperPanel";

const ROLES = ["Senior Dev", "Dev", "Junior Dev"];

export function TeamPage() {
  const { data: developers, isLoading } = useDevelopers();
  const { data: availability } = useAvailability();
  const createDeveloper = useCreateDeveloper();
  const archiveDeveloper = useArchiveDeveloper();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState(ROLES[1]);

  const availabilityById = useMemo(() => {
    const map = new Map<number, AvailabilityRow>();
    availability?.forEach((row) => map.set(row.developer.id, row));
    return map;
  }, [availability]);

  function submitAdd() {
    if (!name.trim()) return;
    createDeveloper.mutate(
      { name: name.trim(), role },
      { onSuccess: () => { setName(""); setRole(ROLES[1]); setAdding(false); } }
    );
  }

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle="Your roster, at-a-glance availability, and workload"
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus size={15} /> Add Developer
          </Button>
        }
      />

      <Card className="!p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface-muted text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Next Free</th>
              <th className="px-5 py-3">Current / Next Task</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-slate-400">Loading&hellip;</td>
              </tr>
            )}
            {developers?.map((dev) => {
              const avail = availabilityById.get(dev.id);
              const free = avail?.statusLabel === "Free now";
              const onLeave = Boolean(avail?.onLeave);
              const isLead = dev.exclude_from_suggestions === 1;
              return (
                <tr
                  key={dev.id}
                  className={`cursor-pointer hover:bg-surface-muted ${isLead ? "bg-indigo-50/40" : ""}`}
                  onClick={() => setSelectedId(dev.id)}
                >
                  <td className="px-5 py-3.5 font-medium text-slate-800">
                    {dev.name}
                    {isLead && (
                      <span className="ml-2 whitespace-nowrap align-middle">
                        <Badge tone="lead">Lead</Badge>
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{dev.role}</td>
                  <td className="px-5 py-3.5">
                    <Badge tone={onLeave ? "leave" : free ? "success" : "brand"}>{avail?.statusLabel ?? "—"}</Badge>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{formatDate(avail?.nextFreeWorkingDay)}</td>
                  <td className="px-5 py-3.5 text-slate-600">
                    {avail?.currentOrNextTask?.task_name ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        title="Archive"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Archive ${dev.name}? Their assignment history is kept.`)) {
                            archiveDeveloper.mutate(dev.id);
                          }
                        }}
                        className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"
                      >
                        <Archive size={15} />
                      </button>
                      <ChevronRight size={16} className="text-slate-300" />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setAdding(false)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Add Developer</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Name</label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitAdd()}
                  className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  placeholder="e.g. Priyansh"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                >
                  {ROLES.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setAdding(false)}>Cancel</Button>
              <Button onClick={submitAdd}>Add Developer</Button>
            </div>
          </div>
        </div>
      )}

      {selectedId !== null && (
        <DeveloperPanel developerId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
