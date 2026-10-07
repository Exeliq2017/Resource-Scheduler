import { Router } from "express";
import { db } from "../db/connection.js";
import { logActivity } from "../lib/activityLog.js";
import { toDisplayDate } from "../lib/dateUtils.js";

export const leavesRouter = Router();

leavesRouter.get("/", (req, res) => {
  const { developer_id } = req.query;
  let sql = `SELECT l.*, d.name AS developer_name FROM developer_leaves l JOIN developers d ON d.id = l.developer_id WHERE 1=1`;
  const params: unknown[] = [];
  if (developer_id) {
    sql += " AND l.developer_id = ?";
    params.push(Number(developer_id));
  }
  sql += " ORDER BY l.start_date";
  res.json(db.prepare(sql).all(...params));
});

leavesRouter.post("/", (req, res) => {
  const { developer_id, start_date, end_date, reason } = req.body;
  if (!developer_id || !start_date || !end_date) {
    return res.status(400).json({ error: "developer_id, start_date, end_date are required" });
  }
  if (end_date < start_date) {
    return res.status(400).json({ error: "end_date cannot be before start_date" });
  }
  const result = db
    .prepare("INSERT INTO developer_leaves (developer_id, start_date, end_date, reason) VALUES (?, ?, ?, ?)")
    .run(developer_id, start_date, end_date, reason || null);

  const dev = db.prepare("SELECT name FROM developers WHERE id = ?").get(developer_id) as { name: string } | undefined;
  logActivity(`Added leave for ${dev?.name ?? "a developer"} (${toDisplayDate(start_date)} to ${toDisplayDate(end_date)})`);

  const created = db.prepare("SELECT * FROM developer_leaves WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(created);
});

leavesRouter.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM developer_leaves WHERE id = ?").run(Number(req.params.id));
  res.status(204).end();
});
