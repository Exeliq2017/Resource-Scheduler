import { describe, expect, it } from "vitest";
import { computeUrgentShiftPreview, type AffectedAssignment } from "./urgentShift.js";

describe("computeUrgentShiftPreview", () => {
  it("returns no affected rows when nothing overlaps the urgent window", () => {
    const preview = computeUrgentShiftPreview("2026-05-18", 3, "Shift", []);
    expect(preview.urgentEnd).toBe("2026-05-20");
    expect(preview.affected).toHaveLength(0);
  });

  it("Shift mode: extends the ongoing task's end and slides upcoming tasks forward", () => {
    const assignments: AffectedAssignment[] = [
      { id: 1, task_name: "Ongoing Task", start_date: "2026-05-10", end_date: "2026-05-20", status: "Planned" },
      { id: 2, task_name: "Upcoming Task", start_date: "2026-05-22", end_date: "2026-05-25", status: "Ongoing" },
      {
        id: 3,
        task_name: "Completed Task",
        start_date: "2026-05-01",
        end_date: "2026-05-19",
        status: "Completed",
      },
    ];

    const preview = computeUrgentShiftPreview("2026-05-18", 3, "Shift", assignments);

    expect(preview.affected.map((a) => a.id)).toEqual([1, 2]); // completed task excluded

    const ongoing = preview.affected.find((a) => a.id === 1)!;
    expect(ongoing.type).toBe("ONGOING");
    expect(ongoing.newStart).toBe("2026-05-10"); // unchanged
    expect(ongoing.newEnd).toBe("2026-05-23"); // 20 + 3 days
    expect(ongoing.followUp).toBeUndefined();

    const upcoming = preview.affected.find((a) => a.id === 2)!;
    expect(upcoming.type).toBe("UPCOMING");
    expect(upcoming.newStart).toBe("2026-05-25"); // 22 + 3 days
    expect(upcoming.newEnd).toBe("2026-05-28"); // 25 + 3 days
  });

  it("Split mode: cuts the ongoing task short and produces a follow-up row", () => {
    const assignments: AffectedAssignment[] = [
      { id: 1, task_name: "Ongoing Task", start_date: "2026-05-10", end_date: "2026-05-20", status: "Planned" },
    ];

    const preview = computeUrgentShiftPreview("2026-05-18", 3, "Split", assignments);
    const row = preview.affected[0];

    expect(row.newStart).toBe("2026-05-10"); // unchanged
    expect(row.newEnd).toBe("2026-05-17"); // day before urgent start
    expect(row.followUp).toEqual({ start: "2026-05-21", end: "2026-05-23" }); // urgentEnd+1 .. originalEnd+duration
  });

  it("edge case: a task ending exactly on the urgent start date is still included and treated as ongoing", () => {
    const assignments: AffectedAssignment[] = [
      { id: 1, task_name: "Edge Task", start_date: "2026-05-15", end_date: "2026-05-18", status: "Planned" },
    ];

    const preview = computeUrgentShiftPreview("2026-05-18", 3, "Shift", assignments);
    expect(preview.affected).toHaveLength(1);
    expect(preview.affected[0].type).toBe("ONGOING");
    expect(preview.affected[0].newEnd).toBe("2026-05-21");
  });

  it("multiple upcoming tasks each preserve their own duration and relative gap", () => {
    const assignments: AffectedAssignment[] = [
      { id: 1, task_name: "First", start_date: "2026-05-22", end_date: "2026-05-23", status: "Planned" },
      { id: 2, task_name: "Second", start_date: "2026-05-26", end_date: "2026-05-27", status: "Planned" },
    ];

    const preview = computeUrgentShiftPreview("2026-05-18", 3, "Shift", assignments);
    const first = preview.affected.find((a) => a.id === 1)!;
    const second = preview.affected.find((a) => a.id === 2)!;

    expect(first.newStart).toBe("2026-05-25");
    expect(first.newEnd).toBe("2026-05-26");
    expect(second.newStart).toBe("2026-05-29");
    expect(second.newEnd).toBe("2026-05-30");
    // Gap between the two tasks (2 days) is preserved after the shift.
  });
});
