import clsx from "clsx";
import type { DayPart } from "../../api/types";

const OPTIONS: { value: DayPart; label: string }[] = [
  { value: "FULL", label: "Full day" },
  { value: "AM", label: "Morning" },
  { value: "PM", label: "Afternoon" },
];

/** Only meaningful for a single-day task — callers should only render this when start === end date. */
export function DayPartToggle({ value, onChange }: { value: DayPart; onChange: (v: DayPart) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-surface-border p-0.5 text-xs">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={clsx(
            "rounded-md px-2 py-1 font-medium transition-colors",
            value === opt.value ? "bg-brand-100 text-brand-700" : "text-slate-500 hover:text-slate-700"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
