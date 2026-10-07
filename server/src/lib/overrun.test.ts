import { describe, expect, it } from "vitest";
import { computeExtendPlan, type OverrunTask } from "./overrun.js";

const TODAY = "2026-09-19";

function task(id: number, start: string, end: string, extra: Partial<OverrunTask> = {}): OverrunTask {
  return { id, task_name: `T${id}`, start_date: start, end_date: end, due_date: null, status: "Planned", is_fixed: 0, ...extra };
}

const overrunning = task(1, "2026-09-14", "2026-09-16", { status: "Ongoing" });

describe("computeExtendPlan", () => {
  it("extends from today, in working days, when the task is already overdue", () => {
    // 3 working days from Sat 19: Sat 19, Mon 21, Tue 22 (Sunday 20 is off)
    expect(computeExtendPlan(overrunning, 3, TODAY, []).newEnd).toBe("2026-09-22");
  });

  it("never lands the new end date on a non-working day", () => {
    // ends today (Sat 19); +1 day must skip Sunday 20 and land on Monday 21
    const endsToday = task(1, "2026-09-17", "2026-09-19", { status: "Ongoing" });
    expect(computeExtendPlan(endsToday, 1, TODAY, []).newEnd).toBe("2026-09-21");
  });

  it("skips holidays when extending", () => {
    const endsToday = task(1, "2026-09-17", "2026-09-19", { status: "Ongoing" });
    expect(computeExtendPlan(endsToday, 1, TODAY, [], new Set(["2026-09-21"])).newEnd).toBe("2026-09-22");
  });

  it("pushes an overlapping later task just past the new end, keeping its duration", () => {
    const plan = computeExtendPlan(overrunning, 3, TODAY, [task(2, "2026-09-20", "2026-09-22")]);
    expect(plan.moves).toEqual([
      { id: 2, taskName: "T2", oldStart: "2026-09-20", oldEnd: "2026-09-22", newStart: "2026-09-23", newEnd: "2026-09-24" },
    ]);
  });

  it("leaves tasks alone when nothing overlaps", () => {
    const plan = computeExtendPlan(overrunning, 3, TODAY, [task(2, "2026-09-25", "2026-09-26")]);
    expect(plan.moves).toHaveLength(0);
    expect(plan.warnings).toHaveLength(0);
  });

  it("cascades: a pushed task pushes the next one", () => {
    const plan = computeExtendPlan(overrunning, 3, TODAY, [
      task(2, "2026-09-20", "2026-09-21"),
      task(3, "2026-09-22", "2026-09-23"),
    ]);
    expect(plan.moves.map((m) => [m.id, m.newStart, m.newEnd])).toEqual([
      [2, "2026-09-23", "2026-09-23"],
      [3, "2026-09-24", "2026-09-25"],
    ]);
  });

  it("hops a moved task past a fixed task instead of overlapping it", () => {
    const plan = computeExtendPlan(overrunning, 3, TODAY, [
      task(2, "2026-09-20", "2026-09-22"),
      task(9, "2026-09-23", "2026-09-24", { is_fixed: 1 }),
    ]);
    expect(plan.moves).toHaveLength(1);
    expect(plan.moves[0]).toMatchObject({ id: 2, newStart: "2026-09-25", newEnd: "2026-09-28" });
    expect(plan.warnings).toHaveLength(0);
  });

  it("never moves a fixed task and warns when the extension runs into it", () => {
    const plan = computeExtendPlan(overrunning, 3, TODAY, [task(9, "2026-09-20", "2026-09-21", { is_fixed: 1 })]);
    expect(plan.moves).toHaveLength(0);
    expect(plan.warnings).toHaveLength(1);
    expect(plan.warnings[0]).toContain("T9");
  });

  it("warns when a moved task now finishes after its due date", () => {
    const plan = computeExtendPlan(overrunning, 3, TODAY, [task(2, "2026-09-20", "2026-09-22", { due_date: "2026-09-23" })]);
    expect(plan.warnings.some((w) => w.includes("due date"))).toBe(true);
  });

  it("ignores completed tasks", () => {
    const plan = computeExtendPlan(overrunning, 3, TODAY, [task(2, "2026-09-20", "2026-09-22", { status: "Completed" })]);
    expect(plan.moves).toHaveLength(0);
  });
});
