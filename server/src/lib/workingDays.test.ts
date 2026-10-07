import { describe, expect, it } from "vitest";
import { isNonWorkingDay, nextWorkingDay, countWorkingDaysInRange } from "./workingDays.js";

// May 2026: Saturdays fall on 2, 9, 16, 23, 30 -> 2nd Sat = 9th, 4th Sat = 23rd.
const d = (day: number) => new Date(2026, 4, day);

describe("isNonWorkingDay", () => {
  it("marks every Sunday as non-working", () => {
    for (const day of [3, 10, 17, 24, 31]) {
      expect(isNonWorkingDay(d(day))).toBe(true);
    }
  });

  it("marks the 2nd and 4th Saturday as non-working", () => {
    expect(isNonWorkingDay(d(9))).toBe(true);
    expect(isNonWorkingDay(d(23))).toBe(true);
  });

  it("keeps the 1st, 3rd and 5th Saturday as working", () => {
    expect(isNonWorkingDay(d(2))).toBe(false);
    expect(isNonWorkingDay(d(16))).toBe(false);
    expect(isNonWorkingDay(d(30))).toBe(false);
  });

  it("treats Mon-Fri as working days", () => {
    for (const day of [4, 5, 6, 7, 8]) {
      expect(isNonWorkingDay(d(day))).toBe(false);
    }
  });

  it("respects an extra configured holiday", () => {
    const holidays = new Set(["2026-05-06"]); // a Wednesday
    expect(isNonWorkingDay(d(6), holidays)).toBe(true);
    expect(isNonWorkingDay(d(7), holidays)).toBe(false);
  });
});

describe("nextWorkingDay", () => {
  it("returns the same day if already working", () => {
    expect(nextWorkingDay(d(4)).getDate()).toBe(4);
  });

  it("skips a single off day (Sunday)", () => {
    expect(nextWorkingDay(d(3)).getDate()).toBe(4);
  });

  it("skips a run of off days (4th Saturday into Sunday)", () => {
    // 23rd (off, 4th Sat) and 24th (Sunday) are both off; 25th is a working Monday.
    expect(nextWorkingDay(d(23)).getDate()).toBe(25);
  });
});

describe("countWorkingDaysInRange", () => {
  it("counts working days in a Mon-Sat block containing an off Saturday", () => {
    // Mon 25 .. Sat 30 (30th is a working 5th Saturday) => all 6 days working.
    expect(countWorkingDaysInRange(d(25), d(30))).toBe(6);
    // Mon 4 .. Sat 9 (9th is the off 2nd Saturday) => 5 working days.
    expect(countWorkingDaysInRange(d(4), d(9))).toBe(5);
  });
});
