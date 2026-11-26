import { computeDailyLoads, computeAcwrSeries, selectLoadMetric, dailyLoadValue, type SessionLoadInput, type AcwrPoint } from './trainingLoad';
import { computeRecoverySeries, type DailyReading } from './recoveryBaseline';

export type RecoveryLevel = 'train' | 'maintain' | 'recover';

export interface RecoveryRecommendation {
  level: RecoveryLevel;
  reason: string;
}

/**
 * Shared "today" recovery verdict used by the Home chip AND the briefing
 * card, so both surfaces can never disagree. Built from the EWMA ACWR +
 * recovery z-score services.
 *
 * Threshold constants are exported — any surface that re-derives a verdict
 * from ACWR/recovery-z must import these, not restate the numbers.
 *
 * Inputs (all date-keyed, ascending not required):
 *  - sessions: workout session loads (volume + optional sRPE + duration)
 *  - rhr:      resting heart rate readings
 *  - readiness: readiness scores
 *  - today:    local YYYY-MM-DD key
 */
export const ACWR_CAUTION = 1.3;
export const ACWR_RISK = 1.5;
export const RECOVERY_Z_SUPPRESS = -1.0;
export const READINESS_LOW = 45;
export const READINESS_HIGH = 60;
export function computeTodayRecovery(input: {
  sessions: SessionLoadInput[];
  rhr: DailyReading[];
  readiness: { date: string; value: number }[];
  today: string;
}): RecoveryRecommendation | null {
  const { sessions, rhr, readiness, today } = input;

  // ── Load: EWMA ACWR series, extended to today so rest days decay it ──
  const dailyLoads = computeDailyLoads(sessions);
  const acwrSeries = computeAcwrSeries(dailyLoads, { endDate: today });
  const latestAcwr = lastDefined(acwrSeries.map((p) => p.acwr));

  // ── Recovery signal: RHR z (HRV-ready if enough readings arrive via rhr slot) ──
  const recoverySeries = computeRecoverySeries(rhr, 'rhr');
  const latestRecovery = lastDefined(recoverySeries.map((p) => p.recoveryZ));

  const readinessToday = lastByDate(readiness, today);

  // ── Verdict: fuse ACWR flag + recovery z + readiness (see the exported
  //    threshold constants above — the single source of truth) ──
  if (latestAcwr == null) {
    if (readinessToday != null && readinessToday < READINESS_LOW) {
      return { level: 'recover', reason: 'Readiness is low — prioritise rest today.' };
    }
    return null; // insufficient history: chip hides itself
  }

  const highLoad = latestAcwr > ACWR_RISK;
  const cautionLoad = latestAcwr > ACWR_CAUTION;
  const suppressed = latestRecovery != null && latestRecovery <= RECOVERY_Z_SUPPRESS;
  const readinessLow = readinessToday != null && readinessToday < READINESS_LOW;
  const readinessMid = readinessToday != null && readinessToday >= READINESS_LOW && readinessToday < READINESS_HIGH;

  if (highLoad && suppressed) {
    return { level: 'recover', reason: 'Load is spiking while recovery is suppressed — take a rest day.' };
  }
  if (readinessLow) {
    return { level: 'recover', reason: 'Readiness is low — prioritise rest today.' };
  }
  if (highLoad || cautionLoad || suppressed || readinessMid) {
    if (highLoad) return { level: 'maintain', reason: 'Acute load is very high — hold volume today.' };
    if (cautionLoad) return { level: 'maintain', reason: 'Load is climbing fast — hold volume rather than adding.' };
    if (suppressed) return { level: 'maintain', reason: 'Recovery markers are below baseline — keep it moderate.' };
    return { level: 'maintain', reason: 'Readiness is moderate — keep volume steady today.' };
  }
  return { level: 'train', reason: 'Recovery markers look good — green light to push.' };
}

function lastDefined<T>(values: (T | null)[]): T | null {
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i];
    if (v != null) return v;
  }
  return null;
}

function lastByDate(rows: { date: string; value: number }[], today: string): number | null {
  let latest: { date: string; value: number } | null = null;
  for (const r of rows) {
    if (Number.isFinite(r.value) && (!latest || (r.date <= today && r.date > latest.date))) {
      latest = r;
    }
  }
  return latest ? latest.value : null;
}

// Re-exports so consumers of the legacy API keep one import site.
export { selectLoadMetric, dailyLoadValue, type AcwrPoint };
