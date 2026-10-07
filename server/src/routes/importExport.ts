import { Router } from "express";
import { db } from "../db/connection.js";
import { logActivity } from "../lib/activityLog.js";

export const importExportRouter = Router();

function csvEscape(value: unknown): string {
  const str = String(value ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

importExportRouter.get("/export.csv", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT d.name AS developer, a.task_name, a.start_date, a.end_date, a.priority, a.status, a.notes
       FROM assignments a JOIN developers d ON d.id = a.developer_id ORDER BY d.name, a.start_date`
    )
    .all() as Record<string, unknown>[];

  const header = ["Developer", "Task", "Start Date", "End Date", "Priority", "Status", "Notes"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [r.developer, r.task_name, r.start_date, r.end_date, r.priority, r.status, r.notes]
        .map(csvEscape)
        .join(",")
    );
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=assignments-export.csv");
  res.send(lines.join("\n"));
});

function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")));
}

// Explicit, user-triggered one-time import — never run automatically.
importExportRouter.post("/import", (req, res) => {
  const { csv } = req.body as { csv: string };
  if (!csv) return res.status(400).json({ error: "csv is required" });

  const rows = parseCsv(csv);
  const [header, ...dataRows] = rows;
  const idx = (col: string) => header.findIndex((h) => h.toLowerCase().includes(col));
  const devIdx = idx("developer");
  const taskIdx = idx("task");
  const startIdx = idx("start");
  const endIdx = idx("end");
  const prioIdx = idx("priority");
  const statusIdx = idx("status");
  const notesIdx = idx("notes");

  const getDeveloperId = db.prepare("SELECT id FROM developers WHERE name = ?");
  const insertDeveloper = db.prepare("INSERT INTO developers (name) VALUES (?)");
  const insertAssignment = db.prepare(
    `INSERT INTO assignments (developer_id, task_name, start_date, end_date, priority, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  let imported = 0;
  const run = db.transaction(() => {
    for (const row of dataRows) {
      const devName = row[devIdx]?.trim();
      const taskName = row[taskIdx]?.trim();
      const start = row[startIdx]?.trim();
      const end = row[endIdx]?.trim();
      if (!devName || !taskName || !start || !end) continue;

      let dev = getDeveloperId.get(devName) as { id: number } | undefined;
      if (!dev) {
        const result = insertDeveloper.run(devName);
        dev = { id: Number(result.lastInsertRowid) };
      }

      insertAssignment.run(
        dev.id,
        taskName,
        start,
        end,
        row[prioIdx] || "Medium",
        row[statusIdx] || "Planned",
        row[notesIdx] || null
      );
      imported += 1;
    }
  });
  run();

  logActivity(`Imported ${imported} assignment(s) from CSV`);
  res.status(201).json({ imported });
});
