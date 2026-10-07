import { Router } from "express";
import { db } from "../db/connection.js";
import { findConflicts, type AssignmentRange, type DayPart } from "../lib/overlap.js";
import { logActivity } from "../lib/activityLog.js";
import { recordOutcome } from "../lib/affinity.js";
import { toDisplayDate } from "../lib/dateUtils.js";

const COMPLETION_AFFINITY_WEIGHT = 1;

const VALID_DAY_PARTS: DayPart[] = ["FULL", "AM", "PM"];

/** day_part may only be AM/PM for a single-day task — half-days are meaningless across multiple days. */
function validateDayPart(dayPart: unknown, startDate: string | null, endDate: string | null): string | null {
  if (dayPart === undefined || dayPart === null) return null;
  if (!VALID_DAY_PARTS.includes(dayPart as DayPart)) return "day_part must be FULL, AM, or PM";
  if (dayPart !== "FULL" && startDate !== endDate) {
    return "day_part can only be AM or PM for a single-day task";
  }
  return null;
}

export const assignmentsRouter = Router();

interface AssignmentRow extends AssignmentRange {
  id: number;
  developer_id: number | null;
  notes: string | null;
  is_urgent: number;
  priority: string;
}

function getDeveloperAssignments(developerId: number, excludeId?: number): AssignmentRow[] {
  const rows = db
    .prepare("SELECT * FROM assignments WHERE developer_id = ?")
    .all(developerId) as AssignmentRow[];
  return excludeId ? rows.filter((r) => r.id !== excludeId) : rows;
}

const BACKLOG_CONDITION = "(a.developer_id IS NULL OR a.start_date IS NULL OR a.end_date IS NULL)";

