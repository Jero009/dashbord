/**
 * Daily vitals aggregation — pure functions, no DB/plugin deps (unit-tested).
 *
 * Health Connect delivers timestamped spot samples (HRV rmssd ms, SpO₂ %,
 * VO₂ max ml/kg/min). The app stores ONE averaged value per local calendar day
 * in health_metric, matching how restingHeartRate is stored.
 */

export interface VitalsSample {
  date: string; // local YYYY-MM-DD bucket key (produced by toDateKey)
  value: number;
}

export interface RawVitalsSample {
  startDate: string; // ISO timestamp
  value: number;
}

/**
 * One averaged value per day, ascending by date.
 * Skips non-finite values and produces no bucket for days with no valid samples.
 * toDateKey is injected (local-date bucketing) to keep this pure and testable.
 */
export function averageByDay(
  samples: RawVitalsSample[],
  toDateKey: (iso: string) => string
): VitalsSample[] {
  const buckets = new Map<string, { sum: number; n: number }>();
  for (const s of samples) {
    if (!Number.isFinite(s.value)) continue;
    const key = toDateKey(s.startDate);
    const b = buckets.get(key) ?? { sum: 0, n: 0 };
    b.sum += s.value;
    b.n += 1;
    buckets.set(key, b);
  }
  return [...buckets.entries()]
    .map(([date, { sum, n }]) => ({ date, value: sum / n }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
