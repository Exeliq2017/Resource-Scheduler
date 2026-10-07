import { Router } from "express";
import { db } from "../db/connection.js";
import { addDays, toISODate, todayDate } from "../lib/dateUtils.js";
import { isNonWorkingDay } from "../lib/workingDays.js";
import { getHolidaySet } from "./holidays.js";
import { getLeavesByDeveloper, isDeveloperOnLeave } from "../lib/leaves.js";

export const scheduleRouter = Router();

interface DeveloperRow {
  id: number;
  name: string;
  role: string;
}

interface AssignmentRow {
  id: number;
  developer_id: number;
  task_name: string;
  start_date: string;
  end_date: string;
  status: string;
  priority: string;
  is_urgent: number;
  day_part: "FULL" | "AM" | "PM";
}

type HalfState = "OFF" | "LEAVE" | "FREE" | "BUSY" | "URGENT";

interface AssignmentRef {
  id: number;
  taskName: string;
  priority: string;
  startDate: string;
  endDate: string;
  dayPart: "FULL" | "AM" | "PM";
}

interface HalfCell {
  state: HalfState;
  leaveReason?: string;
  /** Every assignment covering this half — normally 0 or 1, but 2+ when a developer is double-booked. */
  assignments: AssignmentRef[];
}

/** All assignments (if any) covering one half of a day — a FULL-day task covers both halves. A
 * developer can now be double-booked (allowed with a warning, not blocked), so this is a list, not
 * a single pick. */
function allForHalf(covering: AssignmentRow[], half: "AM" | "PM"): AssignmentRow[] {
  return covering.filter((a) => a.day_part === "FULL" || a.day_part === half);
}

function buildHalf(covering: AssignmentRow[]): HalfCell {
  if (covering.length === 0) return { state: "FREE", assignments: [] };
  return {
    state: covering.some((a) => a.is_urgent) ? "URGENT" : "BUSY",
    assignments: covering.map((a) => ({
      id: a.id,
      taskName: a.task_name,
      priority: a.priority,
      startDate: a.start_date,
      endDate: a.end_date,
      dayPart: a.day_part,
    })),
  };
}

export type GridRowData = {
  developer: DeveloperRow;
  cells: { date: string; am: HalfCell; pm: HalfCell }[];
};

/** Per-developer, per-day half-day cells for the given dates — shared by the Timeline and the Dashboard planner. */
export function buildGridRows(dateList: string[]): GridRowData[] {
  const holidays = getHolidaySet();
  const leavesByDeveloper = getLeavesByDeveloper();

  const developers = db
    .prepare("SELECT id, name, role FROM developers WHERE is_active = 1 ORDER BY name")
    .all() as DeveloperRow[];
  const assignments = db
    .prepare(
      `SELECT id, developer_id, task_name, start_date, end_date, status, priority, is_urgent, day_part
       FROM assignments WHERE status != 'Completed' AND end_date >= ?`
    )
    .all(dateList[0]) as AssignmentRow[];

  return developers.map((dev) => {
    const devAssignments = assignments.filter((a) => a.developer_id === dev.id);
    const cells = dateList.map((iso) => {
      const date = new Date(iso);
      if (isNonWorkingDay(date, holidays)) {
        return { date: iso, am: { state: "OFF" as const, assignments: [] }, pm: { state: "OFF" as const, assignments: [] } };
      }
      const leave = isDeveloperOnLeave(dev.id, iso, leavesByDeveloper);
      if (leave) {
        const leaveHalf: HalfCell = { state: "LEAVE", leaveReason: leave.reason ?? undefined, assignments: [] };
        return { date: iso, am: leaveHalf, pm: leaveHalf };
      }
      const covering = devAssignments.filter((a) => a.start_date <= iso && iso <= a.end_date);
      return {
        date: iso,
        am: buildHalf(allForHalf(covering, "AM")),
        pm: buildHalf(allForHalf(covering, "PM")),
      };
    });
    return { developer: dev, cells };
  });
}

// Grid data for the Schedule Timeline view: rows = developers, columns = days.
scheduleRouter.get("/grid", (req, res) => {
  const days = Math.min(Number(req.query.days) || 35, 120);
  const today = todayDate();
  const dateList = Array.from({ length: days }, (_, i) => toISODate(addDays(today, i)));
  res.json({ dates: dateList, rows: buildGridRows(dateList) });
});
