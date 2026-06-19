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

/** Per-day aggregated load. */
export interface DailyLoad {
  date: string;
  volumeLoad: number;
  /** Σ(rpe × duration) across the day's sessions; null when no session had RPE. */
  rpeLoad: number | null;
  /**
   * The load value fed into the ACWR model. Uses RPE load when at least one
   * session that day recorded RPE (sessions without RPE contribute 0 to the RPE
   * sum but volume still counts elsewhere); otherwise falls back to volume load.
   */
  load: number;
  /** Which metric `load` was derived from — useful for labelling. */
  loadSource: 'rpe' | 'volume';
}

export interface AcwrPoint {
  date: string;
  load: number;
  /** Average daily load over the trailing acute window (default 7 days). */
  acute: number;
  /** Average daily load over the trailing chronic window (default 28 days). */
  chronic: number;
  /** acute / chronic; null until enough history exists or chronic is 0. */
  acwr: number | null;
  flag: AcwrFlag | null;
}

export interface AcwrOptions {
  acuteDays?: number;
  chronicDays?: number;
  /** Calendar days of history required before ACWR is emitted (else null). */
  minChronicDays?: number;
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
    .map(([date, b]) => {
      const rpeLoad = b.hasRpe ? b.rpe : null;
      const useRpe = rpeLoad != null && rpeLoad > 0;
      return {
        date,
        volumeLoad: b.volume,
        rpeLoad,
        load: useRpe ? rpeLoad : b.volume,
        loadSource: useRpe ? 'rpe' : 'volume',
      } satisfies DailyLoad;
    });
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
 * range so rest days correctly drag down the acute average. Acute and chronic
 * are average daily loads over their windows.
 */
export function computeAcwrSeries(
  dailyLoads: DailyLoad[],
  options: AcwrOptions = {}
): AcwrPoint[] {
  const acuteDays = options.acuteDays ?? 7;
  const chronicDays = options.chronicDays ?? 28;
  const minChronicDays = options.minChronicDays ?? 14;

  if (dailyLoads.length === 0) return [];

  const loadByDate = new Map<string, number>();
  for (const d of dailyLoads) loadByDate.set(d.date, d.load);

  const start = dailyLoads[0].date;
  const end = dailyLoads[dailyLoads.length - 1].date;
  const dates = enumerateDates(start, end);
  const loads = dates.map((d) => loadByDate.get(d) ?? 0);

  return dates.map((date, i) => {
    const historyDays = i + 1;
    const acute = windowMean(loads, i, acuteDays);
    const chronic = windowMean(loads, i, chronicDays);
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
  const from = Math.max(0, i - window + 1);
  let sum = 0;
  for (let k = from; k <= i; k++) sum += values[k];
  return sum / (i - from + 1);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
