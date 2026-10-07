import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Combobox } from "../ui/Combobox";
import { Button } from "../ui/Button";
import { ConflictBanner } from "./ConflictBanner";
import { DayPartToggle } from "./DayPartToggle";
import { checkConflicts, useCreateAssignment, useDevelopers } from "../../api/hooks";
import type { ConflictRow, DayPart, Priority, Status } from "../../api/types";
import { formatDate } from "../../lib/formatDate";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDaysISO(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PRIORITIES: Priority[] = ["High", "Medium", "Low"];
const STATUSES: Status[] = ["Planned", "Ongoing", "On Hold", "Completed"];

export function QuickAddRow({ recentTaskNames }: { recentTaskNames: string[] }) {
  const { data: developers } = useDevelopers();
  const createAssignment = useCreateAssignment();

  const [developerId, setDeveloperId] = useState<number | null>(null);
  const [taskName, setTaskName] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [durationMode, setDurationMode] = useState<"duration" | "endDate">("duration");
  const [duration, setDuration] = useState(1);
  const [endDate, setEndDate] = useState(startDate);
  const [priority, setPriority] = useState<Priority>("Medium");
  const [status, setStatus] = useState<Status>("Planned");
  const [conflicts, setConflicts] = useState<ConflictRow[]>([]);
  const [dayPart, setDayPart] = useState<DayPart>("FULL");

  const developerComboRef = useRef<HTMLDivElement>(null);

  const effectiveEndDate = durationMode === "duration" ? addDaysISO(startDate, duration - 1) : endDate;
  const isSingleDay = startDate === effectiveEndDate;

  useEffect(() => {
    if (!isSingleDay && dayPart !== "FULL") setDayPart("FULL");
  }, [isSingleDay, dayPart]);

  useEffect(() => {
    if (!developerId || !startDate || !effectiveEndDate) {
      setConflicts([]);
      return;
    }
    const handle = setTimeout(() => {
      checkConflicts({
        developer_id: developerId,
        start_date: startDate,
        end_date: effectiveEndDate,
        day_part: isSingleDay ? dayPart : undefined,
      })
        .then(setConflicts)
        .catch(() => setConflicts([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [developerId, startDate, effectiveEndDate, isSingleDay, dayPart]);

  function reset() {
    setDeveloperId(null);
    setTaskName("");
    setDuration(1);
    setStartDate(todayISO());
    setConflicts([]);
    setDayPart("FULL");
    developerComboRef.current?.querySelector("input")?.focus();
  }

  function submit() {
    if (!developerId || !taskName.trim()) return;
    createAssignment.mutate(
      {
        developer_id: developerId,
        task_name: taskName.trim(),
        start_date: startDate,
        end_date: effectiveEndDate,
        priority,
        status,
        day_part: isSingleDay ? dayPart : "FULL",
      },
      { onSuccess: reset }
    );
  }

  const developerOptions = (developers ?? []).map((d) => ({ value: String(d.id), label: d.name }));
  const taskOptions = Array.from(new Set(recentTaskNames)).map((t) => ({ value: t, label: t }));

  return (
    <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4">
      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-3" ref={developerComboRef}>
          <Combobox
            options={developerOptions}
            value={developers?.find((d) => d.id === developerId)?.name ?? ""}
            onChange={(v) => setDeveloperId(Number(v))}
            placeholder="Developer"
          />
        </div>
        <div className="col-span-3">
          <Combobox
            options={taskOptions}
            value={taskName}
            onChange={setTaskName}
            placeholder="Task name"
            allowFreeText
          />
        </div>
        <div className="col-span-2">
          <div className="flex gap-1">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-surface-border px-2 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div className="mt-1 flex gap-1 text-xs">
            {[
              { label: "Today", value: todayISO() },
              { label: "Tomorrow", value: addDaysISO(todayISO(), 1) },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => setStartDate(chip.value)}
                className="rounded bg-white px-1.5 py-0.5 text-slate-500 ring-1 ring-surface-border hover:text-brand-600"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
        <div className="col-span-2">
          {durationMode === "duration" ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(Math.max(1, Number(e.target.value)))}
                className="w-full rounded-lg border border-surface-border px-2 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
              <span className="whitespace-nowrap text-xs text-slate-400">day(s)</span>
            </div>
          ) : (
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-surface-border px-2 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          )}
          <button
            type="button"
            onClick={() => setDurationMode(durationMode === "duration" ? "endDate" : "duration")}
            className="mt-1 text-xs text-brand-600 hover:underline"
          >
            {durationMode === "duration" ? `ends ${formatDate(effectiveEndDate)}` : "use duration"}
          </button>
        </div>
        <div className="col-span-1">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            className="w-full rounded-lg border border-surface-border px-1 py-2 text-xs focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            {PRIORITIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="col-span-1">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            className="w-full rounded-lg border border-surface-border px-1 py-2 text-xs focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {isSingleDay && (
        <div className="mt-2">
          <DayPartToggle value={dayPart} onChange={setDayPart} />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex-1">
          <ConflictBanner conflicts={conflicts} developerName={developers?.find((d) => d.id === developerId)?.name} />
        </div>
        <Button onClick={submit} disabled={!developerId || !taskName.trim() || createAssignment.isPending}>
          <Plus size={15} /> Add
        </Button>
      </div>
    </div>
  );
}
