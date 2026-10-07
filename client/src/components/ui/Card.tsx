import type { ReactNode } from "react";
import clsx from "clsx";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("rounded-xl border border-surface-border bg-white p-5 shadow-card", className)}>
      {children}
    </div>
  );
}
