// Training-phase calendar (12 Week Year cycles) + phase-aware set defaults.
//
// The 12 Week Year plan (~/12-week-year-2026-27.md) runs 3 cycles per school
// year; weeks 3/6/9/12 of each cycle are deloads (~65–70% of working weights).
// This mirrors the deload calendar Hermes uses for the daily briefing
// (analysis/daily_briefing.py CYCLE_STARTS/DELOAD_WEEKS) so the app and the
// agent can never disagree about what week it is. Pure TS — unit-tested.

export interface Cycle {
  /** Monday of week 1. */
  start: string; // YYYY-MM-DD
  label: string;
}

// School year 2026/27 cycles (12 weeks + 13th review week each).
export const CYCLES: Cycle[] = [
  { start: '2026-09-07', label: 'Cycle 1 — Build the systems' },
  { start: '2026-12-07', label: 'Cycle 2 — Deep work' },
  { start: '2027-03-08', label: 'Cycle 3 — End-year push' },
];

export const DELOAD_WEEKS: ReadonlySet<number> = new Set([3, 6, 9, 12]);

/** Deload multiplier applied to last-time weights (briefing says ~65–70%). */
export const DELOAD_FACTOR = 0.675;

/** Local YYYY-MM-DD key (never toISOString — UTC drift). */
export function localDateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export interface CyclePosition {
  week: number; // 1–13 (13 = review week)
  cycle: Cycle;
  isDeload: boolean;
}

/** Which cycle week is `now` in? Null between cycles (holidays). */
export function cycleWeek(now: Date = new Date()): CyclePosition | null {
  const key = localDateKey(now);
  for (const cycle of CYCLES) {
    const start = parseKey(cycle.start);
    const day = Math.floor((parseKey(key).getTime() - start.getTime()) / 86_400_000);
    if (day >= 0 && day < 91) {
      return { week: Math.floor(day / 7) + 1, cycle, isDeload: DELOAD_WEEKS.has(Math.floor(day / 7) + 1) };
    }
  }
  return null;
}

/** True when today falls on a deload week (3/6/9/12 of any cycle). */
export function isDeloadWeek(now: Date = new Date()): boolean {
  const pos = cycleWeek(now);
  return pos?.isDeload ?? false;
}

/**
 * Deload suggestion for one exercise, from the weights you lifted last time.
 * Rounded DOWN to the nearest 2.5 kg — err light on a deload.
 * Null when there's no previous weight to scale.
 */
export function deloadWeightFor(previousMaxWeight: number): number | null {
  if (!Number.isFinite(previousMaxWeight) || previousMaxWeight <= 0) return null;
  return Math.max(2.5, Math.floor((previousMaxWeight * DELOAD_FACTOR) / 2.5) * 2.5);
}

/** One-line deload notice for the workout header. Null on build weeks. */
export function deloadNotice(now: Date = new Date()): string | null {
  const pos = cycleWeek(now);
  if (!pos?.isDeload) return null;
  return `Deload week (week ${pos.week}) — suggest ~${Math.round(DELOAD_FACTOR * 100)}% of last time`;
}
