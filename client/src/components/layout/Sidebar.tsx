import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarRange,
  Users,
  Zap,
  BarChart3,
  Settings as SettingsIcon,
} from "lucide-react";
import clsx from "clsx";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/schedule", label: "Schedule", icon: CalendarRange },
  { to: "/team", label: "Team", icon: Users },
  { to: "/urgent", label: "Urgent Reassignment", icon: Zap },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function Sidebar() {
  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-surface-border bg-white">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white font-bold">
          E
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-900">Exeliq</div>
          <div className="text-xs text-slate-500">Resource Scheduler</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-surface-muted hover:text-slate-900"
              )
            }
          >
            <Icon size={18} strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-surface-border p-4 text-xs text-slate-400">
        Local instance &middot; v1.0
      </div>
    </aside>
  );
}
