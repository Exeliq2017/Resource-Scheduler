import { AlertTriangle } from "lucide-react";
import type { ConflictRow } from "../../api/types";
import { formatDate } from "../../lib/formatDate";

// Informational only — double-booking is allowed (a developer may juggle two tasks at their own
// discretion), so this never blocks saving. It just flags the overlap before you commit to it.
export function ConflictBanner({
  conflicts,
  developerName,
}: {
  conflicts: ConflictRow[];
  developerName?: string;
}) {
  if (conflicts.length === 0) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <div className="flex-1">
        {developerName && <span className="font-medium">Heads up — {developerName} already has overlapping work: </span>}
        {conflicts.map((c) => (
          <div key={c.id}>
            &ldquo;{c.task_name}&rdquo; {formatDate(c.start_date)} &rarr; {formatDate(c.end_date)}
          </div>
        ))}
      </div>
    </div>
  );
}
