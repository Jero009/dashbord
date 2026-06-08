// Circadian rhythm computation engine
// Based on: two-process model, MSFsc chronotype, IS/IV/RA nonparametric actigraphy

export interface SleepRecord {
  date: string;           // YYYY-MM-DD
  bedtime: string;        // ISO timestamp
  waketime: string;       // ISO timestamp
  timeAsleepHours: number;
  efficiency: number;     // 0-1
}

export type DayType = 'work' | 'free';

export interface CircadianProfile {
  msfsc: number | null;                              // mid-sleep free-day corrected (decimal hours 0–24)
  chronotype: 'early' | 'intermediate' | 'late' | 'unknown';
  dlmoEstimate: number | null;                       // estimated DLMO (decimal hours)
  ctminEstimate: number | null;                      // core temp minimum (decimal hours)
  sleepConsistency: number;                          // 0–1 (1 = perfectly regular)
  socialJetlag: number | null;                       // absolute hours difference work vs free
  avgSleepOnset: number | null;                      // decimal hours, last 7 days
  avgWakeTime: number | null;                        // decimal hours, last 7 days
  dataQuality: 'good' | 'limited' | 'insufficient'; // ≥7 nights = good, 3–6 = limited, <3 = insufficient
}

export interface CircadianScore {
  total: number;       // 0–100
  consistency: number; // 0–100  sleep timing regularity
  amplitude: number;   // 0–100  sleep/wake contrast (RA proxy)
  efficiency: number;  // 0–100  from sleep efficiency
  recovery: number;    // 0–100  RHR vs baseline
}

export interface AlertnessPoint {
  hour: number;       // 0–23
  alertness: number;  // 0–1
}

export interface CircadianWindows {
  cognitiveStart: number;
  cognitiveEnd: number;
  exerciseMorning: { start: number; end: number } | null;
  exerciseAfternoon: { start: number; end: number } | null;
  lastMealBy: number;
  bedtimeTarget: number;
}

