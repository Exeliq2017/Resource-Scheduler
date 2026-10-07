import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "../layout/AppShell";
import { Card } from "../ui/Card";
import { useSummary, useWeeklyWorkload } from "../../api/hooks";
import { formatDate } from "../../lib/formatDate";

const BAR_COLORS = ["#3366ff", "#f97316", "#16a34a", "#a855f7", "#0ea5e9", "#eab308", "#ec4899"];

function loadColor(ratio: number) {
  if (ratio === 0) return "#f1f5f9";
  if (ratio < 0.4) return "#dcfce7";
  if (ratio < 0.8) return "#fed7aa";
  return "#fecaca";
}

export function ReportsPage() {
  const [weeks, setWeeks] = useState(5);
  const { data: workload, isLoading } = useWeeklyWorkload(weeks);
  const { data: summary } = useSummary();

  const chartData = useMemo(() => {
    if (!workload || workload.length === 0) return [];
    const weekCount = workload[0].buckets.length;
    return Array.from({ length: weekCount }, (_, wi) => {
      const bucket = workload[0].buckets[wi];
      const entry: Record<string, string | number> = {
        week: `${bucket.weekStart.slice(5)}`,
      };
      workload.forEach((row) => {
        entry[row.developer.name] = row.buckets[wi].busyDays;
      });
      return entry;
    });
  }, [workload]);

  return (
    <div>
      <PageHeader title="Reports" subtitle="Capacity and workload, looking back and ahead" />

      <div className="space-y-6">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Weekly workload (busy working-days)</h3>
            <div className="flex gap-1">
              {[5, 8, 12].map((w) => (
                <button
                  key={w}
                  onClick={() => setWeeks(w)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium ${weeks === w ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:bg-surface-muted"}`}
                >
                  {w}w
                </button>
              ))}
            </div>
          </div>
          {isLoading || chartData.length === 0 ? (
            <p className="text-sm text-slate-400">Loading&hellip;</p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e9f2" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                {workload?.map((row, i) => (
                  <Bar key={row.developer.id} dataKey={row.developer.name} fill={BAR_COLORS[i % BAR_COLORS.length]} radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <h3 className="mb-4 text-sm font-semibold text-slate-800">Workload heatmap</h3>
          {isLoading || !workload ? (
            <p className="text-sm text-slate-400">Loading&hellip;</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-sm">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-left text-xs font-medium text-slate-500">Developer</th>
                    {workload[0]?.buckets.map((b) => (
                      <th key={b.weekStart} className="px-2 py-1 text-xs font-medium text-slate-500">{b.weekStart.slice(5)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {workload.map((row) => (
                    <tr key={row.developer.id}>
                      <td className="whitespace-nowrap px-2 py-1 font-medium text-slate-700">{row.developer.name}</td>
                      {row.buckets.map((b) => {
                        const ratio = b.workingDaysInWeek === 0 ? 0 : b.busyDays / b.workingDaysInWeek;
                        return (
                          <td key={b.weekStart} className="px-1 py-1">
                            <div
                              className="flex h-8 w-12 items-center justify-center rounded text-xs font-medium text-slate-700"
                              style={{ backgroundColor: loadColor(ratio) }}
                              title={`${b.busyDays} / ${b.workingDaysInWeek} working days`}
                            >
                              {b.busyDays}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <AlertTriangle size={15} className="text-red-500" /> Conflict log
          </h3>
          {!summary || summary.conflicts.length === 0 ? (
            <p className="text-sm text-slate-400">No overlapping assignments right now.</p>
          ) : (
            <div className="space-y-2">
              {summary.conflicts.map(({ developer, conflicts }) => (
                <div key={developer.id} className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  <span className="font-medium">{developer.name}</span>:{" "}
                  {conflicts.map((c) => `"${c.task_name}" (${formatDate(c.start_date)}–${formatDate(c.end_date)})`).join(", ")}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
