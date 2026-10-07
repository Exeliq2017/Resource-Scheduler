import { describe, expect, it } from "vitest";
import { findEarliestSlot } from "./slotFinder.js";

describe("findEarliestSlot", () => {
  it("returns the next working day when there are no busy ranges", () => {
    // 2026-09-18 is a Friday (working day)
    expect(findEarliestSlot([], 3, undefined, new Date(2026, 8, 18))).toBe("2026-09-18");
  });

  it("skips a Sunday to land on the next working day", () => {
    // 2026-09-19 is a Saturday (working); 2026-09-20 is a Sunday
    expect(findEarliestSlot([], 1, undefined, new Date(2026, 8, 19))).toBe("2026-09-19");
    expect(findEarliestSlot([{ start: "2026-09-19", end: "2026-09-19" }], 1, undefined, new Date(2026, 8, 19))).toBe(
      "2026-09-21"
    );
  });

  it("fits into a gap between two busy ranges when the gap is long enough", () => {
    const busy = [
      { start: "2026-09-17", end: "2026-09-19" },
      { start: "2026-09-25", end: "2026-09-30" },
    ];
    // Gap is 2026-09-21 .. 2026-09-24 (4 calendar days) — a 3-day task fits.
    expect(findEarliestSlot(busy, 3, undefined, new Date(2026, 8, 18))).toBe("2026-09-21");
  });

  it("skips a gap that's too short and lands after the next busy range", () => {
    const busy = [
      { start: "2026-09-17", end: "2026-09-19" },
      { start: "2026-09-22", end: "2026-09-24" },
    ];
    // Gap is only 2026-09-21 (1 day) — a 3-day task doesn't fit, so it lands after the 2nd range.
    expect(findEarliestSlot(busy, 3, undefined, new Date(2026, 8, 18))).toBe("2026-09-25");
  });

  it("matches the real Priyansh regression: a 5-day task fits in the gap before his later task", () => {
    const busy = [
      { start: "2026-09-17", end: "2026-09-19" },
      { start: "2026-09-28", end: "2026-10-01" },
    ];
    expect(findEarliestSlot(busy, 5, undefined, new Date(2026, 8, 18))).toBe("2026-09-21");
  });

  it("falls back to after the last busy range when nothing earlier fits", () => {
    const busy = [
      { start: "2026-09-17", end: "2026-09-19" },
      { start: "2026-09-21", end: "2026-09-23" },
      { start: "2026-09-24", end: "2026-09-30" },
    ];
    expect(findEarliestSlot(busy, 5, undefined, new Date(2026, 8, 18))).toBe("2026-10-01");
  });

  it("merges overlapping and touching ranges before scanning for gaps", () => {
    const busy = [
      { start: "2026-09-17", end: "2026-09-20" },
      { start: "2026-09-19", end: "2026-09-22" }, // overlaps the first
      { start: "2026-09-23", end: "2026-09-24" }, // touches the merged range
    ];
    expect(findEarliestSlot(busy, 1, undefined, new Date(2026, 8, 18))).toBe("2026-09-25");
  });
});