export interface CircadianRecommendations {
  nudges: string[];
  socialJetlagWarning: string | null;
  chronotypeNote: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function toDecimalHours(isoString: string): number {
  const d = new Date(isoString);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

function midSleep(bedHours: number, wakeHours: number): number {
  // Handle midnight crossover
  let wake = wakeHours;
  if (wake < bedHours) wake += 24;
  return ((bedHours + wake) / 2) % 24;
}

function normalizeHour(h: number): number {
  return ((h % 24) + 24) % 24;
}

function circularMean(angles: number[]): number {
  // Mean of circular quantities (hours on a 24h clock)
  const sinSum = angles.reduce((s, a) => s + Math.sin((a / 24) * 2 * Math.PI), 0);
  const cosSum = angles.reduce((s, a) => s + Math.cos((a / 24) * 2 * Math.PI), 0);
  const mean = Math.atan2(sinSum / angles.length, cosSum / angles.length);
  return normalizeHour((mean / (2 * Math.PI)) * 24);
}

function circularSD(angles: number[]): number {
  const mean = circularMean(angles);
  const diffs = angles.map(a => {
    let d = Math.abs(a - mean);
    if (d > 12) d = 24 - d;
    return d;
  });
  return Math.sqrt(diffs.reduce((s, d) => s + d * d, 0) / diffs.length);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// ── Chronotype & Phase Estimator ────────────────────────────────────────────

export function computeCircadianProfile(
  sessions: SleepRecord[],
  dayTypes: Map<string, DayType>
): CircadianProfile {
  const recent = [...sessions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);

  if (recent.length < 3) {
    return {
      msfsc: null,
      chronotype: 'unknown',
      dlmoEstimate: null,
      ctminEstimate: null,
      sleepConsistency: 0,
      socialJetlag: null,
      avgSleepOnset: null,
      avgWakeTime: null,
      dataQuality: 'insufficient',
    };
  }

  const dataQuality: CircadianProfile['dataQuality'] =
    recent.length >= 7 ? 'good' : 'limited';

  // Sleep onset times for consistency
  const onsetHours = recent.map(s => toDecimalHours(s.bedtime));
  const wakeHours  = recent.map(s => toDecimalHours(s.waketime));

  const avgSleepOnset = circularMean(onsetHours);
  const avgWakeTime   = circularMean(wakeHours);
  const onsetSD       = circularSD(onsetHours);

  // Consistency: SD of 0h = perfect (1.0), SD of 3h+ = poor (0.0)
  const sleepConsistency = clamp(1 - onsetSD / 3, 0, 1);

  // MSFsc — mid-sleep on free days, sleep-debt corrected
  const freeSessions = recent.filter(s => {
    const t = dayTypes.get(s.date);
    return t === 'free';
  });
  const workSessions = recent.filter(s => {
    const t = dayTypes.get(s.date);
    return t === 'work';
  });

  let msfsc: number | null = null;
  let socialJetlag: number | null = null;

  if (freeSessions.length >= 2) {
    const freeMidSleeps = freeSessions.map(s => {
      const bed  = toDecimalHours(s.bedtime);
      const wake = toDecimalHours(s.waketime);
      const ms   = midSleep(bed, wake);
      // MSFsc correction: subtract half of sleep debt (free sleep - avg sleep)
      const avgSleep = recent.reduce((acc, r) => acc + r.timeAsleepHours, 0) / recent.length;
      const correction = Math.max(0, (s.timeAsleepHours - avgSleep) / 2);
      return normalizeHour(ms - correction);
    });
    msfsc = circularMean(freeMidSleeps);

    if (workSessions.length >= 2) {
      const workMidSleeps = workSessions.map(s => {
        const bed  = toDecimalHours(s.bedtime);
        const wake = toDecimalHours(s.waketime);
        return midSleep(bed, wake);
      });
      const workMsf = circularMean(workMidSleeps);
      let diff = msfsc - workMsf;
      if (diff > 12) diff -= 24;
      if (diff < -12) diff += 24;
      socialJetlag = Math.abs(diff);
    }
  } else {
    // Fall back to all-session mid-sleep when no free-day distinction available
    const allMidSleeps = recent.map(s => {
      const bed  = toDecimalHours(s.bedtime);
      const wake = toDecimalHours(s.waketime);
      return midSleep(bed, wake);
    });
    msfsc = circularMean(allMidSleeps);
  }

  // Chronotype from MSFsc (population thresholds from Roenneberg et al.)
  // MSFsc <2:30 = early, 2:30–5:30 = intermediate, >5:30 = late
  let chronotype: CircadianProfile['chronotype'] = 'intermediate';
  if (msfsc !== null) {
    const h = normalizeHour(msfsc);
    if (h < 2.5 || h >= 20) chronotype = 'early';
    else if (h >= 5.5 && h < 20) chronotype = 'late';
    else chronotype = 'intermediate';
  }

  // DLMO ≈ sleep onset (free days) − 2h, or avg onset − 2h
  const dlmoBase = freeSessions.length >= 2
    ? circularMean(freeSessions.map(s => toDecimalHours(s.bedtime)))
    : avgSleepOnset;
  const dlmoEstimate = dlmoBase !== null ? normalizeHour(dlmoBase - 2) : null;
  const ctminEstimate = dlmoEstimate !== null ? normalizeHour(dlmoEstimate + 6) : null;

  return {
    msfsc,
    chronotype,
    dlmoEstimate,
    ctminEstimate,
    sleepConsistency,
    socialJetlag,
    avgSleepOnset,
    avgWakeTime,
    dataQuality,
  };
}

// ── Circadian Health Score ──────────────────────────────────────────────────

export function computeCircadianScore(
  sessions: SleepRecord[],
  rhrToday: number | null,
  rhrBaseline: number | null
): CircadianScore {
  const recent = [...sessions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 14);

  if (recent.length < 3) {
    return { total: 0, consistency: 0, amplitude: 0, efficiency: 0, recovery: 50 };
  }

  // Consistency: sleep onset SD (0h=100, 3h+=0)
  const onsetSD = circularSD(recent.map(s => toDecimalHours(s.bedtime)));
  const consistency = clamp(Math.round((1 - onsetSD / 3) * 100), 0, 100);

  // Amplitude (RA proxy): average sleep fraction of 24h relative to a 50% target
  // RA = (active_hours - rest_hours) / 24 — for sleep we use time-in-bed
  // Higher daily activity contrast (long wake, good sleep) = higher RA
  const avgSleepH = recent.reduce((s, r) => s + r.timeAsleepHours, 0) / recent.length;
  const avgWakeH  = 24 - avgSleepH;
  const ra        = Math.abs(avgWakeH - avgSleepH) / 24;   // 0–1
  const amplitude = clamp(Math.round(ra * 100), 0, 100);

  // Efficiency: mean sleep efficiency (0–100)
  const avgEff  = recent.reduce((s, r) => s + r.efficiency, 0) / recent.length;
  const efficiency = clamp(Math.round(avgEff * 100), 0, 100);

  // Recovery: RHR vs 14-day baseline (ratio, clamped 0.7–1.3)
  let recovery = 50;
  if (rhrToday !== null && rhrBaseline !== null && rhrBaseline > 0) {
    const ratio = rhrToday / rhrBaseline;
    // ratio < 1 = better than baseline → higher recovery score
    // ratio > 1 = elevated RHR → lower recovery
    recovery = clamp(Math.round((1.3 - ratio) / 0.6 * 100), 0, 100);
  }

  const total = Math.round(
    consistency * 0.35 +
    amplitude   * 0.25 +
    efficiency  * 0.25 +
    recovery    * 0.15
  );

  return { total, consistency, amplitude, efficiency, recovery };
}

// ── Two-Process Alertness Curve ─────────────────────────────────────────────

export function computeAlertnessCurve(
  profile: CircadianProfile,
  wakeHour: number
): AlertnessPoint[] {
  const safeWake = (wakeHour >= 4 && wakeHour <= 13) ? wakeHour : 7.0;
  // Process C: sinusoidal anchored to CTmin (nadir of alertness)
  const ctmin = profile.ctminEstimate ?? normalizeHour(safeWake - 1);

  // Process S constants (Borbély 1982, typical values)
  const tauWake  = 18.2;  // wake time constant (hours)
  const tauSleep = 4.2;   // sleep time constant (hours)
  const avgSleep = 7.5;   // assumed sleep duration

  const sleepStart = normalizeHour(safeWake + (24 - avgSleep));

  const points: AlertnessPoint[] = [];

  for (let hour = 0; hour < 24; hour++) {
    // Process C: minimum at CTmin, maximum at CTmin+12h (afternoon alertness peak)
    // 0.5 - 0.5*cos gives 0 at ctmin and 1 at ctmin+12
    const phaseAngle = ((hour - ctmin) / 24) * 2 * Math.PI;
    const processC = 0.5 - 0.5 * Math.cos(phaseAngle);

    // Process S: exponential wake buildup / sleep decay
    let processS: number;
    const hoursAwake = normalizeHour(hour - wakeHour);
    const hoursSleep = normalizeHour(hour - sleepStart);

    if (hoursAwake <= avgSleep) {
      // During wake: S builds exponentially
      processS = 0.2 + 0.8 * (1 - Math.exp(-hoursAwake / tauWake));
    } else {
      // During sleep: S decays exponentially
      processS = 0.2 * Math.exp(-hoursSleep / tauSleep);
    }

    // Alertness = C - S (normalized to 0–1)
    const raw = processC - processS * 0.4;
    points.push({ hour, alertness: clamp(raw, 0, 1) });
  }

  // Normalize to 0–1 range
  const maxA = Math.max(...points.map(p => p.alertness));
  const minA = Math.min(...points.map(p => p.alertness));
  const range = maxA - minA || 1;

  return points.map(p => ({
    hour: p.hour,
    alertness: clamp((p.alertness - minA) / range, 0, 1),
  }));
}

// ── Timing Windows ──────────────────────────────────────────────────────────

export function computeCircadianWindows(
  profile: CircadianProfile,
  wakeHour: number
): CircadianWindows {
  // Guard against bad HC timestamp data (e.g. UTC offset errors producing 1–3am)
  const safeWake = (wakeHour >= 4 && wakeHour <= 13) ? wakeHour : 7.0;
  const ctmin = profile.ctminEstimate ?? normalizeHour(safeWake - 1);
  const dlmo  = profile.dlmoEstimate ?? normalizeHour(wakeHour + 14);

  // Cognitive peak: CTmin + 2h → CTmin + 8h (peak alertness window)
  const cognitiveStart = normalizeHour(ctmin + 2);
  const cognitiveEnd   = normalizeHour(ctmin + 8);

  // Morning exercise: wake + 0.5h → wake + 2.5h (Youngstedt PRC: phase-advance window)
  const exMorningStart = normalizeHour(safeWake + 0.5);
  const exMorningEnd   = normalizeHour(safeWake + 2.5);

  // Afternoon exercise: wake + 6h → wake + 9h (PRC 13:00–16:00 advance window)
  const exAfternoonStart = normalizeHour(safeWake + 6);
  const exAfternoonEnd   = normalizeHour(safeWake + 9);

  // Only show afternoon window if it's meaningfully separate from morning (≥2h gap)
  let exerciseAfternoon: CircadianWindows['exerciseAfternoon'] = null;
  let diff = exAfternoonStart - exMorningEnd;
  if (diff < 0) diff += 24;
  if (diff >= 2) {
    exerciseAfternoon = { start: exAfternoonStart, end: exAfternoonEnd };
  }

  // Last meal: estimated sleep onset - 3h
  const sleepOnset = profile.avgSleepOnset ?? normalizeHour(dlmo + 2);
  const lastMealBy = normalizeHour(sleepOnset - 3);

  // Bedtime target: average sleep onset (keep consistent)
  const bedtimeTarget = sleepOnset;

  return {
    cognitiveStart,
    cognitiveEnd,
    exerciseMorning: { start: exMorningStart, end: exMorningEnd },
    exerciseAfternoon,
    lastMealBy,
    bedtimeTarget,
  };
}

// ── Recommendations ─────────────────────────────────────────────────────────

export function computeCircadianRecommendations(
  profile: CircadianProfile,
  windows: CircadianWindows,
  socialJetlag: number | null,
  workoutTimesHours: number[]   // today's workout start hours
): CircadianRecommendations {
  const nudges: string[] = [];

  if (profile.dataQuality === 'insufficient') {
    return {
      nudges: ['Log at least 3 nights of sleep to generate personalized recommendations.'],
      socialJetlagWarning: null,
      chronotypeNote: 'Not enough data to determine chronotype.',
    };
  }

  const ctmin = profile.ctminEstimate;

  // Light nudge based on chronotype
  if (profile.chronotype === 'late') {
    nudges.push('Get outdoor light exposure within 30 min of waking — this is the strongest phase-advance signal for your late chronotype.');
    nudges.push('Dim screens and bright lights 90 min before your bedtime target to avoid further phase delay.');
  } else if (profile.chronotype === 'early') {
    nudges.push('Limit bright light in the final hours before bed to prevent advancing your sleep phase further.');
  }

  // Consistency nudge
  if (profile.sleepConsistency < 0.6) {
    nudges.push(`Your sleep onset varies by more than 1.5 h night to night. Irregular timing weakens your circadian amplitude — try to keep bedtime within a 30-min window.`);
  }

  // Exercise timing
  if (workoutTimesHours.length > 0 && ctmin !== null) {
    const lateWorkouts = workoutTimesHours.filter(h => {
      let d = h - ctmin;
      if (d < 0) d += 24;
      return d >= 9 && d <= 14; // >3h after ctmin+6 end = too late
    });
    if (lateWorkouts.length > 0) {
      nudges.push('High-intensity exercise after 20:00 can delay your circadian phase and suppress nocturnal recovery. Aim to finish workouts at least 2 h before bed.');
    }
  }

  // Meal timing
  nudges.push(`Aim to eat your last meal by ${formatHourStatic(windows.lastMealBy)} — eating later shifts peripheral clocks and raises hunger hormones overnight.`);

  // Social jetlag warning
  let socialJetlagWarning: string | null = null;
  if (socialJetlag !== null && socialJetlag > 1.5) {
    socialJetlagWarning = `Social jetlag of ${socialJetlag.toFixed(1)} h detected — your biological clock and social schedule are misaligned by more than 1.5 h. This has similar metabolic effects to mild shift work.`;
  }

  const chronotypeNote =
    profile.chronotype === 'late'
      ? 'Late chronotype — your biology naturally prefers later sleep and wake times. This is genetically influenced and developmentally normal in your 20s.'
      : profile.chronotype === 'early'
      ? 'Early chronotype — you are naturally alert in the morning and will tire earlier in the evening.'
      : profile.chronotype === 'intermediate'
      ? 'Intermediate chronotype — your natural sleep timing aligns well with a typical schedule.'
      : 'Chronotype could not be determined — log free days (no alarm) to calibrate.';

  return { nudges, socialJetlagWarning, chronotypeNote };
}

function formatHourStatic(h: number): string {
  const norm = ((h % 24) + 24) % 24;
  const hh   = Math.floor(norm);
  const mm   = Math.round((norm - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
