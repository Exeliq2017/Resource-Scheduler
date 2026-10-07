import { describe, expect, it } from "vitest";
import { isOverdueScheduled, isOverdueBacklog, isDueSoonBacklog } from "./overdue.js";

const today = "2026-09-17";

describe("isOverdueScheduled", () => {
  it("flags a non-completed task whose end date has passed", () => {
    expect(isOverdueScheduled({ end_date: "2026-09-16", status: "Planned" }, today)).toBe(true);
  });

  it("does not flag a Completed task even if its end date has passed", () => {
    expect(isOverdueScheduled({ end_date: "2026-09-16", status: "Completed" }, today)).toBe(false);
  });

  it("does not flag a task ending today or in the future", () => {
    expect(isOverdueScheduled({ end_date: "2026-09-17", status: "Planned" }, today)).toBe(false);
    expect(isOverdueScheduled({ end_date: "2026-09-18", status: "Planned" }, today)).toBe(false);
  });

  it("does not flag a backlog row (no end date)", () => {
    expect(isOverdueScheduled({ end_date: null, status: "Planned" }, today)).toBe(false);
  });
});

describe("isOverdueBacklog", () => {
  it("flags an unscheduled task whose due date has passed", () => {
    expect(
      isOverdueBacklog({ developer_id: null, start_date: null, end_date: null, due_date: "2026-09-16" }, today)
    ).toBe(true);
  });

  it("does not flag a fully scheduled task even with a past due date", () => {
    expect(
      isOverdueBacklog(
        { developer_id: 1, start_date: "2026-09-10", end_date: "2026-09-12", due_date: "2026-09-16" },
        today
      )
    ).toBe(false);
  });

  it("does not flag a backlog task with no due date set", () => {
    expect(isOverdueBacklog({ developer_id: null, start_date: null, end_date: null, due_date: null }, today)).toBe(
      false
    );
  });
});

describe("isDueSoonBacklog", () => {
  const horizon = "2026-09-19";

  it("flags a backlog task due within the horizon", () => {
    expect(
      isDueSoonBacklog({ developer_id: null, start_date: null, end_date: null, due_date: "2026-09-18" }, today, horizon)
    ).toBe(true);
  });

  it("does not flag one already overdue", () => {
    expect(
      isDueSoonBacklog({ developer_id: null, start_date: null, end_date: null, due_date: "2026-09-16" }, today, horizon)
    ).toBe(false);
  });

  it("does not flag one due after the horizon", () => {
    expect(
      isDueSoonBacklog({ developer_id: null, start_date: null, end_date: null, due_date: "2026-09-20" }, today, horizon)
    ).toBe(false);
  });

  it("does not flag a fully scheduled task", () => {
    expect(
      isDueSoonBacklog(
        { developer_id: 1, start_date: "2026-09-17", end_date: "2026-09-18", due_date: "2026-09-18" },
        today,
        horizon
      )
    ).toBe(false);
  });
});