assignmentsRouter.get("/", (req, res) => {
  const { developer_id, status, backlog } = req.query;
  // LEFT JOIN (not INNER) so backlog rows with no developer yet still come back.
  let sql = `SELECT a.*, d.name AS developer_name, pd.name AS preferred_developer_name
             FROM assignments a
             LEFT JOIN developers d ON d.id = a.developer_id
             LEFT JOIN developers pd ON pd.id = a.preferred_developer_id
             WHERE 1=1`;
  const params: unknown[] = [];
  if (developer_id) {
    sql += " AND a.developer_id = ?";
    params.push(Number(developer_id));
  }
  if (status) {
    sql += " AND a.status = ?";
    params.push(String(status));
  }
  if (backlog === "true") {
    sql += ` AND ${BACKLOG_CONDITION}`;
  } else if (backlog === "false") {
    sql += ` AND NOT ${BACKLOG_CONDITION}`;
  }
  sql += " ORDER BY a.start_date IS NULL DESC, a.start_date, a.created_at";
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// Live conflict check — call before submitting a create/edit.
assignmentsRouter.get("/conflicts", (req, res) => {
  const developerId = Number(req.query.developer_id);
  const startDate = String(req.query.start_date);
  const endDate = String(req.query.end_date);
  const excludeId = req.query.exclude_id ? Number(req.query.exclude_id) : undefined;
  const dayPart = req.query.day_part as DayPart | undefined;

  if (!developerId || !startDate || !endDate) {
    return res.status(400).json({ error: "developer_id, start_date, end_date are required" });
  }

  const existing = getDeveloperAssignments(developerId, excludeId);
  const conflicts = findConflicts(
    { id: excludeId, start_date: startDate, end_date: endDate, day_part: dayPart },
    existing
  );
  res.json({ conflicts });
});

assignmentsRouter.post("/", (req, res) => {
  const {
    developer_id,
    task_name,
    start_date,
    end_date,
    due_date,
    priority,
    status,
    is_urgent,
    notes,
    day_part,
    estimated_days,
    preferred_developer_id,
    is_fixed,
    override,
  } = req.body;

  if (!task_name || !String(task_name).trim()) {
    return res.status(400).json({ error: "task_name is required" });
  }
  if (Boolean(start_date) !== Boolean(end_date)) {
    return res.status(400).json({ error: "start_date and end_date must both be set, or both left blank" });
  }
  if (start_date && end_date && end_date < start_date) {
    return res.status(400).json({ error: "end_date cannot be before start_date" });
  }

  const dayPartError = validateDayPart(day_part, start_date || null, end_date || null);
  if (dayPartError) {
    return res.status(400).json({ error: dayPartError });
  }

  const isFullyScheduled = Boolean(developer_id) && Boolean(start_date) && Boolean(end_date);

  if (!isFullyScheduled && (!due_date || !estimated_days)) {
    return res.status(400).json({ error: "due_date and estimated_days are required for backlog tasks" });
  }

  // A developer can be double-booked on purpose (e.g. two tasks they'll juggle at their own
  // discretion) — this is never blocked, just reported back so the UI can show a heads-up.
  const conflicts = isFullyScheduled
    ? findConflicts({ start_date, end_date, day_part: day_part as DayPart | undefined }, getDeveloperAssignments(Number(developer_id)))
    : [];

  const result = db
    .prepare(
      `INSERT INTO assignments (developer_id, task_name, start_date, end_date, due_date, priority, status, is_urgent, notes, day_part, estimated_days, preferred_developer_id, is_fixed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      developer_id || null,
      task_name.trim(),
      start_date || null,
      end_date || null,
      due_date || null,
      priority || "Medium",
      status || "Planned",
      is_urgent ? 1 : 0,
      notes || null,
      day_part || "FULL",
      estimated_days || null,
      preferred_developer_id || null,
      is_fixed ? 1 : 0
    );

  logActivity(
    isFullyScheduled
      ? `Added assignment "${task_name.trim()}" (${toDisplayDate(start_date)} to ${toDisplayDate(end_date)})`
      : `Added "${task_name.trim()}" to the backlog`
  );
  const created = db.prepare("SELECT * FROM assignments WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ ...(created as object), conflicts });
});

assignmentsRouter.patch("/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM assignments WHERE id = ?").get(id) as AssignmentRow | undefined;
  if (!existing) return res.status(404).json({ error: "not found" });

  const {
    developer_id,
    task_name,
    start_date,
    end_date,
    due_date,
    priority,
    status,
    is_urgent,
    notes,
    day_part,
    estimated_days,
    preferred_developer_id,
    is_fixed,
    override,
  } = req.body;

  if (task_name !== undefined && !String(task_name).trim()) {
    return res.status(400).json({ error: "task_name cannot be blank" });
  }

  const merged = {
    developer_id: developer_id ?? existing.developer_id,
    start_date: start_date ?? existing.start_date,
    end_date: end_date ?? existing.end_date,
    day_part: day_part ?? existing.day_part,
  };

  if (Boolean(merged.start_date) !== Boolean(merged.end_date)) {
    return res.status(400).json({ error: "start_date and end_date must both be set, or both left blank" });
  }

  const dayPartError = validateDayPart(merged.day_part, merged.start_date, merged.end_date);
  if (dayPartError) {
    return res.status(400).json({ error: dayPartError });
  }

  const mergedIsFullyScheduled = Boolean(merged.developer_id) && Boolean(merged.start_date) && Boolean(merged.end_date);

  // A developer can be double-booked on purpose (e.g. two tasks they'll juggle at their own
  // discretion) — this is never blocked, just reported back so the UI can show a heads-up.
  const conflicts =
    mergedIsFullyScheduled && (start_date || end_date || developer_id || day_part)
      ? findConflicts(
          { id, start_date: merged.start_date, end_date: merged.end_date, day_part: merged.day_part as DayPart },
          getDeveloperAssignments(merged.developer_id, id)
        )
      : [];

  db.prepare(
    `UPDATE assignments SET
       developer_id = COALESCE(?, developer_id),
       task_name = COALESCE(?, task_name),
       start_date = COALESCE(?, start_date),
       end_date = COALESCE(?, end_date),
       due_date = COALESCE(?, due_date),
       priority = COALESCE(?, priority),
       status = COALESCE(?, status),
       is_urgent = COALESCE(?, is_urgent),
       notes = COALESCE(?, notes),
       day_part = COALESCE(?, day_part),
       estimated_days = COALESCE(?, estimated_days),
       preferred_developer_id = CASE WHEN ? THEN ? ELSE preferred_developer_id END,
       is_fixed = COALESCE(?, is_fixed),
       updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    developer_id ?? null,
    task_name?.trim() ?? null,
    start_date ?? null,
    end_date ?? null,
    due_date ?? null,
    priority ?? null,
    status ?? null,
    is_urgent === undefined ? null : is_urgent ? 1 : 0,
    notes ?? null,
    day_part ?? null,
    estimated_days ?? null,
    preferred_developer_id !== undefined ? 1 : 0,
    preferred_developer_id || null,
    is_fixed === undefined ? null : is_fixed ? 1 : 0,
    id
  );

  const wasBacklog = !existing.developer_id || !existing.start_date || !existing.end_date;
  if (wasBacklog && mergedIsFullyScheduled) {
    logActivity(`Scheduled "${(task_name ?? existing.task_name).trim()}" from the backlog`);
  }

  if (status === "Completed" && existing.status !== "Completed" && merged.developer_id) {
    recordOutcome(task_name ?? existing.task_name, merged.developer_id, COMPLETION_AFFINITY_WEIGHT);
  }

  const updated = db.prepare("SELECT * FROM assignments WHERE id = ?").get(id);
  res.json({ ...(updated as object), conflicts });
});

assignmentsRouter.post("/bulk-status", (req, res) => {
  const { ids, status } = req.body as { ids: number[]; status: string };
  if (!Array.isArray(ids) || !status) {
    return res.status(400).json({ error: "ids[] and status are required" });
  }
  const update = db.prepare("UPDATE assignments SET status = ?, updated_at = datetime('now') WHERE id = ?");
  const run = db.transaction((rows: number[]) => {
    for (const rowId of rows) {
      if (status === "Completed") {
        const row = db.prepare("SELECT task_name, developer_id, status FROM assignments WHERE id = ?").get(rowId) as
          | { task_name: string; developer_id: number | null; status: string }
          | undefined;
        if (row && row.status !== "Completed" && row.developer_id) {
          recordOutcome(row.task_name, row.developer_id, COMPLETION_AFFINITY_WEIGHT);
        }
      }
      update.run(status, rowId);
    }
  });
  run(ids);
  res.json({ updated: ids.length });
});

// Un-schedules a task: clears its developer and dates so it lands back in the backlog. The estimate
// is kept (falling back to the old span) so the suggestion engine has something to work with.
// Any preferred developer already set is kept; the previous assignee is deliberately NOT made the
// preferred one, since a task is usually moved back because that person can't take it right now.
assignmentsRouter.post("/:id/move-to-backlog", (req, res) => {
  const id = Number(req.params.id);
  const existing = db
    .prepare("SELECT task_name, status, developer_id, start_date, end_date, duration_days, estimated_days FROM assignments WHERE id = ?")
    .get(id) as
    | {
        task_name: string;
        status: string;
        developer_id: number | null;
        start_date: string | null;
        end_date: string | null;
        duration_days: number | null;
        estimated_days: number | null;
      }
    | undefined;
  if (!existing) return res.status(404).json({ error: "not found" });
  if (existing.status === "Completed") {
    return res.status(400).json({ error: "completed tasks cannot be moved back to the backlog" });
  }
  if (!existing.developer_id || !existing.start_date || !existing.end_date) {
    return res.status(400).json({ error: "task is already in the backlog" });
  }

  db.prepare(
    `UPDATE assignments SET
       developer_id = NULL, start_date = NULL, end_date = NULL, day_part = 'FULL',
       status = 'Planned', is_fixed = 0,
       estimated_days = COALESCE(estimated_days, ?),
       updated_at = datetime('now')
     WHERE id = ?`
  ).run(existing.duration_days ?? 1, id);

  logActivity(`Moved "${existing.task_name}" back to the backlog (was ${toDisplayDate(existing.start_date)} to ${toDisplayDate(existing.end_date)})`);
  res.json(db.prepare("SELECT * FROM assignments WHERE id = ?").get(id));
});

assignmentsRouter.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  db.prepare("DELETE FROM assignments WHERE id = ?").run(id);
  res.status(204).end();
});
