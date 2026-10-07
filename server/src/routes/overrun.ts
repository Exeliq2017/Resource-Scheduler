import { Router } from "express";
import { db } from "../db/connection.js";
import { computeExtendPlan, type OverrunTask } from "../lib/overrun.js";
import { logActivity } from "../lib/activityLog.js";
import { todayISO, toDisplayDate } from "../lib/dateUtils.js";
import { getHolidaySet } from "./holidays.js";

export const overrunRouter = Router();

interface TaskRow extends OverrunTask {
  developer_id: number | null;
  priority: string;
  notes: string | null;
}

function loadTask(id: number): TaskRow | undefined {
  return db.prepare("SELECT * FROM assignments WHERE id = ?").get(id) as TaskRow | undefined;
}

function loadSiblings(developerId: number): OverrunTask[] {
  return db
    .prepare(
      "SELECT id, task_name, start_date, end_date, due_date, status, is_fixed FROM assignments WHERE developer_id = ? AND start_date IS NOT NULL AND end_date IS NOT NULL"
    )
    .all(developerId) as OverrunTask[];
}

overrunRouter.post("/preview", (req, res) => {
  const { assignment_id, extra_days } = req.body;
  const task = loadTask(Number(assignment_id));
  if (!task || !task.developer_id || !task.start_date || !task.end_date) {
    return res.status(404).json({ error: "scheduled assignment not found" });
  }
  if (!(Number(extra_days) >= 1)) return res.status(400).json({ error: "extra_days must be at least 1" });
  res.json(computeExtendPlan(task, Number(extra_days), todayISO(), loadSiblings(task.developer_id), getHolidaySet()));
});

overrunRouter.post("/apply", (req, res) => {
  const { assignment_id, extra_days, mode, due_date } = req.body;
  const task = loadTask(Number(assignment_id));
  if (!task || !task.developer_id || !task.start_date || !task.end_date) {
    return res.status(404).json({ error: "scheduled assignment not found" });
  }
  const extra = Number(extra_days);
  if (!(extra >= 1)) return res.status(400).json({ error: "extra_days must be at least 1" });

  const updateDates = db.prepare(
    "UPDATE assignments SET start_date = ?, end_date = ?, updated_at = datetime('now') WHERE id = ?"
  );

  if (mode === "extend") {
    const plan = computeExtendPlan(task, extra, todayISO(), loadSiblings(task.developer_id), getHolidaySet());
    db.transaction(() => {
      updateDates.run(task.start_date, plan.newEnd, task.id);
      for (const m of plan.moves) updateDates.run(m.newStart, m.newEnd, m.id);
    })();
    logActivity(
      `Extended "${task.task_name}" to ${toDisplayDate(plan.newEnd)}, shifted ${plan.moves.length} later task${
        plan.moves.length === 1 ? "" : "s"
      }`
    );
    return res.json(plan);
  }

  if (mode === "split") {
    if (!due_date) return res.status(400).json({ error: "due_date is required to split into the backlog" });
    const today = todayISO();
    const cutEnd = task.end_date < today ? task.end_date : today;
    const note = `${extra} day(s) remaining were moved to the backlog after an overrun.`;
    const result = db.transaction(() => {
      db.prepare(
        "UPDATE assignments SET end_date = ?, status = 'Completed', notes = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(cutEnd, task.notes ? `${task.notes} — ${note}` : note, task.id);
      return db
        .prepare(
          `INSERT INTO assignments (developer_id, task_name, priority, status, due_date, estimated_days, preferred_developer_id, notes)
           VALUES (NULL, ?, ?, 'Planned', ?, ?, ?, ?)`
        )
        .run(`${task.task_name} (remaining)`, task.priority, due_date, extra, task.developer_id, `Remainder of "${task.task_name}"`);
    })();
    logActivity(`Split "${task.task_name}": ${extra} day(s) remaining moved to the backlog`);
    return res.status(201).json({ backlogId: Number(result.lastInsertRowid) });
  }

  res.status(400).json({ error: 'mode must be "extend" or "split"' });
});
