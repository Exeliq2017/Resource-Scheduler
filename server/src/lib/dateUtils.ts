export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function todayDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Hour of day (local time) after which no new work is suggested for the same day. */
export const SUGGESTION_CUTOFF_HOUR = 17;

/**
 * The earliest calendar day a *suggestion* may start on: today, unless it's already past the
 * cutoff (5 PM) — then the rest of today is treated as gone and suggestions begin tomorrow.
 */
export function earliestSuggestionDate(now: Date = new Date(), cutoffHour: number = SUGGESTION_CUTOFF_HOUR): Date {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return now.getHours() >= cutoffHour ? addDays(today, 1) : today;
}

export function todayISO(): string {
  return toISODate(todayDate());
}

export function maxDate(a: Date, b: Date): Date {
  return a.getTime() > b.getTime() ? a : b;
}

/** "2026-09-28" -> "28-09-2026", for user-facing message strings (notifications, activity log, reasons). */
export function toDisplayDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}
