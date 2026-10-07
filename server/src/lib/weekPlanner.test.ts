import { describe, expect, it } from "vitest";
import { planFill, type PlannerBacklogTask, type PlannerDev } from "./weekPlanner.js";

// Sat 19-09-2026 (working, 3rd Saturday), Sun 20 off, Mon 21 .. Fri 25 working.
const TODAY = new Date(2026, 8, 19);
const WINDOW = { windowStart: "2026-09-19", windowEnd: "2026-09-25" };
const noAffinity = () => 0;

function dev(id: number, busy: { start: string; end: string }[] = [], extra: Partial<PlannerDev> = {}): PlannerDev {
  return { id, name: `Dev${id}`, excluded: false, busy, activeTaskCount: 0, ...extra };
}
function task(id: number, extra: Partial<PlannerBacklogTask> = {}): PlannerBacklogTask {
  return {
    id,
    task_name: `Task${id}`,
    priority: "Medium",
    due_date: null,
    estimated_days: 1,
    preferred_developer_id: null,
    created_at: `2026-09-0${id} 10:00:00`,
    ...extra,
  };
}
function plan(developers: PlannerDev[], backlog: PlannerBacklogTask[], holidays = new Set<string>(), affinity = noAffinity) {
  return planFill({ ...WINDOW, today: TODAY, holidays, developers, backlog, affinity });
}

describe("planFill", () => {
  it("fills a gap in the middle of the window", () => {
    const { proposals } = plan(
      [dev(1, [{ start: "2026-09-19", end: "2026-09-19" }, { start: "2026-09-23", end: "2026-09-30" }])],
      [task(1, { estimated_days: 2 })]
    );
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({ developerId: 1, start: "2026-09-21", end: "2026-09-22" });
  });

  it("leaves a task unplaced when the developer is booked (or on leave) all window long", () => {
    const { proposals, unplaced } = plan([dev(1, [{ start: "2026-09-19", end: "2026-09-25" }])], [task(1)]);
    expect(proposals).toHaveLength(0);
    expect(unplaced).toHaveLength(1);
  });

  it("skips holidays when finding the first free day", () => {
    const { proposals } = plan([dev(1)], [task(1)], new Set(["2026-09-19"]));
    expect(proposals[0].start).toBe("2026-09-21");
  });

  it("prefers the task's preferred developer", () => {
    const { proposals } = plan([dev(1), dev(2)], [task(1, { preferred_developer_id: 2 })]);
    expect(proposals[0].developerId).toBe(2);
    expect(proposals[0].reasons[0]).toContain("Preferred");
  });

  it("skips developers excluded from suggestions unless they are the preferred developer", () => {
    const lead = dev(1, [], { excluded: true });
    const busy = dev(2, [{ start: "2026-09-19", end: "2026-09-24" }]);
    expect(plan([lead, busy], [task(1)]).proposals[0]).toMatchObject({ developerId: 2, start: "2026-09-25" });
    expect(plan([lead, busy], [task(1, { preferred_developer_id: 1 })]).proposals[0].developerId).toBe(1);
  });

  it("stacks tasks for one developer without overlap", () => {
    const { proposals } = plan([dev(1)], [task(1, { estimated_days: 2 }), task(2, { estimated_days: 2 })]);
    expect(proposals.map((p) => [p.start, p.end])).toEqual([
      ["2026-09-19", "2026-09-20"],
      ["2026-09-21", "2026-09-22"],
    ]);
  });

  it("places the soonest-due task first", () => {
    const { proposals } = plan(
      [dev(1)],
      [task(1, { due_date: "2026-10-30" }), task(2, { due_date: "2026-09-22" }), task(3)]
    );
    expect(proposals.map((p) => p.assignmentId)).toEqual([2, 1, 3]);
  });

  it("spreads load across equally free developers", () => {
    const { proposals } = plan([dev(1), dev(2)], [task(1), task(2)]);
    expect(new Set(proposals.map((p) => p.developerId)).size).toBe(2);
  });

  it("reports slack and flags a missed due date", () => {
    const ok = plan([dev(1)], [task(1, { due_date: "2026-09-30" })]).proposals[0];
    expect(ok.meetsDueDate).toBe(true);
    expect(ok.reasons.some((r) => r.includes("before"))).toBe(true);
    const late = plan([dev(1)], [task(1, { due_date: "2026-09-18" })]).proposals[0];
    expect(late.meetsDueDate).toBe(false);
  });

  it("lets a task start inside the window even if it runs past the end", () => {
    const { proposals } = plan([dev(1, [{ start: "2026-09-19", end: "2026-09-24" }])], [task(1, { estimated_days: 3 })]);
    expect(proposals[0]).toMatchObject({ start: "2026-09-25", end: "2026-09-27" });
  });

  it("never hands a preferred-developer task to someone else — it goes to `later` if they are booked", () => {
    const booked = dev(1, [{ start: "2026-09-19", end: "2026-09-25" }]);
    const free = dev(2);
    const result = plan([booked, free], [task(1, { preferred_developer_id: 1 })]);
    expect(result.proposals).toHaveLength(0);
    expect(result.later).toHaveLength(1);
    expect(result.later[0]).toMatchObject({ developerId: 1, start: "2026-09-28" });
    expect(result.later[0].reasons.join(" ")).toContain("no free slot in this window");
  });

  it("gives preferred-developer tasks first claim on a developer's free slot", () => {
    // One free day-slot for dev 1; the general task is more urgent, but the preferred task still gets it.
    const d1 = dev(1, [{ start: "2026-09-19", end: "2026-09-23" }, { start: "2026-09-25", end: "2026-09-30" }]);
    const result = plan(
      [d1],
      [task(1, { due_date: "2026-09-21" }), task(2, { preferred_developer_id: 1, due_date: "2026-10-30" })]
    );
    expect(result.proposals.map((p) => p.assignmentId)).toEqual([2]);
    expect(result.proposals[0]).toMatchObject({ developerId: 1, start: "2026-09-24" });
  });
});
