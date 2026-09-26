// Briefing verdict resolution — pure, testable.
//
// Source-of-truth hierarchy for the daily training verdict:
//   1. ACTIVE PLAN (gym_plan): a deload week overrides everything — the
//      verdict is HOLD/deload regardless of what the Hermes briefing said.
//      A normal plan week defers to the Hermes level when present.
//   2. No plan → the Hermes-pushed briefing level as-is (legacy behavior).
//
// The result feeds the Home briefing card AND the briefing-widget push.
import type { BriefingLevel } from '@/shared/sync/briefingStore'

export interface VerdictInput {
  /** Resolved deload config for today (from resolvedDeloadConfig()). */
  plan: {
    /** True when an active plan covers today AND it's a deload week. */
    isDeload: boolean
    /** Pause-adjusted week number, null without a plan. */
    weekOfPlan: number | null
  }
  /** Hermes-pushed briefing level, null for legacy rows / no pull yet. */
  hermesLevel: BriefingLevel | null
}

export interface ResolvedVerdict {
  level: BriefingLevel | null
  /** Short verdict line for the card ('HOLD · deload week (week N)'). */
  verdict: string | null
  /** True when the plan overrode the Hermes value. */
  fromPlan: boolean
}

export function resolveBriefingVerdict(input: VerdictInput): ResolvedVerdict {
  if (input.plan.isDeload && input.plan.weekOfPlan !== null) {
    return {
      level: 'deload',
      verdict: `HOLD · deload week (week ${input.plan.weekOfPlan})`,
      fromPlan: true,
    }
  }
  // Normal plan week or no plan: Hermes level as-is, no verdict override.
  return { level: input.hermesLevel, verdict: null, fromPlan: false }
}
