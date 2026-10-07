import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { db } from "../db/connection.js";
import { suggestAllocation, suggestAllForBacklog, type SuggestionCandidate } from "../lib/suggestionEngine.js";
import { recordOutcome } from "../lib/affinity.js";
import { getAIInsight, isClaudeConfigured } from "../lib/aiClient.js";

export const aiRouter = Router();

const ENV_PATH = path.join(process.cwd(), ".env");

function writeEnvKey(key: string, value: string): void {
  const existing = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf-8") : "";
  const lines = existing.split("\n").filter((line) => line.trim().length > 0 && !line.startsWith(`${key}=`));
  lines.push(`${key}=${value}`);
  fs.writeFileSync(ENV_PATH, lines.join("\n") + "\n", "utf-8");
}

// Whether the Claude layer is configured — never returns the key itself.
aiRouter.get("/config", (_req, res) => {
  res.json({ configured: isClaudeConfigured() });
});

aiRouter.post("/config", (req, res) => {
  const { apiKey } = req.body as { apiKey?: string };
  if (!apiKey || !apiKey.trim()) {
    return res.status(400).json({ error: "apiKey is required" });
  }
  writeEnvKey("ANTHROPIC_API_KEY", apiKey.trim());
  process.env.ANTHROPIC_API_KEY = apiKey.trim();
  res.json({ configured: true });
});

// Top local suggestion for every backlog task in one call, for rendering chips without N requests.
aiRouter.get("/suggestions/backlog", (_req, res) => {
  res.json(suggestAllForBacklog());
});

aiRouter.post("/suggest/:assignmentId", async (req, res) => {
  const assignmentId = Number(req.params.assignmentId);
  const { useClaude } = req.body as { useClaude?: boolean };

  const candidates = suggestAllocation(assignmentId);
  if (candidates.length === 0) {
    return res.status(404).json({ error: "assignment not found" });
  }

  let narrative: string | null = null;
  if (useClaude) {
    const task = db.prepare("SELECT task_name, priority, due_date FROM assignments WHERE id = ?").get(assignmentId) as
      | { task_name: string; priority: string; due_date: string | null }
      | undefined;
    if (task) {
      const top = candidates.slice(0, 3);
      const prompt = `A backlog task "${task.task_name}" (priority ${task.priority}, due ${task.due_date ?? "no due date"}) needs a developer. Local scoring ranked these candidates:\n${top
        .map((c) => `- ${c.developerName}: score ${c.score}, ${c.reasons.join("; ")}`)
        .join("\n")}\nIn 2-3 sentences, give a concise recommendation and note any risk. Plain text, no markdown.`;
      narrative = await getAIInsight(prompt);
    }
  }

  res.json({ candidates, narrative, source: narrative ? "claude" : "local" });
});

aiRouter.get("/insights", async (_req, res) => {
  const suggestions = suggestAllForBacklog();
  const entries = Object.entries(suggestions).filter(
    (entry): entry is [string, SuggestionCandidate] => entry[1] !== null
  );

  if (entries.length === 0) {
    return res.json({ source: "local", summary: "Backlog is empty — nothing needs allocating right now.", suggestions: [] });
  }

  const taskRows = db
    .prepare(`SELECT id, task_name FROM assignments WHERE id IN (${entries.map(() => "?").join(",")})`)
    .all(...entries.map(([id]) => Number(id))) as { id: number; task_name: string }[];
  const taskNameById = new Map(taskRows.map((r) => [r.id, r.task_name]));

  const digest = entries
    .map(([id, s]) => ({ assignmentId: Number(id), taskName: taskNameById.get(Number(id)) ?? "", ...s }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  let summary = `${digest.length} backlog task(s) ready to allocate. Top pick: "${digest[0].taskName}" → ${digest[0].developerName}.`;
  let source: "local" | "claude" = "local";

  if (isClaudeConfigured()) {
    const prompt = `Backlog allocation suggestions from a local scoring engine:\n${digest
      .map((d) => `- "${d.taskName}" → ${d.developerName} (score ${d.score}${d.meetsDueDate ? "" : ", MISSES DUE DATE"})`)
      .join("\n")}\nWrite a 2-3 sentence prioritization digest for a team lead glancing at their dashboard. Call out anything missing its due date first. Plain text, no markdown.`;
    const claudeSummary = await getAIInsight(prompt);
    if (claudeSummary) {
      summary = claudeSummary;
      source = "claude";
    }
  }

  res.json({ source, summary, suggestions: digest });
});

aiRouter.post("/feedback", (req, res) => {
  const { taskName, developerId, weight } = req.body as { taskName?: string; developerId?: number; weight?: number };
  if (!taskName || !developerId) {
    return res.status(400).json({ error: "taskName and developerId are required" });
  }
  recordOutcome(taskName, developerId, weight ?? 2);
  res.status(204).end();
});

// Wipes learned developer/task affinity — an opt-in reset if history skews suggestions
// (e.g. from earlier testing) or the team's specialties have genuinely shifted.
aiRouter.delete("/affinity", (_req, res) => {
  db.prepare("DELETE FROM task_affinity").run();
  res.status(204).end();
});
