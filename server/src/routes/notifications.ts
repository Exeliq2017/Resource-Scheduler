import { Router } from "express";
import { db } from "../db/connection.js";
import { findConflicts } from "../lib/overlap.js";
import { isOverdueScheduled, isOverdueBacklog, isDueSoonBacklog } from "../lib/overdue.js";
import { isStartingToday, needsCompletionCheck } from "../lib/reminders.js";
import { addDays, todayDate, todayISO, toISODate, toDisplayDate } from "../lib/dateUtils.js";

export const notificationsRouter = Router();

export type NotificationSeverity = "high" | "medium" | "low";

export interface NotificationItem {
  id: string;
  type: string;
  severity: NotificationSeverity;
  message: string;
  relatedAssignmentId?: number;
  relatedDeveloperId?: number;
}

interface AssignmentRow {
  id: number;
  developer_id: number | null;
  developer_name: string | null;
  task_name: string;
  start_date: string | null;
  end_date: string | null;
  due_date: string | null;
  status: string;
  is_urgent: number;
}

interface LeaveRow {
  id: number;
  developer_id: number;
  developer_name: string;
  start_date: string;
  end_date: string;
}

export function buildNotifications(): NotificationItem[] {
  const today = todayISO();
  const yesterday = toISODate(addDays(todayDate(), -1));
  const dueSoonHorizon = toISODate(addDays(todayDate(), 2));
  const leaveSoonHorizon = toISODate(addDays(todayDate(), 3));
  const notifications: NotificationItem[] = [];

  const assignments = db
    .prepare(
      `SELECT a.id, a.developer_id, d.name AS developer_name, a.task_name, a.start_date, a.end_date,
              a.due_date, a.status, a.is_urgent
       FROM assignments a LEFT JOIN developers d ON d.id = a.developer_id`
    )
    .all() as AssignmentRow[];

  for (const a of assignments) {
    if (isOverdueScheduled(a, today)) {
      notifications.push({
        id: `overdue:${a.id}`,
        type: "overdue-scheduled",
        severity: "high",
        message: `"${a.task_name}" (${a.developer_name}) was due to finish ${toDisplayDate(a.end_date!)} and isn't marked Completed yet.`,
        relatedAssignmentId: a.id,
        relatedDeveloperId: a.developer_id ?? undefined,
      });
    }
    if (isOverdueBacklog(a, today)) {
      notifications.push({
        id: `overdue-backlog:${a.id}`,
        type: "overdue-backlog",
        severity: "high",
        message: `"${a.task_name}" in the backlog was due ${toDisplayDate(a.due_date!)} — schedule it or push the due date.`,
        relatedAssignmentId: a.id,
      });
    } else if (isDueSoonBacklog(a, today, dueSoonHorizon)) {
      notifications.push({
        id: `due-soon-backlog:${a.id}`,
        type: "due-soon-backlog",
        severity: "medium",
        message: `"${a.task_name}" in the backlog is due ${toDisplayDate(a.due_date!)} and still isn't scheduled.`,
        relatedAssignmentId: a.id,
      });
    }
    if (
      a.is_urgent === 1 &&
      a.status !== "Completed" &&
      a.start_date !== null &&
      a.start_date >= today &&
      a.start_date <= dueSoonHorizon
    ) {
      notifications.push({
        id: `urgent-soon:${a.id}`,
        type: "urgent-soon",
        severity: "medium",
        message: `Urgent task "${a.task_name}" (${a.developer_name}) starts ${toDisplayDate(a.start_date!)}.`,
        relatedAssignmentId: a.id,
        relatedDeveloperId: a.developer_id ?? undefined,
      });
    }
    if (isStartingToday(a, today)) {
      notifications.push({
        id: `start-today:${a.id}`,
        type: "start-today",
        severity: "medium",
        message: `"${a.task_name}" (${a.developer_name}) is scheduled to start today — move it to Ongoing once it's underway.`,
        relatedAssignmentId: a.id,
        relatedDeveloperId: a.developer_id ?? undefined,
      });
    }
    if (needsCompletionCheck(a, yesterday)) {
      notifications.push({
        id: `verify-completion:${a.id}`,
        type: "verify-completion",
        severity: "low",
        message: `Check whether "${a.task_name}" (${a.developer_name}) got finished — it was due to end ${toDisplayDate(a.end_date!)}.`,
        relatedAssignmentId: a.id,
        relatedDeveloperId: a.developer_id ?? undefined,
      });
    }
  }

  // Overlap conflicts, grouped per developer (mirrors summary.ts's approach).
  const byDeveloper = new Map<number, AssignmentRow[]>();
  for (const a of assignments) {
    if (!a.developer_id || a.status === "Completed" || !a.start_date || !a.end_date) continue;
    const list = byDeveloper.get(a.developer_id) ?? [];
    list.push(a);
    byDeveloper.set(a.developer_id, list);
  }
  for (const [developerId, devAssignments] of byDeveloper) {
    const seen = new Set<number>();
    const conflictNames: string[] = [];
    for (const a of devAssignments) {
      const conflicts = findConflicts(
        { id: a.id, start_date: a.start_date!, end_date: a.end_date! },
        devAssignments
      );
      for (const c of conflicts) {
        if (!seen.has(c.id!)) {
          seen.add(c.id!);
          conflictNames.push(c.task_name);
        }
      }
    }
    if (conflictNames.length > 0) {
      const devName = devAssignments[0].developer_name;
      notifications.push({
        id: `conflict:${developerId}`,
        type: "conflict",
        severity: "high",
        message: `${devName} has overlapping tasks: ${conflictNames.join(", ")}.`,
        relatedDeveloperId: developerId,
      });
    }
  }

  // Leave starting soon while the developer still has active work in that window.
  const leaves = db
    .prepare(
      `SELECT l.id, l.developer_id, d.name AS developer_name, l.start_date, l.end_date
       FROM developer_leaves l JOIN developers d ON d.id = l.developer_id
       WHERE l.start_date >= ? AND l.start_date <= ?`
    )
    .all(today, leaveSoonHorizon) as LeaveRow[];

  for (const leave of leaves) {
    const overlapping = assignments.filter(
      (a) =>
        a.developer_id === leave.developer_id &&
        a.status !== "Completed" &&
        a.start_date !== null &&
        a.end_date !== null &&
        a.start_date <= leave.end_date &&
        leave.start_date <= a.end_date
    );
    if (overlapping.length > 0) {
      notifications.push({
        id: `leave-soon:${leave.id}`,
        type: "leave-soon",
        severity: "medium",
        message: `${leave.developer_name} is on leave from ${toDisplayDate(leave.start_date)} — ${overlapping.length} active task${
          overlapping.length === 1 ? "" : "s"
        } may need reassignment.`,
        relatedDeveloperId: leave.developer_id,
      });
    }
  }

  const severityRank: Record<NotificationSeverity, number> = { high: 0, medium: 1, low: 2 };
  notifications.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  return notifications;
}

notificationsRouter.get("/", (_req, res) => {
  res.json(buildNotifications());
});
