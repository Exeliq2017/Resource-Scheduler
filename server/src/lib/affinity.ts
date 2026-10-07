import { db } from "../db/connection.js";

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "into", "onto", "this", "that", "task", "issue", "project", "work", "new",
]);

/** Splits a task name into lowercase keywords, dropping stopwords and short tokens. */
export function extractKeywords(taskName: string): string[] {
  const tokens = taskName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  return Array.from(new Set(tokens));
}

// ~1% decay per day so stale specialties fade as the team's work shifts.
const DAILY_DECAY = 0.99;

function decay(score: number, updatedAt: string, now: Date): number {
  const days = Math.max(0, (now.getTime() - new Date(updatedAt).getTime()) / 86_400_000);
  return score * Math.pow(DAILY_DECAY, days);
}

interface AffinityRow {
  keyword: string;
  developer_id: number;
  score: number;
  updated_at: string;
}

/**
 * Bumps affinity between a task's keywords and a developer — called when a task is
 * completed (small weight) or a suggestion is accepted (larger weight). This is what
 * lets the local engine need Claude less over time as real history accumulates.
 */
export function recordOutcome(taskName: string, developerId: number, weight: number, now: Date = new Date()): void {
  const keywords = extractKeywords(taskName);
  if (keywords.length === 0) return;

  const get = db.prepare("SELECT score, updated_at FROM task_affinity WHERE keyword = ? AND developer_id = ?");
  const upsert = db.prepare(`
    INSERT INTO task_affinity (keyword, developer_id, score, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(keyword, developer_id) DO UPDATE SET score = excluded.score, updated_at = excluded.updated_at
  `);

  const run = db.transaction((words: string[]) => {
    for (const keyword of words) {
      const existing = get.get(keyword, developerId) as AffinityRow | undefined;
      const base = existing ? decay(existing.score, existing.updated_at, now) : 0;
      upsert.run(keyword, developerId, base + weight);
    }
  });
  run(keywords);
}

/** Aggregate learned affinity between a task name and one developer — 0 if no history. */
export function getAffinityScore(taskName: string, developerId: number, now: Date = new Date()): number {
  const keywords = extractKeywords(taskName);
  if (keywords.length === 0) return 0;

  const placeholders = keywords.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT keyword, developer_id, score, updated_at FROM task_affinity WHERE developer_id = ? AND keyword IN (${placeholders})`)
    .all(developerId, ...keywords) as AffinityRow[];

  return rows.reduce((sum, r) => sum + decay(r.score, r.updated_at, now), 0);
}
