/**
 * Recovery Time service — pure TS, no DB or Vue deps (mirrors trainingLoad.ts /
 * recoveryBaseline.ts so it stays unit-testable independent of the UI).
 *
 * Estimates how long until the body is recovered from the most recent gym
 * session — a countdown like Garmin's "recovery time advisor", not a 0–100
 * "how recovered are you" score (that role is already filled by the battery /
 * readiness score).
 *
 * Model:
 *   1. Base recovery hours scale with the session's internal load. Session RPE
 *      load (sRPE = RPE × duration, Foster's session-RPE method) is the
 *      preferred driver because it captures intensity directly; volume load
 *      (Σ weight×reps) is the fallback when no RPE was logged.
 *   2. That base is then modulated by the two recovery inputs the user picked:
 *        • recovery signal (RHR/HRV vs personal baseline, as a direction-
 *          normalised z where negative = worse) — poor recovery lengthens the
 *          time, good recovery shortens it.
 *        • last night's sleep score (0–100) — a poor night lengthens it.
 *
 * The constants are deliberately interpretable (a hard ~60-min RPE-8 session →
 * ~2 days at neutral recovery/sleep) rather than fitted to any proprietary
 * model, and the whole thing is clamped to a sane 0–96 h band.
 */

export type RecoveryBasis = 'rpe' | 'volume' | 'none';

export interface RecoveryTimeInput {
  /** Session/day sRPE load (RPE × minutes), summed across the day. null = none. */
  rpeLoad: number | null;
  /** Session/day volume load (Σ weight×reps). Fallback driver when no RPE. */
  volumeLoad: number;
  /** Latest recovery z (direction-normalised; negative = worse). null = unknown. */
  recoveryZ: number | null;
  /** Last night's sleep score 0–100. null = unknown. */
  sleepScore: number | null;
}

export interface RecoveryTimeEstimate {
  /** Total estimated recovery time for the session, in hours. */
  totalHours: number;
  /** Hours from load alone, before the recovery/sleep modifiers. */
  baseHours: number;
  /** Which load unit drove the base estimate. */
  basis: RecoveryBasis;
  /** Modifier from the recovery signal (×). 1.0 when unknown. */
  recoveryMultiplier: number;
  /** Modifier from sleep (×). 1.0 when unknown. */
  sleepMultiplier: number;
}

export interface RecoveryTimeOptions {
  /** sRPE load per recovery hour. Default 12.5 (RPE8×60min=480 → ~38 h). */
  rpeLoadPerHour?: number;
  /** Volume load per recovery hour. Default 280 (10 000 kg → ~36 h). */
  volumeLoadPerHour?: number;
  /** Max recovery time emitted (hours). Default 96 (4 days). */
  maxHours?: number;
  /** Sleep score treated as "neutral" (no modifier). Default 75. */
  sleepReference?: number;
}

const clamp = (v: number, lo: number, hi: number) =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;

/**
 * Estimate total recovery time for one session/day's load, modulated by the
 * recovery signal and last night's sleep.
 */
export function estimateRecoveryHours(
  input: RecoveryTimeInput,
  options: RecoveryTimeOptions = {}
): RecoveryTimeEstimate {
  const rpePerHour = options.rpeLoadPerHour ?? 12.5;
  const volPerHour = options.volumeLoadPerHour ?? 280;
  const maxHours = options.maxHours ?? 96;
  const sleepRef = options.sleepReference ?? 75;

  const rpeLoad = input.rpeLoad != null && input.rpeLoad > 0 ? input.rpeLoad : 0;
  const volumeLoad = input.volumeLoad > 0 ? input.volumeLoad : 0;

  // Prefer sRPE (direct intensity); fall back to volume.
  let basis: RecoveryBasis = 'none';
  let baseHours = 0;
  if (rpeLoad > 0) {
    basis = 'rpe';
    baseHours = rpeLoad / rpePerHour;
  } else if (volumeLoad > 0) {
    basis = 'volume';
    baseHours = volumeLoad / volPerHour;
  }
  baseHours = clamp(baseHours, 0, maxHours);

  // Recovery signal: each z point shifts the estimate ~15%. Worse recovery
  // (negative z) lengthens it; better recovery shortens it.
  const recoveryMultiplier =
    input.recoveryZ == null ? 1 : clamp(1 - 0.15 * input.recoveryZ, 0.7, 1.4);

  // Sleep: every 10 points away from the reference shifts it ~10%.
  const sleepMultiplier =
    input.sleepScore == null
      ? 1
      : clamp(1 + (sleepRef - input.sleepScore) / 100, 0.8, 1.3);

  const totalHours =
    basis === 'none'
      ? 0
      : Math.round(clamp(baseHours * recoveryMultiplier * sleepMultiplier, 0, maxHours));

  return {
    totalHours,
    baseHours: Math.round(baseHours),
    basis,
    recoveryMultiplier: Math.round(recoveryMultiplier * 100) / 100,
    sleepMultiplier: Math.round(sleepMultiplier * 100) / 100,
  };
}

