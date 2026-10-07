import { describe, expect, it } from "vitest";
import { isDeveloperOnLeave, type LeaveRow } from "./leaves.js";

function makeMap(rows: LeaveRow[]): Map<number, LeaveRow[]> {
  const map = new Map<number, LeaveRow[]>();
  for (const row of rows) {
    const list = map.get(row.developer_id) ?? [];
    list.push(row);
    map.set(row.developer_id, list);
  }
  return map;
}

describe("isDeveloperOnLeave", () => {
  const leave: LeaveRow = { id: 1, developer_id: 1, start_date: "2026-09-20", end_date: "2026-09-22", reason: "Vacation" };
  const leavesByDeveloper = makeMap([leave]);

  it("returns the leave when the date falls inside the range (inclusive)", () => {
    expect(isDeveloperOnLeave(1, "2026-09-20", leavesByDeveloper)).toEqual(leave);
    expect(isDeveloperOnLeave(1, "2026-09-21", leavesByDeveloper)).toEqual(leave);
    expect(isDeveloperOnLeave(1, "2026-09-22", leavesByDeveloper)).toEqual(leave);
  });

  it("returns null just outside the range", () => {
    expect(isDeveloperOnLeave(1, "2026-09-19", leavesByDeveloper)).toBeNull();
    expect(isDeveloperOnLeave(1, "2026-09-23", leavesByDeveloper)).toBeNull();
  });

  it("returns null for a developer with no leave rows at all", () => {
    expect(isDeveloperOnLeave(2, "2026-09-21", leavesByDeveloper)).toBeNull();
  });
});
