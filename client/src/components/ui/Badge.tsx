import clsx from "clsx";
import type { ReactNode } from "react";
import type { Priority, Status } from "../../api/types";

const priorityStyles: Record<Priority, string> = {
  High: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
  Medium: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  Low: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
};

const statusStyles: Record<Status, string> = {
  Planned: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
  Ongoing: "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200",
  Completed: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  "On Hold": "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", priorityStyles[priority])}>
      {priority}
    </span>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", statusStyles[status])}>
      {status}
    </span>
  );
}

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "success" | "warning" | "danger" | "brand" | "leave" | "lead" | "info" }) {
  const tones: Record<string, string> = {
    default: "bg-slate-100 text-slate-600 ring-slate-200",
    success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    warning: "bg-amber-50 text-amber-700 ring-amber-200",
    danger: "bg-red-50 text-red-700 ring-red-200",
    brand: "bg-brand-50 text-brand-700 ring-brand-200",
    leave: "bg-state-leaveBg text-purple-700 ring-purple-200",
    lead: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    info: "bg-sky-50 text-sky-700 ring-sky-200",
  };
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", tones[tone])}>
      {children}
    </span>
  );
}
