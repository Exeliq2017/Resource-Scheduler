import { Router } from "express";
import { db } from "../db/connection.js";
import { computeAvailability, type AssignmentLite } from "../lib/availability.js";
import { findConflicts } from "../lib/overlap.js";
import { getHolidaySet } from "./holidays.js";
import { getLeavesByDeveloper, isDeveloperOnLeave, type LeaveRow } from "../lib/leaves.js";
import { isOverdueScheduled, isOverdueBacklog } from "../lib/overdue.js";
import { recentActivity } from "../lib/activityLog.js";
import { todayISO, addDays, todayDate, toISODate } from "../lib/dateUtils.js";

export const summaryRouter = Router();

interface DeveloperRow {
  id: number;
  name: string;
  role: string;
}

function buildSummary() {
  const today = todayISO();
  const in7Days = toISODate(addDays(todayDate(), 7));
  const holidays = getHolidaySet();

  const developers = db
    .prepare("SELECT id, name, role FROM developers WHERE is_active = 1 ORDER BY name")
    .all() as DeveloperRow[];

  const freeNow: { developer: DeveloperRow }[] = [];
  const busyToday: { developer: DeveloperRow; task: AssignmentLite }[] = [];
  const onLeaveToday: { developer: DeveloperRow; leave: LeaveRow }[] = [];
  const conflictsFlagged: { developer: DeveloperRow; conflicts: AssignmentLite[] }[] = [];
  const leavesByDeveloper = getLeavesByDeveloper();

  for (const dev of developers) {
    const assignments = db
      .prepare(
        "SELECT id, task_name, start_date, end_date, status FROM assignments WHERE developer_id = ? AND start_date IS NOT NULL AND end_date IS NOT NULL"
      )
      .all(dev.id) as (AssignmentLite & { status: string })[];

    const activeLeave = isDeveloperOnLeave(dev.id, today, leavesByDeveloper);
    const availability = computeAvailability(assignments, holidays);
    if (activeLeave) {
      onLeaveToday.push({ developer: dev, leave: activeLeave });
    } else if (availability.statusLabel === "Free now") {
      freeNow.push({ developer: dev });
    } else {
      const current = assignments.find(
        (a) => a.status !== "Completed" && a.start_date <= today && today <= a.end_date
      );
      if (current) busyToday.push({ developer: dev, task: current });
    }

    // Overlap conflicts: any two non-completed assignments for this developer that intersect.
    const active = assignments.filter((a) => a.status !== "Completed");
    const seen = new Set<number>();
    const conflictSet: AssignmentLite[] = [];
    for (const a of active) {
      const conflicts = findConflicts({ id: a.id, start_date: a.start_date, end_date: a.end_date }, active);
      for (const c of conflicts) {
        if (!seen.has(c.id!)) {
          seen.add(c.id!);
          conflictSet.push(c as AssignmentLite);
        }
      }
    }
    if (conflictSet.length > 0) conflictsFlagged.push({ developer: dev, conflicts: conflictSet });
  }

  const urgentUpcoming = db
    .prepare(
      `SELECT a.*, d.name AS developer_name FROM assignments a JOIN developers d ON d.id = a.developer_id
       WHERE a.is_urgent = 1 AND a.status != 'Completed' AND a.end_date >= ? AND a.start_date <= ?
       ORDER BY a.start_date`
    )
    .all(today, in7Days);

  const lastUpdated = db.prepare("SELECT MAX(updated_at) AS ts FROM assignments").get() as { ts: string | null };

  const backlogCount = (
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM assignments WHERE developer_id IS NULL OR start_date IS NULL OR end_date IS NULL"
      )
      .get() as { n: number }
  ).n;

  const allAssignments = db.prepare("SELECT * FROM assignments").all() as {
    developer_id: number | null;
    start_date: string | null;
    end_date: string | null;
    due_date: string | null;
    status: string;
  }[];
  const overdueCount = allAssignments.filter(
    (a) => isOverdueScheduled(a, today) || isOverdueBacklog(a, today)
  ).length;

  return {
    freeNow,
    busyToday,
    onLeaveToday,
    urgentUpcoming,
    conflicts: conflictsFlagged,
    backlogCount,
    overdueCount,
    lastUpdatedAt: lastUpdated.ts,
    recentActivity: recentActivity(10),
  };
}

summaryRouter.get("/", (_req, res) => {
  res.json(buildSummary());
});

// Payload a scheduled daily reminder could pull from later.
summaryRouter.get("/daily", (_req, res) => {
  res.json(buildSummary());
});
