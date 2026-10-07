import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, Bell, BellOff, Info } from "lucide-react";
import clsx from "clsx";
import { useBrowserNotifications } from "../../hooks/useBrowserNotifications";
import type { NotificationItem } from "../../api/types";

const severityIcon: Record<NotificationItem["severity"], typeof AlertTriangle> = {
  high: AlertTriangle,
  medium: Info,
  low: Info,
};

const severityColor: Record<NotificationItem["severity"], string> = {
  high: "text-red-500",
  medium: "text-amber-500",
  low: "text-slate-400",
};

export function NotificationCenter() {
  const { permission, requestPermission, notifications } = useBrowserNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  const highCount = notifications.filter((n) => n.severity === "high").length;

  return (
    <div className="relative">
      {permission === "default" && (
        <button
          onClick={requestPermission}
          className="mr-2 hidden items-center gap-1 rounded-lg bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 sm:inline-flex"
        >
          <Bell size={12} /> Enable notifications
        </button>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-surface-muted hover:text-slate-800"
      >
        {permission === "denied" ? <BellOff size={18} /> : <Bell size={18} />}
        {notifications.length > 0 && (
          <span
            className={clsx(
              "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white",
              highCount > 0 ? "bg-red-500" : "bg-brand-500"
            )}
          >
            {notifications.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-96 max-w-[90vw] rounded-xl border border-surface-border bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-800">Needs attention</h3>
              {permission === "default" && (
                <button onClick={requestPermission} className="text-xs font-medium text-brand-600 hover:underline">
                  Enable browser alerts
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-400">All clear — nothing needs attention.</p>
              ) : (
                <div className="divide-y divide-surface-border">
                  {notifications.map((n) => {
                    const Icon = severityIcon[n.severity];
                    return (
                      <button
                        key={n.id}
                        onClick={() => {
                          setOpen(false);
                          navigate("/schedule");
                        }}
                        className="flex w-full items-start gap-2.5 px-4 py-3 text-left hover:bg-surface-muted"
                      >
                        <Icon size={15} className={clsx("mt-0.5 shrink-0", severityColor[n.severity])} />
                        <span className="text-sm text-slate-700">{n.message}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
