import { Router } from "express";
import { db } from "../db/connection.js";
import { computeAvailability, type AssignmentLite } from "../lib/availability.js";
import { getHolidaySet } from "./holidays.js";
import { getLeavesByDeveloper, isDeveloperOnLeave } from "../lib/leaves.js";
import { todayISO, todayDate, earliestSuggestionDate } from "../lib/dateUtils.js";
import { findEarliestSlot, type BusyRange } from "../lib/slotFinder.js";

export const availabilityRouter = Router();

interface DeveloperRow {
  id: number;
  name: string;
  role: string;
  notes: string | null;
}

function formatShort(iso: string): string {
  const [, m, d] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d}-${months[Number(m) - 1]}`;
}

availabilityRouter.get("/", (_req, res) => {
  const developers = db
    .prepare("SELECT id, name, role, notes FROM developers WHERE is_active = 1 ORDER BY name")
    .all() as DeveloperRow[];
  const holidays = getHolidaySet();
  const leavesByDeveloper = getLeavesByDeveloper();
  const today = todayISO();

  const result = developers.map((dev) => {
    const assignments = db
      .prepare(
        "SELECT id, task_name, start_date, end_date, status FROM assignments WHERE developer_id = ? AND start_date IS NOT NULL AND end_date IS NOT NULL"
      )
      .all(dev.id) as AssignmentLite[];

    // Treat each leave as a pseudo-assignment so "next free day" and "last busy
    // day" naturally skip over it, exactly like a real task would.
    const leaves = leavesByDeveloper.get(dev.id) ?? [];
    const withLeave = [
      ...assignments,
      ...leaves.map((l, i) => ({
        id: -1 - i,
        task_name: "On Leave",
        start_date: l.start_date,
        end_date: l.end_date,
        status: "Ongoing",
      })),
    ];

    const availability = computeAvailability(withLeave, holidays);
    const activeLeave = isDeveloperOnLeave(dev.id, today, leavesByDeveloper);

    return {
      developer: dev,
      ...availability,
      statusLabel: activeLeave ? `On leave till ${formatShort(activeLeave.end_date)}` : availability.statusLabel,
      onLeave: activeLeave,
    };
  });

  res.json(result);
});

// Gap-aware "when could they start a task of this length" — unlike the "/" endpoint above (which
// only looks past a developer's *last* committed task), this checks for an earlier open window,
// so a short task can slot in before later work already on their calendar. Covers every active
// developer regardless of AI-suggestion exclusion — this is a manual picker, not a suggestion.
availabilityRouter.get("/next-slot", (req, res) => {
  const estimatedDays = Math.max(1, Number(req.query.estimated_days) || 1);
  const developers = db.prepare("SELECT id, name FROM developers WHERE is_active = 1").all() as {
    id: number;
    name: string;
  }[];
  const holidays = getHolidaySet();
  const leavesByDeveloper = getLeavesByDeveloper();
  const today = todayDate();

  const result = developers.map((dev) => {
    const assignments = db
      .prepare(
        "SELECT start_date, end_date FROM assignments WHERE developer_id = ? AND status != 'Completed' AND start_date IS NOT NULL AND end_date IS NOT NULL"
      )
      .all(dev.id) as { start_date: string; end_date: string }[];
    const leaves = leavesByDeveloper.get(dev.id) ?? [];

    const busyRanges: BusyRange[] = [
      ...assignments.map((a) => ({ start: a.start_date, end: a.end_date })),
      ...leaves.map((l) => ({ start: l.start_date, end: l.end_date })),
    ];

    return { developerId: dev.id, nextAvailableDate: findEarliestSlot(busyRanges, estimatedDays, holidays, earliestSuggestionDate()) };
  });

  res.json(result);
});
