import { db } from "../db/connection.js";

export function logActivity(message: string): void {
  db.prepare("INSERT INTO activity_log (message) VALUES (?)").run(message);
}

export function recentActivity(limit = 20) {
  return db.prepare("SELECT * FROM activity_log ORDER BY id DESC LIMIT ?").all(limit);
}
