// Briefing verdict resolution — pure, testable.
//
// LOCAL-FIRST: the daily training verdict is computed in-app from the phone's
// own SQLite — no Hermes-pushed level is consumed anywhere. Ladder (first
// match wins, mirrors the old daily_briefing.py order):
//   1. SICK    — an open sick life_event covering today (all-red VU bar).
//   2. DELOAD  — the active plan (or CYCLES fallback) is in a deload week
//                (all-yellow VU bar). Overrides everything below.
//   3. RECOVER — the shared recovery engine says rest: ACWR > 1.5 with
//                recovery z ≤ −1.0, or readiness < 45.
//   4. NORMAL  — caution band (ACWR > 1.3, z ≤ −1.0, readiness 45–59) or no
//                recovery signal at all — 2 lit segments.
//   5. PUSH    — recovery engine green-lights training — 3 lit segments.
//
// The recovery verdict comes from computeTodayRecovery() (EWMA ACWR + RHR
// recovery z + readiness) — the SAME call that drives the Home recovery chip
// and Analytics overview, so the three surfaces can never disagree.
//
// The result feeds the Home briefing card AND the briefing-widget push.
import type { BriefingLevel } from '@/shared/sync/briefingStore'

/** Open sick spell: a sick life_event whose span covers `todayKey`. */
export function isSickToday(
  events: { type: string; start_date: string; end_date?: string | null }[],
  todayKey: string,
): boolean {
  return events.some(
    (e) =>
      e.type === 'sick' &&
      e.start_date <= todayKey &&
      (e.end_date == null || e.end_date >= todayKey),
  )
}

export interface VerdictInput {
  /** Resolved deload config for today (from resolvedDeloadConfig()). */
  plan: {
    /** True when an active plan covers today AND it's a deload week. */
    isDeload: boolean
    /** Pause-adjusted week number, null without a plan. */
    weekOfPlan: number | null
  }
  /** True when an open sick life_event covers today. */
  sick: boolean
  /**
   * Local recovery verdict from computeTodayRecovery() — 'train' |
   * 'maintain' | 'recover', or null when there is insufficient history
   * (fewer than ~2 weeks of load data). Null → NORMAL (no invention).
   */
  recovery: { level: 'train' | 'maintain' | 'recover'; reason: string } | null
}

export interface ResolvedVerdict {
  level: BriefingLevel
  /** Short verdict line for the card ('HOLD · deload week (week N)'). */
  verdict: string
  /** Cited-driver reason line ('Recovery markers below baseline — …'). */
  reason: string | null
  /** Which rung of the ladder decided. */
  source: 'sick' | 'deload' | 'recovery'
}

export function resolveBriefingVerdict(input: VerdictInput): ResolvedVerdict {
  // 1. Sick beats everything — training through an illness flag is wrong.
  if (input.sick) {
    return {
      level: 'sick',
      verdict: 'SICK',
      reason: 'Open sick entry — nothing hard until you log recovery.',
      source: 'sick',
    }
  }

  // 2. Deload week — the plan calendar is the source of truth for intensity.
  if (input.plan.isDeload && input.plan.weekOfPlan !== null) {
    return {
      level: 'deload',
      verdict: `HOLD · deload week (week ${input.plan.weekOfPlan})`,
      reason: `Planned deload — work around ${Math.round(67.5)}% of last time.`,
      source: 'deload',
    }
  }

  // 3–5. Local recovery engine. No signal → NORMAL (never invent a verdict
  // from nothing).
  const rec = input.recovery
  if (!rec) {
    return { level: 'normal', verdict: 'OK', reason: null, source: 'recovery' }
  }
  if (rec.level === 'recover') {
    return { level: 'recover', verdict: 'REST', reason: rec.reason, source: 'recovery' }
  }
  if (rec.level === 'maintain') {
    return { level: 'normal', verdict: 'OK', reason: rec.reason, source: 'recovery' }
  }
  return { level: 'push', verdict: 'GO', reason: rec.reason, source: 'recovery' }
}
