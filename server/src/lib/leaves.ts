import { db } from "../db/connection.js";

export interface LeaveRow {
  id: number;
  developer_id: number;
  start_date: string;
  end_date: string;
  reason: string | null;
}

export function getLeavesByDeveloper(): Map<number, LeaveRow[]> {
  const rows = db.prepare("SELECT * FROM developer_leaves ORDER BY start_date").all() as LeaveRow[];
  const map = new Map<number, LeaveRow[]>();
  for (const row of rows) {
    const list = map.get(row.developer_id) ?? [];
    list.push(row);
    map.set(row.developer_id, list);
  }
  return map;
}

export function isDeveloperOnLeave(
  developerId: number,
  dateISO: string,
  leavesByDeveloper: Map<number, LeaveRow[]>
): LeaveRow | null {
  const leaves = leavesByDeveloper.get(developerId);
  if (!leaves) return null;
  return leaves.find((l) => l.start_date <= dateISO && dateISO <= l.end_date) ?? null;
}
