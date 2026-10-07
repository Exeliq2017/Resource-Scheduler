import { Router } from "express";
import { db } from "../db/connection.js";

export const holidaysRouter = Router();

holidaysRouter.get("/", (_req, res) => {
  res.json(db.prepare("SELECT * FROM holidays ORDER BY date").all());
});

holidaysRouter.post("/", (req, res) => {
  const { date, label } = req.body;
  if (!date) return res.status(400).json({ error: "date is required" });
  const result = db
    .prepare("INSERT OR REPLACE INTO holidays (date, label) VALUES (?, ?)")
    .run(date, label || "");
  const created = db.prepare("SELECT * FROM holidays WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(created);
});

holidaysRouter.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM holidays WHERE id = ?").run(Number(req.params.id));
  res.status(204).end();
});

export function getHolidaySet(): Set<string> {
  const rows = db.prepare("SELECT date FROM holidays").all() as { date: string }[];
  return new Set(rows.map((r) => r.date));
}
