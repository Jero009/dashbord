/**
 * Training Load service — pure TS, no DB or Vue deps (mirrors circadian.ts /
 * the sleep score engine so it stays unit-testable independent of the UI).
 *
 * Computes, per workout session and per day:
 *  - volume load   = Σ(sets × reps × weight)
 *  - session RPE load = sessionRPE × durationMinutes (when RPE is recorded)
 *  - rolling 7-day acute load and 28-day chronic load (as average daily loads
 *    over the window, so the ratio sits near 1.0 in a steady state)
 *  - ACWR = acute / chronic, with risk flags.
 *
 * Loads are aggregated per local calendar day. Multiple sessions on the same
 * day are summed.
 */

export type AcwrFlag = 'detraining' | 'optimal' | 'caution' | 'high_risk';

/** One workout session's raw inputs. `date` is a local YYYY-MM-DD key. */
export interface SessionLoadInput {
  date: string;
  /** Σ(reps × weight) over completed sets. */
  volumeLoad: number;
  /** Session duration in minutes; null when start/end are unknown. */
  durationMinutes: number | null;
  /** Session RPE 1–10; null when not recorded. */
  sessionRpe: number | null;
}

/** Which unit the ACWR series is computed in. */
export type LoadMetric = 'rpe' | 'volume';

/** Per-day aggregated load, carrying both candidate metrics. */
export interface DailyLoad {
  date: string;
  /** Σ(reps × weight) over completed sets that day. */
  volumeLoad: number;
  /** Σ(rpe × duration) across the day's sessions; null when no session had RPE. */
  rpeLoad: number | null;
}

export interface AcwrPoint {
  date: string;
  load: number;
  /**
   * Acute load estimate at this day. With the default EWMA method this is the
   * exponentially weighted average (≈ last week, recency-weighted); with the
   * rolling method it is the simple mean over the acute window.
   */
  acute: number;
  /**
   * Chronic load estimate at this day — the EWMA (≈ last 4 weeks,
   * recency-weighted) or the rolling-window mean, per `method`.
   */
  chronic: number;
  /** acute / chronic; null until enough history exists or chronic is 0. */
  acwr: number | null;
  flag: AcwrFlag | null;
  /** The unit this whole series is computed in (same for every point). */
  metric: LoadMetric;
}

/**
 * Smoothing method for the acute/chronic loads.
 *  - 'ewma'    — exponentially weighted moving averages (default). Williams et al.
 *                (2017) showed EWMA is a *more sensitive* indicator of injury
 *                likelihood than rolling averages because it models the
 *                progressive decay of fitness/fatigue and weights recent days
 *                more heavily. Because acute and chronic are independently
 *                weighted exponential averages (not a window nested inside a
 *                larger window) it also sidesteps the worst of the
 *                rolling-average "mathematical coupling" that Lolli et al. and
 *                Impellizzeri et al. showed inflates spurious ACWR–injury
 *                correlations.
 *  - 'rolling' — classic simple moving averages (Gabbett). Retained for
 *                transparency/back-compat. `coupling` only affects this method.
 */
export type AcwrMethod = 'ewma' | 'rolling';

export interface AcwrOptions {
  acuteDays?: number;
  chronicDays?: number;
  /** Calendar days of history required before ACWR is emitted (else null). */
  minChronicDays?: number;
  /**
   * Force a load unit. Default 'auto' picks 'rpe' only when *every* training day
   * has an RPE load (so the series never mixes sRPE and volume units, which are
   * not comparable); otherwise 'volume'.
   */
  metric?: LoadMetric | 'auto';
  /**
   * Smoothing method. Default 'ewma' (Williams 2017 — more injury-sensitive and
   * less prone to mathematical-coupling artefacts than rolling averages).
   */
  method?: AcwrMethod;
  /**
   * Only used when method='rolling'. 'uncoupled' computes the chronic mean from
   * the window *before* the acute window (chronic and acute share no days),
   * which Lolli/Impellizzeri recommend to avoid the spurious correlation caused
   * by the acute window being nested inside the chronic one. Default 'uncoupled'.
   */
  coupling?: 'coupled' | 'uncoupled';
  /**
   * Extend the series (gap-filled with zero-load rest days) up to this date when
   * it is after the last workout. This lets the acute average decay during a
   * rest streak so detraining actually shows up — without it the ACWR would
   * freeze at the last training day.
   */
  endDate?: string;
}

/** sRPE load for a single session. Returns null when RPE or duration missing. */
export function sessionRpeLoad(
  rpe: number | null,
  durationMinutes: number | null
): number | null {
  if (rpe == null || durationMinutes == null) return null;
  if (!Number.isFinite(rpe) || !Number.isFinite(durationMinutes)) return null;
  if (rpe <= 0 || durationMinutes <= 0) return 0;
  return rpe * durationMinutes;
}

/** Aggregate raw sessions into one DailyLoad per calendar day (ascending). */
export function computeDailyLoads(sessions: SessionLoadInput[]): DailyLoad[] {
  const byDate = new Map<string, { volume: number; rpe: number; hasRpe: boolean }>();

  for (const s of sessions) {
    if (!s.date) continue;
    const bucket = byDate.get(s.date) ?? { volume: 0, rpe: 0, hasRpe: false };
    bucket.volume += Math.max(0, Number(s.volumeLoad) || 0);
    const sr = sessionRpeLoad(s.sessionRpe, s.durationMinutes);
    if (sr != null) {
      bucket.rpe += sr;
      bucket.hasRpe = true;
    }
    byDate.set(s.date, bucket);
  }

  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, b]) => ({
      date,
      volumeLoad: b.volume,
      rpeLoad: b.hasRpe ? b.rpe : null,
    } satisfies DailyLoad));
}

