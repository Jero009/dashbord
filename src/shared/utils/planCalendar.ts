// Pause-aware seasonal plan calendar — pure TS, unit-tested.
//
// Everything derives from `planDayIndex`: the wall-clock day offset since the
// plan start, minus the days spent paused. Pausing FREEZES the clock (an open
// pause holds the week number at its start); resuming shifts every future date
// by the total paused days — the plan end slides, deloads slide, nothing extra
// is stored. All date keys are local YYYY-MM-DD strings (never UTC slices).
// Zero dependencies on the DB layer so tests stay pure.

export interface PlanConfig {
  startDate: string; // local YYYY-MM-DD
  endDate: string;   // local YYYY-MM-DD (inclusive)
  deloadEveryWeeks: number; // 0 = deloads off
}

export interface PauseSpan {
  startDate: string;          // local YYYY-MM-DD
  endDate: string | null;     // null = still paused
}

/** Local YYYY-MM-DD → local-midnight Date (whole-day arithmetic only). */
function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Local date → YYYY-MM-DD key (never toISOString — UTC drift). */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Local-safe day addition on YYYY-MM-DD keys. */
export function addDays(key: string, days: number): string {
  const d = parseKey(key);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

/** Whole days from `a` to `b` (b − a), both local keys. */
function diffDays(a: string, b: string): number {
  return Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / 86_400_000);
}

/** Total plan weeks (start..end inclusive ÷ 7). Expiry slides, the total doesn't. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function planWeeksTotal(cfg: PlanConfig, _pauses: PauseSpan[]): number {
  const days = diffDays(cfg.startDate, cfg.endDate) + 1;
  return Math.max(0, Math.round(days / 7));
}

/** Paused days strictly before `key` for one span. Open pauses count up to yesterday. */
function pausedDaysBefore(pause: PauseSpan, key: string): number {
  if (key <= pause.startDate) return 0;
  const last = addDays(key, -1);
  const end = pause.endDate !== null && pause.endDate < last ? pause.endDate : last;
  if (end < pause.startDate) return 0;
  return diffDays(pause.startDate, end) + 1;
}

/**
 * THE primitive: pause-adjusted plan day index (0-based from the plan start).
 * Null outside the plan window — the end slides forward by paused days. An
 * open pause freezes the index at the pause start (the clock stops).
 */
export function planDayIndex(cfg: PlanConfig, pauses: PauseSpan[], key: string): number | null {
  const wall = diffDays(cfg.startDate, key);
  if (wall < 0) return null;

  // Open pause: the clock is frozen at the pause start (week number holds).
  for (const p of pauses) {
    if (p.endDate === null && key > p.startDate) {
      const frozen = diffDays(cfg.startDate, p.startDate);
      return frozen >= 0 ? frozen : null;
    }
  }

  const idx = wall - pauses.reduce((sum, p) => sum + pausedDaysBefore(p, key), 0);
  if (idx >= planWeeksTotal(cfg, pauses) * 7) return null;
  return idx;
}

/** 1-based plan week on the PAUSE-AWARE clock. Open pause = frozen. Null outside. */
export function planWeek(cfg: PlanConfig, pauses: PauseSpan[], now: Date): number | null {
  const idx = planDayIndex(cfg, pauses, dateKey(now));
  if (idx === null) return null;
  return Math.floor(idx / 7) + 1;
}

/** Deload week numbers: every Nth of the pause-adjusted sequence. N=0 → none. */
export function deloadWeekNumbers(cfg: PlanConfig): Set<number> {
  const out = new Set<number>();
  const n = cfg.deloadEveryWeeks;
  if (!Number.isFinite(n) || n <= 0) return out;
  const total = planWeeksTotal(cfg, []);
  for (let w = n; w <= total; w += n) out.add(w);
  return out;
}

/**
 * Pause-adjusted start dates (YYYY-MM-DD) of each deload week, ascending.
 * Deload weeks whose original start is still in the future slide by the total
 * paused days after their position; ones already under way (or past) keep
 * their wall date — you can't move a week that already started.
 */
export function deloadDates(cfg: PlanConfig, pauses: PauseSpan[]): string[] {
  // Shift applied to a deload week = the paused days contained in
  // [pauseStart, base) — i.e. only pauses that started before the deload week
  // push it back; the plan end sliding means every future week moves by the
  // full paused span, past weeks keep their wall date.
  const shiftFor = (base: string): number => {
    let shift = 0;
    for (const p of pauses) {
      const end = p.endDate ?? addDays(cfg.endDate, 0); // open pause: through the plan's wall end
      if (base > p.startDate) shift += diffDays(p.startDate, end) + 1;
    }
    return shift;
  };

  const out: string[] = [];
  for (const w of [...deloadWeekNumbers(cfg)].sort((a, b) => a - b)) {
    const base = addDays(cfg.startDate, (w - 1) * 7);
    out.push(addDays(base, shiftFor(base)));
  }
  return out;
}

/** True when `now` falls on a deload week of the pause-adjusted plan. */
export function isPlanDeloadWeek(cfg: PlanConfig, pauses: PauseSpan[], now: Date): boolean {
  const week = planWeek(cfg, pauses, now);
  if (week === null) return false;
  return deloadWeekNumbers(cfg).has(week);
}

/** Next deload-week start strictly after `now`, or null. */
export function nextDeloadDate(cfg: PlanConfig, pauses: PauseSpan[], now: Date): string | null {
  const nowKey = dateKey(now);
  for (const d of deloadDates(cfg, pauses)) {
    if (d > nowKey) return d;
  }
  return null;
}

/**
 * expectedByNow = whole pause-adjusted elapsed weeks × expectedPerWeek;
 * completion = done / expectedByNow, capped at 1. Zero expected before the
 * plan starts or while nothing has elapsed yet.
 */
export function adherenceFor(
  done: number,
  expectedPerWeek: number,
  cfg: PlanConfig,
  pauses: PauseSpan[],
  now: Date
): { expectedByNow: number; completion: number } {
  const idx = planDayIndex(cfg, pauses, dateKey(now));
  if (idx === null || idx < 0) return { expectedByNow: 0, completion: 0 };
  const elapsedWeeks = Math.floor((idx + 1) / 7);
  const expectedByNow = Math.max(0, Math.round(elapsedWeeks * (expectedPerWeek || 0)));
  const completion = expectedByNow > 0 ? Math.min(1, done / expectedByNow) : 0;
  return { expectedByNow, completion };
}
