import { useNavigate } from "react-router-dom";
import { Users, AlertTriangle, Zap, Clock, Plus, Inbox, BellRing, Palmtree, Sparkles } from "lucide-react";
import { PageHeader } from "../layout/AppShell";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { useAIInsights, useNotifications, useSummary } from "../../api/hooks";
import { formatDate } from "../../lib/formatDate";
import { WeekPlanner } from "./WeekPlanner";

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const diffMs = Date.now() - new Date(iso.replace(" ", "T") + "Z").getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function DashboardPage() {
  const { data, isLoading } = useSummary();
  const { data: notifications } = useNotifications();
  const { data: insights, isFetching: insightsLoading, isFetched: insightsFetched, refetch: fetchInsights } = useAIInsights();
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Today's snapshot across your team"
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate("/urgent")}>
              <Zap size={15} /> Urgent Reassignment
            </Button>
            <Button onClick={() => navigate("/schedule?add=1")}>
              <Plus size={15} /> New Assignment
            </Button>
          </>
        }
      />

      {isLoading || !data ? (
        <div className="text-sm text-slate-400">Loading&hellip;</div>
      ) : (
        <div className="space-y-6">
          {notifications && notifications.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/40">
              <div className="mb-2 flex items-center gap-2">
                <BellRing size={16} className="text-amber-600" />
                <h3 className="text-sm font-semibold text-slate-800">Needs attention ({notifications.length})</h3>
              </div>
              <div className="space-y-1.5">
                {notifications.slice(0, 5).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => navigate("/schedule")}
                    className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-white"
                  >
                    {n.message}
                  </button>
                ))}
              </div>
              {notifications.length > 5 && (
                <p className="mt-1 px-2 text-xs text-slate-500">+{notifications.length - 5} more</p>
              )}
            </Card>
          )}

          <Card className="border-violet-200 bg-violet-50/40">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-violet-600" />
                <h3 className="text-sm font-semibold text-slate-800">AI Insights</h3>
                {insightsFetched && insights && (
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-600 ring-1 ring-violet-200">
                    {insights.source === "claude" ? "Claude-enhanced" : "Local suggestions"}
                  </span>
                )}
              </div>
              <Button size="sm" variant="secondary" onClick={() => fetchInsights()} disabled={insightsLoading}>
                <Sparkles size={13} /> {insightsFetched ? "Refresh" : "Generate AI Insights"}
              </Button>
            </div>

            {!insightsFetched && !insightsLoading && (
              <p className="text-sm text-slate-500">
                Runs the local scoring engine on demand (and Claude too, if you've enabled it in Settings) — nothing
                is called automatically on page load.
              </p>
            )}
            {insightsLoading && <p className="text-sm text-slate-500">Thinking&hellip;</p>}
            {insightsFetched && insights && (
              <>
                <p className="text-sm text-slate-700">{insights.summary}</p>
                {insights.suggestions.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {insights.suggestions.slice(0, 5).map((s) => (
                      <button
                        key={s.assignmentId}
                        onClick={() => navigate("/schedule")}
                        className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white"
                      >
                        <span className="text-slate-700">{s.taskName}</span>
                        <span className={s.meetsDueDate ? "text-violet-700" : "text-amber-600"}>&rarr; {s.developerName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <Card>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">Free right now</span>
                <Users size={16} className="text-state-free" />
              </div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">{data.freeNow.length}</div>
              <div className="mt-1 text-xs text-slate-400">
                {data.freeNow.map((f) => f.developer.name).join(", ") || "No one free"}
              </div>
            </Card>
            <Card>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">Busy today</span>
                <Clock size={16} className="text-brand-500" />
              </div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">{data.busyToday.length}</div>
              <div className="mt-1 text-xs text-slate-400">out of {data.freeNow.length + data.busyToday.length} developers</div>
            </Card>
            <Card>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">Urgent items (7d)</span>
                <Zap size={16} className="text-state-urgent" />
              </div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">{data.urgentUpcoming.length}</div>
              <div className="mt-1 text-xs text-slate-400">active or starting this week</div>
            </Card>
            <Card className={data.conflicts.length > 0 ? "ring-1 ring-inset ring-red-200 bg-red-50/40" : ""}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">Conflicts</span>
                <AlertTriangle size={16} className={data.conflicts.length > 0 ? "text-red-600" : "text-slate-300"} />
              </div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">{data.conflicts.length}</div>
              {data.conflicts.length > 0 ? (
                <button className="mt-1 text-xs font-medium text-red-600 hover:underline" onClick={() => navigate("/schedule")}>
                  Review in Schedule &rarr;
                </button>
              ) : (
                <div className="mt-1 text-xs text-slate-400">No overlapping tasks</div>
              )}
            </Card>
            <Card>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">Backlog</span>
                <Inbox size={16} className="text-slate-400" />
              </div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">{data.backlogCount}</div>
              {data.backlogCount > 0 ? (
                <button className="mt-1 text-xs font-medium text-brand-600 hover:underline" onClick={() => navigate("/schedule")}>
                  Schedule them &rarr;
                </button>
              ) : (
                <div className="mt-1 text-xs text-slate-400">Nothing waiting</div>
              )}
            </Card>
            <Card className={data.overdueCount > 0 ? "ring-1 ring-inset ring-red-200 bg-red-50/40" : ""}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">Overdue</span>
                <BellRing size={16} className={data.overdueCount > 0 ? "text-red-600" : "text-slate-300"} />
              </div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">{data.overdueCount}</div>
              {data.overdueCount > 0 ? (
                <button className="mt-1 text-xs font-medium text-red-600 hover:underline" onClick={() => navigate("/schedule")}>
                  Review &rarr;
                </button>
              ) : (
                <div className="mt-1 text-xs text-slate-400">Nothing overdue</div>
              )}
            </Card>
          </div>

          <WeekPlanner />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Busy today</h3>
              {data.busyToday.length === 0 ? (
                <p className="text-sm text-slate-400">Nobody has an active task today.</p>
              ) : (
                <div className="divide-y divide-surface-border">
                  {data.busyToday.map(({ developer, task }) => (
                    <div key={developer.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <div className="text-sm font-medium text-slate-800">{developer.name}</div>
                        <div className="text-xs text-slate-500">{task.task_name}</div>
                      </div>
                      <div className="text-xs text-slate-400">until {formatDate(task.end_date)}</div>
                    </div>
                  ))}
                </div>
              )}

              {data.onLeaveToday.length > 0 && (
                <div className="mt-5 border-t border-surface-border pt-4">
                  <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                    <Palmtree size={14} className="text-state-leave" /> On leave today
                  </h3>
                  <div className="space-y-2">
                    {data.onLeaveToday.map(({ developer, leave }) => (
                      <div key={developer.id} className="flex items-center justify-between rounded-lg bg-state-leaveBg px-3 py-2">
                        <span className="text-sm text-slate-800">{developer.name}</span>
                        <Badge tone="leave">till {formatDate(leave.end_date)}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.urgentUpcoming.length > 0 && (
                <div className="mt-5 border-t border-surface-border pt-4">
                  <h3 className="mb-3 text-sm font-semibold text-slate-800">Urgent this week</h3>
                  <div className="space-y-2">
                    {data.urgentUpcoming.map((a) => (
                      <div key={a.id} className="flex items-center justify-between rounded-lg bg-state-urgentBg px-3 py-2">
                        <div className="text-sm text-slate-800">
                          <span className="font-medium">{a.developer_name}</span> &middot; {a.task_name}
                        </div>
                        <Badge tone="warning">{formatDate(a.start_date)} &rarr; {formatDate(a.end_date)}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">Recent activity</h3>
                <span className="text-xs text-slate-400">updated {timeAgo(data.lastUpdatedAt)}</span>
              </div>
              {data.recentActivity.length === 0 ? (
                <p className="text-sm text-slate-400">No activity yet — start by adding a task.</p>
              ) : (
                <ul className="space-y-3">
                  {data.recentActivity.map((a) => (
                    <li key={a.id} className="text-sm text-slate-600">
                      <span className="block text-slate-800">{a.message}</span>
                      <span className="text-xs text-slate-400">{timeAgo(a.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
