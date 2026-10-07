import { Router } from "express";
import { db } from "../db/connection.js";
import { logActivity } from "../lib/activityLog.js";

export const developersRouter = Router();

developersRouter.get("/", (_req, res) => {
  const includeArchived = _req.query.includeArchived === "true";
  const rows = includeArchived
    ? db.prepare("SELECT * FROM developers ORDER BY name").all()
    : db.prepare("SELECT * FROM developers WHERE is_active = 1 ORDER BY name").all();
  res.json(rows);
});

developersRouter.post("/", (req, res) => {
  const { name, role, notes } = req.body;
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  const result = db
    .prepare("INSERT INTO developers (name, role, notes) VALUES (?, ?, ?)")
    .run(name.trim(), role || "Dev", notes || null);
  logActivity(`Added developer "${name.trim()}"`);
  const created = db.prepare("SELECT * FROM developers WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(created);
});

developersRouter.patch("/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM developers WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "not found" });

  const { name, role, notes, is_active, exclude_from_suggestions } = req.body;
  db.prepare(
    `UPDATE developers SET
       name = COALESCE(?, name),
       role = COALESCE(?, role),
       notes = COALESCE(?, notes),
       is_active = COALESCE(?, is_active),
       exclude_from_suggestions = COALESCE(?, exclude_from_suggestions),
       updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    name ?? null,
    role ?? null,
    notes ?? null,
    is_active === undefined ? null : is_active ? 1 : 0,
    exclude_from_suggestions === undefined ? null : exclude_from_suggestions ? 1 : 0,
    id
  );

  const updated = db.prepare("SELECT * FROM developers WHERE id = ?").get(id);
  res.json(updated);
});

developersRouter.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  db.prepare("UPDATE developers SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
  res.status(204).end();
});
