// Training-phase calendar (12 Week Year cycles) + phase-aware set defaults.
//
// The 12 Week Year plan (~/12-week-year-2026-27.md) runs 3 cycles per school
// year; weeks 3/6/9/12 of each cycle are deloads (~65–70% of working weights).
// This mirrors the deload calendar Hermes uses for the daily briefing
// (analysis/daily_briefing.py CYCLE_STARTS/DELOAD_WEEKS) so the app and the
// agent can never disagree about what week it is. Pure TS — unit-tested.
//
// Seasonal plan override (v3.16): when a gym_plan covers today, deload config
// resolves from the PLAN (pause-aware, user cadence + factor) instead of the
// hardcoded CYCLES. The plan is loaded ONCE into a module cache; the exported
// sync helpers (`isDeloadWeek`/`deloadNotice`/`cycleWeek`) keep their
// signatures and read the cache, falling back to CYCLES until loaded / when no
// plan covers today. Async consumers await `resolvedDeloadConfig()` directly.

import {
  deloadWeekNumbers,
  planWeek,
  dateKey,
  type PlanConfig,
  type PauseSpan,
} from '@/shared/utils/planCalendar';
import { getActivePlan, getPausesForPlan, planConfigOf, pauseSpansOf } from '@/shared/db/app_db';
import type { Plan } from '@/shared/db/app_db';

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

// ── Plan override resolution ─────────────────────────────────────────────────

/** undefined = not loaded yet, null = checked, no plan covers today. */
let cachedPlan: Plan | null | undefined = undefined;
let cachedPauses: PauseSpan[] = [];

export interface ResolvedDeloadConfig {
  isDeload: boolean;
  deloadWeeks: Set<number>;
  factor: number;
  /** Pause-adjusted plan week covering `now`, or null without a plan. */
  weekOfPlan: number | null;
  label: string;
}

/**
 * Resolve today's deload config: the active plan when one covers `now`,
 * otherwise EXACTLY the legacy CYCLES behavior. Async — await this in prefill
 * paths; sync consumers keep using isDeloadWeek()/deloadNotice() which read
 * the cache (CYCLES fallback until `initResolvedPlan()` runs).
 */
export async function resolvedDeloadConfig(now: Date = new Date()): Promise<ResolvedDeloadConfig> {
  if (cachedPlan === undefined) {
    cachedPlan = await getActivePlan(now);
    cachedPauses = cachedPlan ? pauseSpansOf(await getPausesForPlan(cachedPlan.id)) : [];
  }

  if (cachedPlan) {
    const cfg: PlanConfig = planConfigOf(cachedPlan);
    const week = planWeek(cfg, cachedPauses, now);
    const weeks = deloadWeekNumbers(cfg);
    const openPause = cachedPauses.find((p) => p.endDate === null && dateKey(now) > p.startDate);
    const isDeload = week !== null && weeks.has(week);
    return {
      isDeload,
      deloadWeeks: weeks,
      factor: cachedPlan.deload_factor,
      weekOfPlan: week,
      label: openPause
        ? `Plan paused · ${openPause.startDate}`
        : `Plan · ${cachedPlan.name}`,
    };
  }

  // Legacy fallback — the hardcoded school-year cycles.
  const pos = cycleWeek(now);
  return {
    isDeload: pos?.isDeload ?? false,
    deloadWeeks: new Set(DELOAD_WEEKS),
    factor: DELOAD_FACTOR,
    weekOfPlan: null,
    label: pos?.cycle.label ?? '',
  };
}

/** Load the active plan once at app start; call after any plan/pause write. */
export async function initResolvedPlan(now: Date = new Date()): Promise<void> {
  cachedPlan = await getActivePlan(now);
  cachedPauses = cachedPlan ? pauseSpansOf(await getPausesForPlan(cachedPlan.id)) : [];
}

/** Force a re-resolve after a plan create/edit/pause/resume. */
export function invalidatePlanCache(): void {
  cachedPlan = undefined;
  cachedPauses = [];
}

/** True when today falls on a deload week (plan-aware, CYCLES fallback). */
export function isDeloadWeek(now: Date = new Date()): boolean {
  if (cachedPlan) {
    const cfg = planConfigOf(cachedPlan);
    const week = planWeek(cfg, cachedPauses, now);
    return week !== null && deloadWeekNumbers(cfg).has(week);
  }
  const pos = cycleWeek(now);
  return pos?.isDeload ?? false;
}

/** Scale `previousMaxWeight` by `factor`, rounded DOWN to 2.5 kg — err light. */
function scaleDeload(previousMaxWeight: number, factor: number): number | null {
  if (!Number.isFinite(previousMaxWeight) || previousMaxWeight <= 0) return null;
  return Math.max(2.5, Math.floor((previousMaxWeight * factor) / 2.5) * 2.5);
}

/**
 * Deload suggestion for one exercise, from the weights you lifted last time.
 * Legacy export — always uses DELOAD_FACTOR (CYCLES band). Plan-aware callers
 * use `deloadWeightForConfig`. Null when there's no previous weight.
 */
export function deloadWeightFor(previousMaxWeight: number): number | null {
  return scaleDeload(previousMaxWeight, DELOAD_FACTOR);
}

/** Deload suggestion at the RESOLVED plan factor (falls back to DELOAD_FACTOR). */
export async function deloadWeightForConfig(previousMaxWeight: number, now: Date = new Date()): Promise<number | null> {
  const cfg = await resolvedDeloadConfig(now);
  return scaleDeload(previousMaxWeight, cfg.factor);
}

/** One-line deload notice for the workout header. Null on build weeks. */
export function deloadNotice(now: Date = new Date()): string | null {
  if (cachedPlan) {
    const cfg = planConfigOf(cachedPlan);
    const week = planWeek(cfg, cachedPauses, now);
    if (week === null) return null;
    const isDeload = deloadWeekNumbers(cfg).has(week);
    if (!isDeload) return null;
    return `Deload week (plan week ${week}) — suggest ~${Math.round(cachedPlan.deload_factor * 100)}% of last time`;
  }
  const pos = cycleWeek(now);
  if (!pos?.isDeload) return null;
  return `Deload week (week ${pos.week}) — suggest ~${Math.round(DELOAD_FACTOR * 100)}% of last time`;
}
