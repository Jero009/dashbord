import type { HealthSample } from '@capgo/capacitor-health';

/**
 * Pure sleep-session window-joining logic, extracted from healthConnect.ts so
 * the sync bugs it feeds (HR/RR per-night averages, primary-sample pick) are
 * unit-testable without the Health Connect bridge.
 */

/** Average of finite values; null when empty (matches healthConnect's `average`). */
export function averageOf(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** A time-ordered HR sample point used for sleep-window joins. */
export interface SleepHrPoint {
  time: number;
  value: number;
  startDate: string;
}

/** Chronologically sorted HR samples with finite timestamps/values. */
export function toChronologicalHrSamples(samples: HealthSample[]): SleepHrPoint[] {
  return samples
    .filter((sample) => Number.isFinite(sample.value))
    .map((sample) => ({ time: new Date(sample.startDate).getTime(), value: sample.value, startDate: sample.startDate }))
    .filter((sample) => Number.isFinite(sample.time))
    .sort((a, b) => a.time - b.time);
}

/**
 * HR samples falling WITHIN the sleep window (bedtime→waketime, boundaries
 * included). Overnight sessions straddle midnight, so date-bucketing splits
 * the night's HR across two days — window matching is the fix.
 */
export function sleepWindowHeartRate(sample: HealthSample, hrSamples: SleepHrPoint[]): SleepHrPoint[] {
  const startMs = new Date(sample.startDate).getTime();
  const endMs = new Date(sample.endDate).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return [];
  return hrSamples.filter((s) => s.time >= startMs && s.time <= endMs);
}

/** Mean HR across the sleep window; null when the window holds no samples. */
export function sleepWindowHeartRateAverage(sample: HealthSample, hrSamples: SleepHrPoint[]): number | null {
  return averageOf(sleepWindowHeartRate(sample, hrSamples).map((s) => s.value));
}

/**
 * RR samples falling within the sleep window, joined exactly like HR.
 * Respiratory-rate samples are sparse (one per reading), so we filter the
 * chronologically-sorted list by timestamp instead of by calendar day: a
 * 23:50–07:00 night keeps its pre-midnight readings instead of donating them
 * to the previous day's bucket.
 */
export function rrWithinWindow(sample: HealthSample, rrSamples: SleepHrPoint[]): SleepHrPoint[] {
  return sleepWindowHeartRate(sample, rrSamples);
}

/** Mean RR across the sleep window; null when the window holds no samples. */
export function rrWithinWindowAverage(sample: HealthSample, rrSamples: SleepHrPoint[]): number | null {
  return averageOf(rrWithinWindow(sample, rrSamples).map((s) => s.value));
}

/**
 * HRV samples falling within the sleep window, joined exactly like HR/RR.
 * Overnight sessions straddle midnight, so date-bucketing would split the
 * night's HRV across two days — window matching keeps the full night.
 */
export function hrvWithinWindow(sample: HealthSample, hrvSamples: SleepHrPoint[]): SleepHrPoint[] {
  return sleepWindowHeartRate(sample, hrvSamples);
}

/** Mean HRV (rmssd ms) across the sleep window; null when the window holds no samples. */
export function hrvWithinWindowAverage(sample: HealthSample, hrvSamples: SleepHrPoint[]): number | null {
  return averageOf(hrvWithinWindow(sample, hrvSamples).map((s) => s.value));
}

/**
 * When a day bucket holds multiple sleep samples (naps / split sessions), the
 * main overnight sleep is the one with the most time asleep — not necessarily
 * the last-recorded one. Picking by duration avoids a short nap overriding it.
 */
export function pickPrimarySleepSample(
  samples: HealthSample[],
  getSleepHours: (sample: HealthSample) => number | null
): HealthSample | null {
  if (!samples.length) return null;
  return samples.reduce((best, s) =>
    (getSleepHours(s) ?? 0) > (getSleepHours(best) ?? 0) ? s : best
  );
}

/**
 * Time actually asleep in hours. Excludes awake/inBed stages so this matches
 * sumStageMinutes (which feeds timeAsleepHours); falls back to the full
 * bed→wake span when the device gives no stages; null on unparseable dates.
 */
export function getSleepHours(sample: HealthSample): number | null {
  if (sample.stages?.length) {
    return sample.stages
      .filter((stage) => stage.stage !== 'awake' && stage.stage !== 'inBed')
      .reduce((sum, stage) => sum + stage.durationMinutes, 0) / 60;
  }

  const start = new Date(sample.startDate).getTime();
  const end = new Date(sample.endDate).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null;
  }

  return (end - start) / (1000 * 60 * 60);
}
import { standardDeviation } from '@/shared/utils/math';

/**
 * Determines if the SpO₂ gate is active based on data density and stability.
 * Gate rules:
 * 1. Requires ≥14 days of SpO₂ readings
 * 2. Requires stable variance (SD ≤ 2.5%)
 *
 * @param spo2Readings - Array of SpO₂ readings (percent)
 * @returns boolean - True if the gate is active, false otherwise
 */
export function isSpo2GateActive(spo2Readings: number[]): boolean {
  if (spo2Readings.length < 14) return false;
  const sd = standardDeviation(spo2Readings);
  return sd <= 2.5;
}

/**
 * Calculates the SpO₂ score for readiness calculation.
 * Score rules:
 * 1. 8 pts when at baseline
 * 2. 4 pts when 1.5% below baseline
 * 3. 0 pts when ≥3% below baseline
 * 4. 8 pts when 1.5% above baseline
 * 5. 0 pts when ≥3% above baseline
 *
 * @param spo2 - Current SpO₂ reading (percent)
 * @param baseline - Personal baseline (mean of prior 28 days)
 * @param spo2Readings - Array of SpO₂ readings (percent) for gate check
 * @returns number | null - Score (0-8) or null if gate is inactive
 */
export function calculateSpo2Score(spo2: number | null, baseline: number | null, spo2Readings: number[]): number | null {
  if (!isSpo2GateActive(spo2Readings)) return null;
  if (spo2 === null || baseline === null) return 0;

  const deviation = spo2 - baseline;
  const absDeviation = Math.abs(deviation);

  if (absDeviation >= 3) return 0;
  if (absDeviation >= 1.5) return 4;
  return 8;
}