export interface RecoveryTimeStatus extends RecoveryTimeEstimate {
  /** Hours still remaining from `now`, given the session end time. */
  remainingHours: number;
  /** ISO timestamp when recovery completes; null when no session/end time. */
  readyAt: string | null;
  /** True once `remainingHours` reaches 0. */
  recovered: boolean;
  /** Short human label, e.g. "Recovered", "18h", "1d 4h". */
  label: string;
}

/**
 * Full recovery-time status: the estimate plus the live countdown from `now`.
 * `sessionEndIso` is when the session ended; null/invalid → no countdown
 * (remaining = total, readyAt = null).
 */
export function recoveryTimeStatus(
  input: RecoveryTimeInput,
  sessionEndIso: string | null,
  now: Date = new Date(),
  options: RecoveryTimeOptions = {}
): RecoveryTimeStatus {
  const est = estimateRecoveryHours(input, options);

  if (est.basis === 'none' || est.totalHours <= 0) {
    return { ...est, remainingHours: 0, readyAt: null, recovered: true, label: 'Recovered' };
  }

  const endMs = sessionEndIso ? new Date(sessionEndIso).getTime() : NaN;
  if (!Number.isFinite(endMs)) {
    // No end time — report the full estimate without a wall-clock anchor.
    return {
      ...est,
      remainingHours: est.totalHours,
      readyAt: null,
      recovered: false,
      label: recoveryTimeLabel(est.totalHours),
    };
  }

  const elapsedHours = Math.max(0, (now.getTime() - endMs) / 3_600_000);
  const remainingHours = Math.max(0, Math.round((est.totalHours - elapsedHours) * 10) / 10);
  const recovered = remainingHours <= 0;
  return {
    ...est,
    remainingHours,
    readyAt: new Date(endMs + est.totalHours * 3_600_000).toISOString(),
    recovered,
    label: recovered ? 'Recovered' : recoveryTimeLabel(remainingHours),
  };
}

/** "Recovered" | "<1h" | "18h" | "1d 4h". */
export function recoveryTimeLabel(hours: number): string {
  if (hours <= 0) return 'Recovered';
  if (hours < 1) return '<1h';
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  const rem = Math.round(hours - days * 24);
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
}

export interface SessionForRecovery {
  date: string;                       // local YYYY-MM-DD
  time_end: string | null;           // ISO; when the session ended
  session_rpe: number | null;
  duration_minutes: number | null;
  volume: number;
}

export interface LatestTrainingDay {
  date: string;
  rpeLoad: number | null;            // summed sRPE for the day (null = none had RPE)
  volumeLoad: number;
  sessionEndIso: string | null;      // latest session end on that day
}

/**
 * Pick the most recent calendar day that has any training load and aggregate it.
 * Multiple sessions on that day are summed (two-a-days add up), matching how
 * trainingLoad aggregates per day. Returns null when there's no load at all.
 */
export function aggregateLatestTrainingDay(
  sessions: SessionForRecovery[]
): LatestTrainingDay | null {
  // Group by date.
  const byDate = new Map<string, SessionForRecovery[]>();
  for (const s of sessions) {
    if (!s.date) continue;
    (byDate.get(s.date) ?? byDate.set(s.date, []).get(s.date)!).push(s);
  }

  const dates = [...byDate.keys()].sort(); // ascending
  for (let i = dates.length - 1; i >= 0; i--) {
    const rows = byDate.get(dates[i])!;
    let rpeLoad = 0;
    let hasRpe = false;
    let volumeLoad = 0;
    let latestEnd: number = NaN;
    let latestEndIso: string | null = null;

    for (const r of rows) {
      volumeLoad += Math.max(0, Number(r.volume) || 0);
      if (r.session_rpe != null && r.duration_minutes != null && r.session_rpe > 0 && r.duration_minutes > 0) {
        rpeLoad += r.session_rpe * r.duration_minutes;
        hasRpe = true;
      }
      const endMs = r.time_end ? new Date(r.time_end).getTime() : NaN;
      if (Number.isFinite(endMs) && (!Number.isFinite(latestEnd) || endMs > latestEnd)) {
        latestEnd = endMs;
        latestEndIso = r.time_end;
      }
    }

    if (volumeLoad > 0 || hasRpe) {
      return {
        date: dates[i],
        rpeLoad: hasRpe ? rpeLoad : null,
        volumeLoad,
        sessionEndIso: latestEndIso,
      };
    }
  }

  return null;
}
