import type Database from "better-sqlite3";
import { addDays, parseISODate, toISODate } from "./dateUtils.js";

export type ShiftMode = "Shift" | "Split";

export interface AffectedAssignment {
  id: number;
  task_name: string;
  start_date: string;
  end_date: string;
  status: string;
  priority?: string;
  notes?: string | null;
}

export interface AffectedRowPreview {
  id: number;
  taskName: string;
  currentStart: string;
  currentEnd: string;
  newStart: string;
  newEnd: string;
  type: "ONGOING" | "UPCOMING";
  action: string;
  followUp?: { start: string; end: string };
}

export interface UrgentShiftPreview {
  urgentEnd: string;
  affected: AffectedRowPreview[];
}

function shiftISO(iso: string, days: number): string {
  return toISODate(addDays(parseISODate(iso), days));
}

function formatShort(iso: string): string {
  const d = parseISODate(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(d.getDate()).padStart(2, "0")}-${months[d.getMonth()]}`;
}

/**
 * Finds every non-completed assignment of the developer whose end date is on
 * or after the urgent start date, and computes new dates for each — for
 * EVERY affected row, unlike the original workbook which only had a live
 * formula for row 1.
 */
export function computeUrgentShiftPreview(
  urgentStart: string,
  urgentDurationDays: number,
  mode: ShiftMode,
  developerAssignments: AffectedAssignment[]
): UrgentShiftPreview {
  const urgentEnd = shiftISO(urgentStart, urgentDurationDays - 1);

  const affected = developerAssignments
    .filter((a) => a.status !== "Completed" && a.end_date >= urgentStart)
    .sort((a, b) => (a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0))
    .map((a): AffectedRowPreview => {
      const isOngoing = a.start_date < urgentStart;

      if (isOngoing) {
        if (mode === "Shift") {
          const newEnd = shiftISO(a.end_date, urgentDurationDays);
          return {
            id: a.id,
            taskName: a.task_name,
            currentStart: a.start_date,
            currentEnd: a.end_date,
            newStart: a.start_date,
            newEnd,
            type: "ONGOING",
            action: `Update End to ${formatShort(newEnd)} (work pauses during urgent task)`,
          };
        }
        // Split mode: cut short the day before urgent starts, resume after via a follow-up row.
        const newEnd = shiftISO(urgentStart, -1);
        const followUpStart = shiftISO(urgentEnd, 1);
        const followUpEnd = shiftISO(a.end_date, urgentDurationDays);
        return {
          id: a.id,
          taskName: a.task_name,
          currentStart: a.start_date,
          currentEnd: a.end_date,
          newStart: a.start_date,
          newEnd,
          type: "ONGOING",
          action: `Change End to ${formatShort(newEnd)}. A follow-up task will be added: ${formatShort(
            followUpStart
          )} to ${formatShort(followUpEnd)}`,
          followUp: { start: followUpStart, end: followUpEnd },
        };
      }

      // Upcoming: slides forward by the urgent duration, preserving its own duration and gap.
      const newStart = shiftISO(a.start_date, urgentDurationDays);
      const newEnd = shiftISO(a.end_date, urgentDurationDays);
      const shiftDays = urgentDurationDays;
      return {
        id: a.id,
        taskName: a.task_name,
        currentStart: a.start_date,
        currentEnd: a.end_date,
        newStart,
        newEnd,
        type: "UPCOMING",
        action: `Update Start to ${formatShort(newStart)}, End to ${formatShort(newEnd)} (shifted by ${shiftDays} day${
          shiftDays === 1 ? "" : "s"
        })`,
      };
    });

  return { urgentEnd, affected };
}

export interface ApplyUrgentShiftParams {
  developerId: number;
  taskName: string;
  urgentStart: string;
  urgentDurationDays: number;
  mode: ShiftMode;
}

export interface ApplyUrgentShiftResult {
  urgentAssignmentId: number;
  updatedIds: number[];
  followUpIds: number[];
  /** Prior dates for each updated row, so the change can be undone. */
  previousDates: { id: number; start_date: string; end_date: string }[];
}

/**
 * Applies a computed urgent-shift preview inside a single transaction:
 * inserts the urgent assignment, updates every affected row's dates, and
 * inserts Split-mode follow-up rows. Replaces the old VBA macro entirely.
 */
export function applyUrgentShift(
  db: Database.Database,
  params: ApplyUrgentShiftParams,
  affectedAssignments: AffectedAssignment[]
): ApplyUrgentShiftResult {
  const preview = computeUrgentShiftPreview(
    params.urgentStart,
    params.urgentDurationDays,
    params.mode,
    affectedAssignments
  );

  const insertUrgent = db.prepare(
    `INSERT INTO assignments (developer_id, task_name, start_date, end_date, priority, status, is_urgent)
     VALUES (@developer_id, @task_name, @start_date, @end_date, 'High', 'Planned', 1)`
  );
  const insertFollowUp = db.prepare(
    `INSERT INTO assignments (developer_id, task_name, start_date, end_date, priority, status, is_urgent, notes)
     VALUES (@developer_id, @task_name, @start_date, @end_date, @priority, @status, 0, @notes)`
  );
  const updateDates = db.prepare(
    `UPDATE assignments SET start_date = @start_date, end_date = @end_date, updated_at = datetime('now') WHERE id = @id`
  );

  const run = db.transaction((): ApplyUrgentShiftResult => {
    const urgentInsert = insertUrgent.run({
      developer_id: params.developerId,
      task_name: params.taskName,
      start_date: params.urgentStart,
      end_date: preview.urgentEnd,
    });

    const updatedIds: number[] = [];
    const followUpIds: number[] = [];
    const previousDates: { id: number; start_date: string; end_date: string }[] = [];

    for (const row of preview.affected) {
      const original = affectedAssignments.find((a) => a.id === row.id)!;
      previousDates.push({ id: row.id, start_date: original.start_date, end_date: original.end_date });
      updateDates.run({ id: row.id, start_date: row.newStart, end_date: row.newEnd });
      updatedIds.push(row.id);

      if (row.followUp) {
        const followUpInsert = insertFollowUp.run({
          developer_id: params.developerId,
          task_name: original.task_name,
          start_date: row.followUp.start,
          end_date: row.followUp.end,
          priority: original.priority ?? "Medium",
          status: "Planned",
          notes: original.notes ?? null,
        });
        followUpIds.push(Number(followUpInsert.lastInsertRowid));
      }
    }

    return {
      urgentAssignmentId: Number(urgentInsert.lastInsertRowid),
      updatedIds,
      followUpIds,
      previousDates,
    };
  });

  return run();
}
