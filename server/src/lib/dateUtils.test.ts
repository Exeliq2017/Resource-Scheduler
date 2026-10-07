import { describe, expect, it } from "vitest";
import { earliestSuggestionDate, toISODate } from "./dateUtils.js";

describe("earliestSuggestionDate", () => {
  it("is today before the 5 PM cutoff", () => {
    expect(toISODate(earliestSuggestionDate(new Date(2026, 8, 19, 9, 30)))).toBe("2026-09-19");
    expect(toISODate(earliestSuggestionDate(new Date(2026, 8, 19, 16, 59)))).toBe("2026-09-19");
  });

  it("is tomorrow from 5 PM onwards, including just before midnight", () => {
    expect(toISODate(earliestSuggestionDate(new Date(2026, 8, 19, 17, 0)))).toBe("2026-09-20");
    expect(toISODate(earliestSuggestionDate(new Date(2026, 8, 19, 23, 50)))).toBe("2026-09-20");
  });

  it("rolls over month ends", () => {
    expect(toISODate(earliestSuggestionDate(new Date(2026, 8, 30, 18, 0)))).toBe("2026-10-01");
  });

  it("returns a date-only value (midnight)", () => {
    expect(earliestSuggestionDate(new Date(2026, 8, 19, 20, 15)).getHours()).toBe(0);
  });
});
