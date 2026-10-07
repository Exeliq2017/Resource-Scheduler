import { Router } from "express";
import { db } from "../db/connection.js";
import { addDays, earliestSuggestionDate, parseISODate, toISODate, todayDate } from "../lib/dateUtils.js";
import { countWorkingDaysInRange, isNonWorkingDay } from "../lib/workingDays.js";
import { getLeavesByDeveloper } from "../lib/leaves.js";
import { getAffinityScore } from "../lib/affinity.js";
import { getPlannerDays } from "../lib/appSettings.js";
import { planFill, type PlannerBacklogTask, type PlannerDev } from "../lib/weekPlanner.js";
import { getHolidaySet } from "./holidays.js";
import { buildGridRows } from "./schedule.js";

export const plannerRouter = Router();

const MAX_OFFSET = 4;

interface DeveloperRow {
  id: number;
  name: string;
  role: string;
  exclude_from_suggestions: number;
}

interface BusyRow {
  developer_id: number;
  start_date: string;
  end_date: string;
}

// Look-ahead plan for the Dashboard: per-developer cells for the next N days (N from Settings),
// plus backlog tasks proposed for the free slots.
plannerRouter.get("/", (req, res) => {
  const days = getPlannerDays();
  const offset = Math.min(Math.max(Math.floor(Number(req.query.offset) || 0), 0), MAX_OFFSET);
  const excluded = new Set(
    String(req.query.exclude ?? "")
      .split(",")
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0)
  );

  const today = todayDate();
  const holidays = getHolidaySet();
  const windowStartDate = addDays(today, offset * days);
  const dateList = Array.from({ length: days }, (_, i) => toISODate(addDays(windowStartDate, i)));
  const windowStart = dateList[0];
  const windowEnd = dateList[dateList.length - 1];

  const developers = db
    .prepare("SELECT id, name, role, exclude_from_suggestions FROM developers WHERE is_active = 1 ORDER BY name")
    .all() as DeveloperRow[];

  const busyRows = db
    .prepare(
      `SELECT developer_id, start_date, end_date FROM assignments
       WHERE developer_id IS NOT NULL AND start_date IS NOT NULL AND end_date IS NOT NULL AND status != 'Completed'`
    )
    .all() as BusyRow[];
  const leavesByDeveloper = getLeavesByDeveloper();

  const plannerDevs: PlannerDev[] = developers.map((d) => {
    const own = busyRows.filter((r) => r.developer_id === d.id);
    const leaves = leavesByDeveloper.get(d.id) ?? [];
    return {
      id: d.id,
      name: d.name,
      excluded: d.exclude_from_suggestions === 1,
      activeTaskCount: own.length,
      busy: [
        ...own.map((r) => ({ start: r.start_date, end: r.end_date })),
        ...leaves.map((l) => ({ start: l.start_date, end: l.end_date })),
      ],
    };
  });

  const backlog = (
    db
      .prepare(
        `SELECT id, task_name, priority, due_date, estimated_days, preferred_developer_id, created_at FROM assignments
         WHERE developer_id IS NULL OR start_date IS NULL OR end_date IS NULL`
      )
      .all() as PlannerBacklogTask[]
  ).filter((t) => !excluded.has(t.id));

  // Days before the earliest suggestion date (i.e. today, once past the 5 PM cutoff) are closed:
  // no suggestions land there and their free time doesn't count as free.
  const earliestStart = earliestSuggestionDate();
  const earliestStartISO = toISODate(earliestStart);

  const { proposals, later, unplaced } = planFill({
    windowStart,
    windowEnd,
    today: earliestStart,
    holidays,
    developers: plannerDevs,
    backlog,
    affinity: (taskName, developerId) => getAffinityScore(taskName, developerId, today),
  });

  const rows = buildGridRows(dateList);
  let freeDays = 0;
  let proposedDays = 0;

  const developerPlans = rows.map(({ developer, cells }) => {
    const freeWorkingDays = cells.filter((c) => c.date >= earliestStartISO && c.am.state === "FREE" && c.pm.state === "FREE").length;
    const busyWorkingDays = cells.filter((c) => ["BUSY", "URGENT"].includes(c.am.state) || ["BUSY", "URGENT"].includes(c.pm.state)).length;
    const leaveDays = cells.filter((c) => c.am.state === "LEAVE").length;
    const own = proposals.filter((p) => p.developerId === developer.id);
    const proposedWorkingDays = own.reduce((sum, p) => {
      const from = p.start > windowStart ? p.start : windowStart;
      const to = p.end < windowEnd ? p.end : windowEnd;
      return sum + countWorkingDaysInRange(parseISODate(from), parseISODate(to), holidays);
    }, 0);
    const meta = developers.find((d) => d.id === developer.id);
    const isExcluded = meta?.exclude_from_suggestions === 1;
    if (!isExcluded) {
      freeDays += freeWorkingDays;
      proposedDays += proposedWorkingDays;
    }
    return {
      developer: { ...developer, excludeFromSuggestions: isExcluded },
      cells,
      freeWorkingDays,
      busyWorkingDays,
      leaveDays,
      proposedWorkingDays,
      proposals: own,
    };
  });

  res.json({
    windowStart,
    windowEnd,
    days: dateList.map((date) => ({
      date,
      isWorkingDay: !isNonWorkingDay(parseISODate(date), holidays),
      closed: date < earliestStartISO,
    })),
    windowDays: days,
    offset,
    maxOffset: MAX_OFFSET,
    developers: developerPlans,
    later,
    unplaced,
    summary: { freeDays, proposedDays },
  });
});
