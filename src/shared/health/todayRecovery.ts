import { type RecoveryRecommendation } from '@/shared/health/insights';
import { computeDailyLoads, computeAcwrSeries, selectLoadMetric, dailyLoadValue, type SessionLoadInput, type AcwrPoint } from './trainingLoad';
import { computeRecoverySeries, type DailyReading } from './recoveryBaseline';

export type { RecoveryRecommendation } from '@/shared/health/insights';

/**
 * Shared "today" recovery verdict used by the Home chip AND Analytics overview,
 * so both pages can never disagree. Built from the same EWMA ACWR + recovery
 * z-score services that TrainingLoadOverlay charts.
 *
 * Inputs (all date-keyed, ascending not required):
 *  - sessions: workout session loads (volume + optional sRPE + duration)
 *  - rhr:      resting heart rate readings
 *  - readiness: readiness scores
 *  - today:    local YYYY-MM-DD key
 */
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

  // ── Verdict: fuse ACWR flag + recovery z + readiness (same thresholds the
  //    overlay banner uses: ACWR 1.3 caution / 1.5 risk, z −1.0) ──
  if (latestAcwr == null) {
    if (readinessToday != null && readinessToday < 45) {
      return { level: 'recover', reason: 'Readiness is low — prioritise rest today.' };
    }
    return null; // insufficient history: chip hides itself
  }

  const highLoad = latestAcwr > 1.5;
  const cautionLoad = latestAcwr > 1.3;
  const suppressed = latestRecovery != null && latestRecovery <= -1.0;
  const readinessLow = readinessToday != null && readinessToday < 45;
  const readinessMid = readinessToday != null && readinessToday >= 45 && readinessToday < 60;

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
