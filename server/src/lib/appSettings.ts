import { db } from "../db/connection.js";

export const PLANNER_DAYS_MIN = 3;
export const PLANNER_DAYS_MAX = 28;
export const PLANNER_DAYS_DEFAULT = 7;

export function getSetting(key: string): string | undefined {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string): void {
  db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(
    key,
    value
  );
}

export function getPlannerDays(): number {
  const raw = Number(getSetting("planner_days"));
  return Number.isInteger(raw) && raw >= PLANNER_DAYS_MIN && raw <= PLANNER_DAYS_MAX ? raw : PLANNER_DAYS_DEFAULT;
}