/**
 * Pick a single, consistent load unit for the whole series. Returns 'rpe' only
 * when every day that has any load also has an RPE load — otherwise 'volume',
 * which is always available. This guards against mixing incomparable units in
 * the ACWR ratio (e.g. when RPE was only recently adopted).
 */
export function selectLoadMetric(dailyLoads: DailyLoad[]): LoadMetric {
  const active = dailyLoads.filter((d) => d.volumeLoad > 0 || (d.rpeLoad ?? 0) > 0);
  if (active.length === 0) return 'volume';
  return active.every((d) => d.rpeLoad != null && d.rpeLoad > 0) ? 'rpe' : 'volume';
}

/** The load value for a day under a chosen metric. */
export function dailyLoadValue(d: DailyLoad, metric: LoadMetric): number {
  return metric === 'rpe' ? d.rpeLoad ?? 0 : d.volumeLoad;
}

/** <0.8 detraining · 0.8–1.3 optimal · 1.3–1.5 caution · >1.5 high risk. */
export function acwrFlag(acwr: number): AcwrFlag {
  if (acwr < 0.8) return 'detraining';
  if (acwr <= 1.3) return 'optimal';
  if (acwr <= 1.5) return 'caution';
  return 'high_risk';
}

/**
 * Build the ACWR series. Daily loads are gap-filled with 0 across the calendar
 * range so rest days correctly decay the acute load. By default the acute and
 * chronic loads are exponentially weighted moving averages (Williams 2017); set
 * `method: 'rolling'` for the classic simple moving averages.
 */
export function computeAcwrSeries(
  dailyLoads: DailyLoad[],
  options: AcwrOptions = {}
): AcwrPoint[] {
  const acuteDays = options.acuteDays ?? 7;
  const chronicDays = options.chronicDays ?? 28;
  const minChronicDays = options.minChronicDays ?? 14;
  const method = options.method ?? 'ewma';
  const coupling = options.coupling ?? 'uncoupled';

  if (dailyLoads.length === 0) return [];

  const metric: LoadMetric =
    !options.metric || options.metric === 'auto'
      ? selectLoadMetric(dailyLoads)
      : options.metric;

  const loadByDate = new Map<string, number>();
  for (const d of dailyLoads) loadByDate.set(d.date, dailyLoadValue(d, metric));

  const start = dailyLoads[0].date;
  const lastLoad = dailyLoads[dailyLoads.length - 1].date;
  const end = options.endDate && options.endDate > lastLoad ? options.endDate : lastLoad;
  const dates = enumerateDates(start, end);
  const loads = dates.map((d) => loadByDate.get(d) ?? 0);

  // EWMA decay constants: λ = 2/(N+1) (Williams et al. 2017). A larger N (chronic)
  // decays more slowly, so chronic load lags acute load — exactly the
  // fitness-vs-fatigue separation the ratio is meant to capture.
  const acuteLambda = 2 / (acuteDays + 1);
  const chronicLambda = 2 / (chronicDays + 1);

  // Seed both EWMAs with the first day's load so a steady load yields ACWR ≈ 1.0
  // immediately rather than ramping up from zero.
  let acuteEwma = loads[0];
  let chronicEwma = loads[0];

  return dates.map((date, i) => {
    const historyDays = i + 1;

    let acute: number;
    let chronic: number;
    if (method === 'ewma') {
      if (i > 0) {
        acuteEwma = loads[i] * acuteLambda + acuteEwma * (1 - acuteLambda);
        chronicEwma = loads[i] * chronicLambda + chronicEwma * (1 - chronicLambda);
      }
      acute = acuteEwma;
      chronic = chronicEwma;
    } else {
      acute = windowMean(loads, i, acuteDays);
      chronic =
        coupling === 'uncoupled'
          ? // Chronic mean over the window *before* the acute days (no overlap).
            windowMean(loads, i - acuteDays, chronicDays - acuteDays)
          : windowMean(loads, i, chronicDays);
    }

    const acwr =
      chronic > 0 && historyDays >= minChronicDays
        ? round2(acute / chronic)
        : null;
    return {
      date,
      load: loads[i],
      acute: round2(acute),
      chronic: round2(chronic),
      acwr,
      flag: acwr == null ? null : acwrFlag(acwr),
      metric,
    } satisfies AcwrPoint;
  });
}

// ── date / math helpers (kept local so the module has no deps) ───────────────

/** Inclusive list of YYYY-MM-DD keys from start to end. */
export function enumerateDates(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  // Guard against pathological ranges (e.g. malformed dates) capping at ~3y.
  for (let guard = 0; cur <= end && guard < 1500; guard++) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function addDays(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + delta);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Mean of the trailing `window` entries ending at index `i` (inclusive). */
function windowMean(values: number[], i: number, window: number): number {
  if (i < 0 || window <= 0) return 0; // not enough history yet
  const from = Math.max(0, i - window + 1);
  let sum = 0;
  for (let k = from; k <= i; k++) sum += values[k];
  return sum / (i - from + 1);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
