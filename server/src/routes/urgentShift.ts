import { Router } from "express";
import { db } from "../db/connection.js";
import { computeUrgentShiftPreview, applyUrgentShift, type AffectedAssignment } from "../lib/urgentShift.js";
import { logActivity } from "../lib/activityLog.js";
import { toDisplayDate } from "../lib/dateUtils.js";

export const urgentShiftRouter = Router();

function getAffected(developerId: number): AffectedAssignment[] {
  return db
    .prepare(
      `SELECT id, task_name, start_date, end_date, status, priority, notes
       FROM assignments WHERE developer_id = ?`
    )
    .all(developerId) as AffectedAssignment[];
}

urgentShiftRouter.post("/preview", (req, res) => {
  const { developer_id, urgent_start, urgent_duration_days, mode } = req.body;
  if (!developer_id || !urgent_start || !urgent_duration_days || !mode) {
    return res.status(400).json({ error: "developer_id, urgent_start, urgent_duration_days, mode are required" });
  }
  const affected = getAffected(Number(developer_id));
  const preview = computeUrgentShiftPreview(urgent_start, Number(urgent_duration_days), mode, affected);
  res.json(preview);
});

urgentShiftRouter.post("/apply", (req, res) => {
  const { developer_id, task_name, urgent_start, urgent_duration_days, mode } = req.body;
  if (!developer_id || !task_name || !urgent_start || !urgent_duration_days || !mode) {
    return res
      .status(400)
      .json({ error: "developer_id, task_name, urgent_start, urgent_duration_days, mode are required" });
  }
  const affected = getAffected(Number(developer_id));
  const result = applyUrgentShift(
    db,
    {
      developerId: Number(developer_id),
      taskName: task_name.trim(),
      urgentStart: urgent_start,
      urgentDurationDays: Number(urgent_duration_days),
      mode,
    },
    affected
  );
  logActivity(`Urgent reassignment: "${task_name.trim()}" starting ${toDisplayDate(urgent_start)} (${mode} mode)`);
  res.status(201).json(result);
});

// Undo a just-applied urgent reassignment: deletes the urgent + follow-up
// rows it created and restores the affected rows' prior dates.
urgentShiftRouter.post("/undo", (req, res) => {
  const { urgent_assignment_id, follow_up_ids, previous_dates } = req.body as {
    urgent_assignment_id: number;
    follow_up_ids: number[];
    previous_dates: { id: number; start_date: string; end_date: string }[];
  };

  const restoreDates = db.prepare(
    "UPDATE assignments SET start_date = ?, end_date = ?, updated_at = datetime('now') WHERE id = ?"
  );
  const deleteById = db.prepare("DELETE FROM assignments WHERE id = ?");

  const run = db.transaction(() => {
    for (const row of previous_dates ?? []) {
      restoreDates.run(row.start_date, row.end_date, row.id);
    }
    for (const id of follow_up_ids ?? []) {
      deleteById.run(id);
    }
    if (urgent_assignment_id) deleteById.run(urgent_assignment_id);
  });
  run();

  logActivity("Undid urgent reassignment");
  res.status(204).end();
});
