import { describe, expect, it } from "vitest";
import { isStartingToday, needsCompletionCheck } from "./reminders.js";

describe("isStartingToday", () => {
  const base = { developer_id: 1, start_date: "2026-09-17", end_date: "2026-09-19", status: "Planned" };

  it("flags a fully scheduled Planned task starting today", () => {
    expect(isStartingToday(base, "2026-09-17")).toBe(true);
  });

  it("ignores a task already moved to Ongoing", () => {
    expect(isStartingToday({ ...base, status: "Ongoing" }, "2026-09-17")).toBe(false);
  });

  it("ignores a task starting on a different day", () => {
    expect(isStartingToday(base, "2026-09-18")).toBe(false);
  });

  it("ignores a backlog task missing a developer", () => {
    expect(isStartingToday({ ...base, developer_id: null }, "2026-09-17")).toBe(false);
  });
});

describe("needsCompletionCheck", () => {
  it("flags a task whose end date was yesterday and isn't Completed", () => {
    expect(needsCompletionCheck({ end_date: "2026-09-16", status: "Ongoing" }, "2026-09-16")).toBe(true);
  });

  it("ignores an already Completed task", () => {
    expect(needsCompletionCheck({ end_date: "2026-09-16", status: "Completed" }, "2026-09-16")).toBe(false);
  });

  it("ignores a task that didn't end yesterday", () => {
    expect(needsCompletionCheck({ end_date: "2026-09-14", status: "Ongoing" }, "2026-09-16")).toBe(false);
  });

  it("ignores a task with no end date", () => {
    expect(needsCompletionCheck({ end_date: null, status: "Ongoing" }, "2026-09-16")).toBe(false);
  });
});
