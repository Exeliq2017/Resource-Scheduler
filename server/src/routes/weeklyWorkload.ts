import { Router } from "express";
import { db } from "../db/connection.js";
import { computeWeeklyWorkload } from "../lib/weeklyWorkload.js";
import type { AssignmentLite } from "../lib/availability.js";
import { getHolidaySet } from "./holidays.js";
import { getLeavesByDeveloper } from "../lib/leaves.js";
import { addDays, toISODate, todayDate } from "../lib/dateUtils.js";

export const weeklyWorkloadRouter = Router();

interface DeveloperRow {
  id: number;
  name: string;
}

function expandLeaveDates(leaves: { start_date: string; end_date: string }[]): Set<string> {
  const dates = new Set<string>();
  for (const leave of leaves) {
    let cursor = new Date(leave.start_date);
    const end = new Date(leave.end_date);
    while (cursor.getTime() <= end.getTime()) {
      dates.add(toISODate(cursor));
      cursor = addDays(cursor, 1);
    }
  }
  return dates;
}

weeklyWorkloadRouter.get("/", (req, res) => {
  const weeks = Math.min(Number(req.query.weeks) || 5, 12);
  const holidays = getHolidaySet();
  const leavesByDeveloper = getLeavesByDeveloper();
  const today = todayDate();

  const developers = db
    .prepare("SELECT id, name FROM developers WHERE is_active = 1 ORDER BY name")
    .all() as DeveloperRow[];

  const result = developers.map((dev) => {
    const assignments = db
      .prepare(
        "SELECT id, task_name, start_date, end_date, status FROM assignments WHERE developer_id = ? AND start_date IS NOT NULL AND end_date IS NOT NULL"
      )
      .all(dev.id) as AssignmentLite[];
    const leaveDates = expandLeaveDates(leavesByDeveloper.get(dev.id) ?? []);
    const buckets = computeWeeklyWorkload(assignments, weeks, holidays, today, leaveDates);
    return { developer: dev, buckets };
  });

  res.json(result);
});
