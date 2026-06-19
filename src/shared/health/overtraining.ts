/**
 * Overtraining Flag service — pure TS, no DB or Vue deps.
 *
 * Combines training load (ACWR) with recovery deviation (direction-normalised
 * recovery z-score, where negative = worse recovery) into a single status.
 *
 * Core rule (per spec): flag "potential overreaching" when
 *   ACWR > 1.5  AND  recovery z-score stays below −1.0 for 2+ consecutive days.
 *
 * Status:
 *   red    — potential overreaching (both conditions met).
 *   yellow — a single warning present (high/caution ACWR, or a sustained
 *            low-recovery streak), but not both.
 *   green  — nothing notable.
 */

import { acwrFlag } from './trainingLoad';

export type OvertrainingStatus = 'green' | 'yellow' | 'red';

/** One aligned day of the two signals. `recoveryZ`: negative = worse recovery. */
export interface OvertrainingInput {
  date: string;
  acwr: number | null;
  recoveryZ: number | null;
}

export interface OvertrainingResult {
  status: OvertrainingStatus;
  /** True only when the full "potential overreaching" rule is met. */
  overreaching: boolean;
  /** Latest available ACWR (may be null when history is thin). */
  acwr: number | null;
  /** Trailing count of consecutive days with recoveryZ below the threshold. */
  consecutiveLowRecovery: number;
  /** Human-readable reasons backing the status. */
  reasons: string[];
}

export interface OvertrainingOptions {
  /** ACWR above this = high risk. Default 1.5. */
  acwrHighRisk?: number;
  /** ACWR above this (but ≤ high risk) = caution. Default 1.3. */
  acwrCaution?: number;
  /** Recovery z at/below this counts as a low-recovery day. Default −1.0. */
  recoveryZThreshold?: number;
  /** Consecutive low-recovery days required for the overreaching rule. Default 2. */
  lowRecoveryDays?: number;
}

/**
 * Evaluate the latest overtraining status from a date-ascending series of
 * aligned points. The "trailing" counts are anchored at the most recent point.
 */
export function evaluateOvertraining(
  points: OvertrainingInput[],
  options: OvertrainingOptions = {}
): OvertrainingResult {
  const acwrHighRisk = options.acwrHighRisk ?? 1.5;
  const acwrCaution = options.acwrCaution ?? 1.3;
  const zThreshold = options.recoveryZThreshold ?? -1.0;
  const lowRecoveryDays = options.lowRecoveryDays ?? 2;

  if (points.length === 0) {
    return {
      status: 'green',
      overreaching: false,
      acwr: null,
      consecutiveLowRecovery: 0,
      reasons: ['No data yet.'],
    };
  }

  // Latest ACWR (walk back to the most recent non-null reading).
  let latestAcwr: number | null = null;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].acwr != null) {
      latestAcwr = points[i].acwr;
      break;
    }
  }

  // Trailing streak of low-recovery days, anchored at the most recent point.
  let consecutiveLowRecovery = 0;
  for (let i = points.length - 1; i >= 0; i--) {
    const z = points[i].recoveryZ;
    if (z != null && z <= zThreshold) consecutiveLowRecovery++;
    else break;
  }

  const reasons: string[] = [];
  const highAcwr = latestAcwr != null && latestAcwr > acwrHighRisk;
  const cautionAcwr =
    latestAcwr != null && latestAcwr > acwrCaution && latestAcwr <= acwrHighRisk;
  const sustainedLowRecovery = consecutiveLowRecovery >= lowRecoveryDays;

  const overreaching = highAcwr && sustainedLowRecovery;

  let status: OvertrainingStatus = 'green';
  if (overreaching) {
    status = 'red';
    reasons.push(
      `ACWR ${latestAcwr?.toFixed(2)} (>${acwrHighRisk}) with recovery suppressed ` +
        `${consecutiveLowRecovery} days running — potential overreaching.`
    );
  } else if (highAcwr || cautionAcwr || sustainedLowRecovery) {
    status = 'yellow';
    if (highAcwr) reasons.push(`Acute load spike (ACWR ${latestAcwr?.toFixed(2)}).`);
    else if (cautionAcwr) reasons.push(`Load climbing (ACWR ${latestAcwr?.toFixed(2)}).`);
    if (sustainedLowRecovery)
      reasons.push(`Recovery below baseline ${consecutiveLowRecovery} days running.`);
  } else {
    if (latestAcwr != null) reasons.push(`Load balanced (ACWR ${latestAcwr.toFixed(2)}).`);
    else reasons.push('Building baseline.');
  }

  return {
    status,
    overreaching,
    acwr: latestAcwr,
    consecutiveLowRecovery,
    reasons,
  };
}

/** Convenience: zone label for an ACWR value (re-exports trainingLoad mapping). */
export function acwrZoneLabel(acwr: number | null): string {
  if (acwr == null) return '—';
  const flag = acwrFlag(acwr);
  return {
    detraining: 'Detraining',
    optimal: 'Optimal',
    caution: 'Caution',
    high_risk: 'High risk',
  }[flag];
}
