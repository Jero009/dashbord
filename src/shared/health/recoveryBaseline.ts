/**
 * Recovery Baseline service — pure TS, no DB or Vue deps.
 *
 * Rolling 7-day and 28-day baselines for a recovery metric (HRV or RHR), and
 * each new daily reading expressed as a z-score deviation from the 28-day
 * baseline.
 *
 * HRV-ready by design: the maths is metric-agnostic. The only metric-specific
 * step is direction — for HRV a *higher* reading is better, for RHR a *higher*
 * reading is worse. `recoveryZ` normalises this so that, whatever the source,
 * **negative means worse recovery** (this is what the overtraining flag
 * consumes, e.g. "z below -1.0"). The raw, undirected z-score is preserved on
 * `z` for charting/inspection.
 *
 * Baselines use the trailing N *readings* (sorted by date), which is equivalent
 * to N calendar days when readings are daily and degrades gracefully across
 * gaps — matching how the sleep engine's respiratory/RHR baselines behave.
 */

/** 'hrv' → higher is better; 'rhr' → higher is worse. */
export type RecoveryMetric = 'hrv' | 'rhr';

export interface DailyReading {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface RecoveryPoint {
  date: string;
  value: number;
  /** Trailing 7-reading mean (inclusive); null until ≥1 reading. */
  mean7: number | null;
  /** Trailing 28-reading mean (inclusive). */
  mean28: number | null;
  /** Trailing 28-reading sample SD; null when <2 readings or no spread. */
  sd28: number | null;
  /** Undirected z = (value − mean28) / sd28. Null when sd28 is null. */
  z: number | null;
  /** Direction-normalised z (negative = worse recovery). */
  recoveryZ: number | null;
}

export interface RecoveryOptions {
  acuteWindow?: number;  // default 7
  baseWindow?: number;   // default 28
  /** Min trailing readings before a z-score is emitted (else null). */
  minReadings?: number;  // default 4
}

/**
 * Compute the recovery series for one metric. Input readings may be unsorted
 * and may contain duplicate dates (last value per date wins).
 */
export function computeRecoverySeries(
  readings: DailyReading[],
  metric: RecoveryMetric,
  options: RecoveryOptions = {}
): RecoveryPoint[] {
  const acuteWindow = options.acuteWindow ?? 7;
  const baseWindow = options.baseWindow ?? 28;
  const minReadings = options.minReadings ?? 4;

  // De-dupe per date (keep last), then sort ascending.
  const byDate = new Map<string, number>();
  for (const r of readings) {
    if (!r.date || !Number.isFinite(r.value)) continue;
    byDate.set(r.date, r.value);
  }
  const sorted = [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, value]) => ({ date, value }));

  const values = sorted.map((r) => r.value);

  return sorted.map((r, i) => {
    const mean7 = trailingMean(values, i, acuteWindow);
    const window = values.slice(Math.max(0, i - baseWindow + 1), i + 1);
    const mean28 = mean(window);
    const sd28 = window.length >= 2 ? sampleSd(window, mean28) : null;
    const hasEnough = i + 1 >= minReadings;

    let z: number | null = null;
    if (sd28 != null && sd28 > 0 && hasEnough) {
      z = round2((r.value - mean28) / sd28);
    }
    const recoveryZ = z == null ? null : metric === 'rhr' ? round2(-z) : z;

    return {
      date: r.date,
      value: r.value,
      mean7: round2(mean7),
      mean28: round2(mean28),
      sd28: sd28 == null ? null : round2(sd28),
      z,
      recoveryZ,
    } satisfies RecoveryPoint;
  });
}

// ── math helpers ─────────────────────────────────────────────────────────────

function trailingMean(values: number[], i: number, window: number): number {
  const from = Math.max(0, i - window + 1);
  return mean(values.slice(from, i + 1));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function sampleSd(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((s, v) => s + (v - avg) * (v - avg), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
