import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { List, GanttChartSquare } from "lucide-react";
import clsx from "clsx";
import { PageHeader } from "../layout/AppShell";
import { ListView } from "./ListView";
import { TimelineView } from "./TimelineView";

export function SchedulePage() {
  const [view, setView] = useState<"list" | "timeline">("list");
  const [searchParams, setSearchParams] = useSearchParams();
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("add") === "1") {
      setQuickAddOpen(true);
      searchParams.delete("add");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <div>
      <PageHeader
        title="Schedule"
        subtitle="Plan, track, and reshuffle everyone's work in one place"
        actions={
          <div className="flex items-center rounded-lg border border-surface-border bg-white p-1">
            <button
              onClick={() => setView("list")}
              className={clsx(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
                view === "list" ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <List size={15} /> List
            </button>
            <button
              onClick={() => setView("timeline")}
              className={clsx(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
                view === "timeline" ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <GanttChartSquare size={15} /> Timeline
            </button>
          </div>
        }
      />
      {view === "list" ? (
        <ListView quickAddOpen={quickAddOpen} onQuickAddOpenChange={setQuickAddOpen} />
      ) : (
        <TimelineView />
      )}
    </div>
  );
}
