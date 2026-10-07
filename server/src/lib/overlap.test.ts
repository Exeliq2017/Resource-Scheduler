import { describe, expect, it } from "vitest";
import { rangesOverlap, findConflicts, type AssignmentRange } from "./overlap.js";

describe("rangesOverlap", () => {
  it("detects overlapping ranges", () => {
    expect(rangesOverlap("2026-05-10", "2026-05-15", "2026-05-14", "2026-05-20")).toBe(true);
  });

  it("detects touching ranges as overlapping (inclusive)", () => {
    expect(rangesOverlap("2026-05-10", "2026-05-15", "2026-05-15", "2026-05-20")).toBe(true);
  });

  it("returns false for disjoint ranges", () => {
    expect(rangesOverlap("2026-05-10", "2026-05-15", "2026-05-16", "2026-05-20")).toBe(false);
  });
});

describe("findConflicts", () => {
  const existing: AssignmentRange[] = [
    { id: 1, start_date: "2026-05-10", end_date: "2026-05-15", status: "Planned", task_name: "A" },
    { id: 2, start_date: "2026-05-20", end_date: "2026-05-25", status: "Completed", task_name: "B" },
  ];

  it("flags an overlapping non-completed task", () => {
    const conflicts = findConflicts({ start_date: "2026-05-12", end_date: "2026-05-13" }, existing);
    expect(conflicts.map((c) => c.id)).toEqual([1]);
  });

  it("ignores Completed tasks even if dates overlap", () => {
    const conflicts = findConflicts({ start_date: "2026-05-21", end_date: "2026-05-22" }, existing);
    expect(conflicts).toHaveLength(0);
  });

  it("excludes the row itself when editing", () => {
    const conflicts = findConflicts({ id: 1, start_date: "2026-05-10", end_date: "2026-05-15" }, existing);
    expect(conflicts).toHaveLength(0);
  });
});

describe("findConflicts — day_part", () => {
  const dayOf = (id: number, day_part: "FULL" | "AM" | "PM"): AssignmentRange => ({
    id,
    start_date: "2026-06-01",
    end_date: "2026-06-01",
    status: "Planned",
    task_name: `task-${id}`,
    day_part,
  });

  it("flags AM+AM on the same day as a conflict", () => {
    const conflicts = findConflicts(
      { start_date: "2026-06-01", end_date: "2026-06-01", day_part: "AM" },
      [dayOf(1, "AM")]
    );
    expect(conflicts.map((c) => c.id)).toEqual([1]);
  });

  it("allows AM+PM on the same day", () => {
    const conflicts = findConflicts(
      { start_date: "2026-06-01", end_date: "2026-06-01", day_part: "PM" },
      [dayOf(1, "AM")]
    );
    expect(conflicts).toHaveLength(0);
  });

  it("flags AM+FULL on the same day as a conflict", () => {
    const conflicts = findConflicts(
      { start_date: "2026-06-01", end_date: "2026-06-01", day_part: "AM" },
      [dayOf(1, "FULL")]
    );
    expect(conflicts.map((c) => c.id)).toEqual([1]);
  });

  it("flags FULL+PM on the same day as a conflict", () => {
    const conflicts = findConflicts(
      { start_date: "2026-06-01", end_date: "2026-06-01", day_part: "FULL" },
      [dayOf(1, "PM")]
    );
    expect(conflicts.map((c) => c.id)).toEqual([1]);
  });

  it("treats a multi-day overlap as a conflict regardless of day_part", () => {
    const multiDay: AssignmentRange = {
      id: 2,
      start_date: "2026-06-01",
      end_date: "2026-06-03",
      status: "Planned",
      task_name: "multi",
      day_part: "FULL",
    };
    const conflicts = findConflicts(
      { start_date: "2026-06-01", end_date: "2026-06-01", day_part: "AM" },
      [multiDay]
    );
    expect(conflicts.map((c) => c.id)).toEqual([2]);
  });

  it("treats missing day_part as FULL", () => {
    const noPartRow: AssignmentRange = {
      id: 3,
      start_date: "2026-06-01",
      end_date: "2026-06-01",
      status: "Planned",
      task_name: "no-part",
    };
    const conflicts = findConflicts(
      { start_date: "2026-06-01", end_date: "2026-06-01", day_part: "AM" },
      [noPartRow]
    );
    expect(conflicts.map((c) => c.id)).toEqual([3]);
  });
});
