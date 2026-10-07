import { useEffect, useState } from "react";
import clsx from "clsx";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { useAppSettings, useUpdateAppSettings } from "../../api/hooks";

const MIN_DAYS = 3;
const MAX_DAYS = 28;
const QUICK_PICKS = [7, 10, 14];

export function PlannerSettingsCard() {
  const { data: settings } = useAppSettings();
  const update = useUpdateAppSettings();
  const [days, setDays] = useState("7");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) setDays(String(settings.plannerDays));
  }, [settings]);

  const value = Number(days);
  const valid = Number.isInteger(value) && value >= MIN_DAYS && value <= MAX_DAYS;
  const dirty = settings !== undefined && value !== settings.plannerDays;

  function save() {
    if (!valid) return;
    update.mutate(
      { plannerDays: value },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
      }
    );
  }

  return (
    <Card>
      <h3 className="mb-1 text-sm font-semibold text-slate-800">Dashboard planner</h3>
      <p className="mb-3 text-xs text-slate-500">
        How many days ahead the Dashboard&apos;s look-ahead planner shows for each developer ({MIN_DAYS}&ndash;{MAX_DAYS}).
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={MIN_DAYS}
          max={MAX_DAYS}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="w-24 rounded-lg border border-surface-border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        <span className="text-sm text-slate-500">days</span>
        {QUICK_PICKS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(String(d))}
            className={clsx(
              "rounded-lg px-2.5 py-1.5 text-xs font-medium",
              value === d ? "bg-brand-50 text-brand-700" : "bg-white text-slate-500 ring-1 ring-surface-border hover:text-slate-700"
            )}
          >
            {d}
          </button>
        ))}
        <Button onClick={save} disabled={!valid || !dirty || update.isPending} className="ml-auto">
          Save
        </Button>
      </div>
      {!valid && (
        <p className="mt-2 text-xs text-red-600">
          Enter a whole number from {MIN_DAYS} to {MAX_DAYS}.
        </p>
      )}
      {saved && <p className="mt-2 text-xs text-emerald-600">Saved.</p>}
    </Card>
  );
}
