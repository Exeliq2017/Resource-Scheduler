import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { developersRouter } from "./routes/developers.js";
import { assignmentsRouter } from "./routes/assignments.js";
import { availabilityRouter } from "./routes/availability.js";
import { scheduleRouter } from "./routes/schedule.js";
import { weeklyWorkloadRouter } from "./routes/weeklyWorkload.js";
import { urgentShiftRouter } from "./routes/urgentShift.js";
import { holidaysRouter } from "./routes/holidays.js";
import { importExportRouter } from "./routes/importExport.js";
import { summaryRouter } from "./routes/summary.js";
import { leavesRouter } from "./routes/leaves.js";
import { notificationsRouter } from "./routes/notifications.js";
import { aiRouter } from "./routes/ai.js";
import { overrunRouter } from "./routes/overrun.js";
import { settingsRouter } from "./routes/settings.js";
import { plannerRouter } from "./routes/planner.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/developers", developersRouter);
app.use("/api/assignments", assignmentsRouter);
app.use("/api/availability", availabilityRouter);
app.use("/api/schedule", scheduleRouter);
app.use("/api/weekly-workload", weeklyWorkloadRouter);
app.use("/api/urgent-shift", urgentShiftRouter);
app.use("/api/holidays", holidaysRouter);
app.use("/api/import-export", importExportRouter);
app.use("/api/summary", summaryRouter);
app.use("/api/leaves", leavesRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/ai", aiRouter);
app.use("/api/overrun", overrunRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/planner", plannerRouter);

// Serve the built client in production-style local runs (npm run build && npm start).
const clientDist = path.resolve(__dirname, "../../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, () => {
  console.log(`Resource Scheduler API listening on http://localhost:${PORT}`);
});
