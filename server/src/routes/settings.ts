import { Router } from "express";
import { getPlannerDays, setSetting, PLANNER_DAYS_MAX, PLANNER_DAYS_MIN } from "../lib/appSettings.js";

export const settingsRouter = Router();

settingsRouter.get("/", (_req, res) => {
  res.json({ plannerDays: getPlannerDays() });
});

settingsRouter.put("/", (req, res) => {
  const { plannerDays } = req.body as { plannerDays?: number };
  if (plannerDays !== undefined) {
    if (!Number.isInteger(plannerDays) || plannerDays < PLANNER_DAYS_MIN || plannerDays > PLANNER_DAYS_MAX) {
      return res.status(400).json({ error: `plannerDays must be a whole number from ${PLANNER_DAYS_MIN} to ${PLANNER_DAYS_MAX}` });
    }
    setSetting("planner_days", String(plannerDays));
  }
  res.json({ plannerDays: getPlannerDays() });
});
