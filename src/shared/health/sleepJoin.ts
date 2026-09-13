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
