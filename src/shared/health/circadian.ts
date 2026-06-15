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
  total: number | null; // 0–100, or null when there is insufficient data (<3 nights)
  consistency: number; // 0–100  sleep timing regularity
  amplitude: number;   // 0–100  rest-phase robustness (duration adequacy + regularity)
  efficiency: number;  // 0–100  from sleep efficiency
  recovery: number;    // 0–100  RHR vs baseline
  light: number;       // 0–100  regular morning light exposure (entrainment)
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
      return midSleep(bed, wake);
    });
    const msf = circularMean(freeMidSleeps);

    // Roenneberg MCTQ sleep-debt correction:
    //   SDweek = (SDw·nw + SDf·nf) / (nw + nf)   — average sleep duration across the week
    //   MSFsc  = MSF − (SDf − SDweek)/2,  applied only when SDf > SDweek
    // (oversleeping on free days indicates debt; otherwise no correction).
    const nFree = freeSessions.length;
    const nWork = workSessions.length;
    const sdFree = freeSessions.reduce((s, r) => s + r.timeAsleepHours, 0) / nFree;
    const sdWork = nWork >= 1
      ? workSessions.reduce((s, r) => s + r.timeAsleepHours, 0) / nWork
      : sdFree;
    const sdWeek = (nWork + nFree) > 0
      ? (sdWork * nWork + sdFree * nFree) / (nWork + nFree)
      : sdFree;
    const correction = sdFree > sdWeek ? (sdFree - sdWeek) / 2 : 0;
    msfsc = normalizeHour(msf - correction);

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

  // DLMO ≈ MSFsc − 2.5h (Lockley/Burgess: DLMO precedes sleep midpoint by ~2–3h)
  const dlmoEstimate = msfsc !== null ? normalizeHour(msfsc - 2.5) : null;
  // CTmin ≈ DLMO + 7h (Czeisler/Van Dongen: body temp nadir ~7h after melatonin onset)
  const ctminEstimate = dlmoEstimate !== null ? normalizeHour(dlmoEstimate + 7) : null;

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
  rhrBaseline: number | null,
  morningLightFraction: number | null = null  // 0–1 share of recent days with morning light; null = no data
): CircadianScore {
  const recent = [...sessions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 14);

  if (recent.length < 3) {
    // Insufficient data: total = null (not 0). A real 0 means "worst rhythm" and would
    // both display as 0/100 and apply the battery's 10% circadian penalty; null lets
    // callers show "—" and skip the multiplier (multiplier = 1.0).
    return { total: null, consistency: 0, amplitude: 0, efficiency: 0, recovery: 50, light: 0 };
  }

  // Consistency: sleep onset SD (0h=100, 3h+=0)
  const onsetSD = circularSD(recent.map(s => toDecimalHours(s.bedtime)));
  const consistency = clamp(Math.round((1 - onsetSD / 3) * 100), 0, 100);

  // Amplitude (rest-phase robustness): a strong circadian rest phase = an adequate,
  // consolidated sleep block that recurs at a stable length. The Amazfit gives no
  // reliable *daytime* HR for a true HR rest/active contrast, so we proxy amplitude
  // from (a) how close mean sleep is to a consolidated ~8h block and (b) how stable
  // that length is night to night. Unlike the old (wake−sleep)/(wake+sleep) formula,
  // this no longer rewards short sleep (which previously scored *higher* amplitude).
  const durations = recent.map(r => r.timeAsleepHours);
  const avgSleepH = durations.reduce((s, v) => s + v, 0) / durations.length;
  const durAdequacy = clamp(1 - Math.abs(avgSleepH - 8) / 4, 0, 1);       // 8h=1.0, ≤4h or ≥12h=0
  const durSD = Math.sqrt(durations.reduce((s, v) => s + (v - avgSleepH) ** 2, 0) / durations.length);
  const durRegularity = clamp(1 - durSD / 2, 0, 1);                        // SD 0h=1.0, SD≥2h=0
  const amplitude = clamp(Math.round((durAdequacy * 0.6 + durRegularity * 0.4) * 100), 0, 100);

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

  // Light: regular morning light exposure is the strongest entrainment signal.
  // null (no logging) → neutral 50 so it neither rewards nor penalizes.
  const light = morningLightFraction === null ? 50 : clamp(Math.round(morningLightFraction * 100), 0, 100);

  const total = Math.round(
    consistency * 0.30 +
    amplitude   * 0.20 +
    efficiency  * 0.20 +
    recovery    * 0.15 +
    light       * 0.15
  );

  return { total, consistency, amplitude, efficiency, recovery, light };
}

// ── Two-Process Alertness Curve ─────────────────────────────────────────────

export function computeAlertnessCurve(
  profile: CircadianProfile,
  wakeHour: number,
  measuredCtmin: number | null = null   // last night's HR-nadir Tmin; overrides chronic MSFsc estimate
): AlertnessPoint[] {
  const safeWake = (wakeHour >= 4 && wakeHour <= 13) ? wakeHour : 7.0;
  // Process C: prefer the measured HR nadir (tonight's actual biology) over the 30-night average
  const ctmin = measuredCtmin ?? profile.ctminEstimate ?? normalizeHour(safeWake - 1);

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

    // Process S: exponential wake buildup / sleep decay.
    // Use safeWake (clamped) so a bad HC timestamp can't desync S from C/sleepStart.
    let processS: number;
    const hoursAwake = normalizeHour(hour - safeWake);
    const hoursSleep = normalizeHour(hour - sleepStart);

    if (hoursAwake <= 24 - avgSleep) {
      // During the waking window (24h − sleep duration): S builds exponentially
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
  wakeHour: number,
  measuredCtmin: number | null = null   // last night's HR-nadir Tmin; overrides chronic MSFsc estimate
): CircadianWindows {
  // Guard against bad HC timestamp data (e.g. UTC offset errors producing 1–3am)
  const safeWake = (wakeHour >= 4 && wakeHour <= 13) ? wakeHour : 7.0;
  // When measured: ctmin is the HR nadir; DLMO = ctmin−7h (Czeisler/Van Dongen inverse)
  const ctmin = measuredCtmin ?? profile.ctminEstimate ?? normalizeHour(safeWake - 1);
  const dlmo  = measuredCtmin != null
    ? normalizeHour(measuredCtmin - 7)
    : (profile.dlmoEstimate ?? normalizeHour(safeWake + 14));

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

// ── Tmin Detection (Core Body Temperature Minimum) ──────────────────────────

export interface TminResult {
  tminHour: number;   // decimal hour 0–24
  source: 'hr' | 'estimated';
}

export interface MelatoninWindows {
  tminHour: number;
  morningLight: { start: number; end: number };  // Tmin+2h, 30 min window
  deepFocus:    { start: number; end: number };  // Tmin+4 → Tmin+7h
  strengthPeak: { start: number; end: number };  // Tmin+10h, 30 min window
  melatoninOnset: number;                        // Tmin−9h (digital curfew)
  source: 'hr' | 'estimated';
}

// Finds the 30-min lowest-HR window in the pre-wake portion of overnight biometrics.
// Tmin (Core Body Temperature Minimum) always occurs 0.5–2h before spontaneous wake,
// so only the final `priorHoursBeforeWake` hours are scanned — this avoids
// confusing the early-night deep-sleep HR dip (which is NOT Tmin) with the real nadir.
// Falls back to avgWakeHour−1 when HR data is sparse or absent.
export function computeTmin(
  hrSamples: { t: string; v: number }[],
  bedIso: string,
  wakeIso: string,
  priorHoursBeforeWake = 3   // physiological Tmin window; scanning whole night finds wrong nadir
): TminResult {
  const bedMs  = new Date(bedIso).getTime();
  const wakeMs = new Date(wakeIso).getTime();

  // Guard NaN first — empty strings or missing session produce invalid dates
  if (!Number.isFinite(bedMs) || !Number.isFinite(wakeMs)) {
    return { tminHour: normalizeHour(7 - 1), source: 'estimated' };
  }

  // Constrain search to the pre-wake window where Tmin actually lives
  const searchFromMs = Math.max(bedMs, wakeMs - priorHoursBeforeWake * 3600000);

  const samples = hrSamples
    .map(s => ({ ms: new Date(s.t).getTime(), v: s.v }))
    .filter(s => Number.isFinite(s.ms) && s.ms >= searchFromMs && s.ms <= wakeMs)
    .sort((a, b) => a.ms - b.ms);

  if (samples.length < 3) {
    const wakeDate = new Date(wakeIso);
    const wakeHour = wakeDate.getHours() + wakeDate.getMinutes() / 60;
    return { tminHour: normalizeHour(wakeHour - 1), source: 'estimated' };
  }

  const WINDOW_MS = 30 * 60 * 1000;
  let bestAvgHr = Infinity;
  let bestMidMs = 0;
  let foundWindow = false;

  for (let i = 0; i < samples.length; i++) {
    const wStart = samples[i].ms;
    const wEnd   = wStart + WINDOW_MS;
    if (wStart >= wakeMs - WINDOW_MS) break; // no room for a full window

    const inWindow = samples.filter(s => s.ms >= wStart && s.ms <= wEnd);
    if (inWindow.length < 2) continue;

    const avgHr = inWindow.reduce((sum, s) => sum + s.v, 0) / inWindow.length;
    if (avgHr < bestAvgHr) {
      bestAvgHr = avgHr;
      bestMidMs = wStart + WINDOW_MS / 2;
      foundWindow = true;
    }
  }

  // Sparse HR in the pre-wake window — fall back to estimated
  if (!foundWindow) {
    const wakeDate = new Date(wakeIso);
    const wakeHour = wakeDate.getHours() + wakeDate.getMinutes() / 60;
    return { tminHour: normalizeHour(wakeHour - 1), source: 'estimated' };
  }

  const mid = new Date(bestMidMs);
  return {
    tminHour: normalizeHour(mid.getHours() + mid.getMinutes() / 60),
    source: 'hr',
  };
}

export function computeMelatoninWindows(tmin: TminResult): MelatoninWindows {
  const h = tmin.tminHour;
  return {
    tminHour: h,
    morningLight:   { start: normalizeHour(h + 2),    end: normalizeHour(h + 2.5) },
    deepFocus:      { start: normalizeHour(h + 4),    end: normalizeHour(h + 7)   },
    strengthPeak:   { start: normalizeHour(h + 10),   end: normalizeHour(h + 10.5) },
    melatoninOnset: normalizeHour(h - 9),
    source: tmin.source,
  };
}

// ── Recommendations ─────────────────────────────────────────────────────────

export interface EnergyLog {
  energy_wake: number | null;
  energy_noon: number | null;
  energy_evening: number | null;
}

export function computeCircadianRecommendations(
  profile: CircadianProfile,
  windows: CircadianWindows,
  socialJetlag: number | null,
  workoutTimesHours: number[],   // today's workout start hours
  energyLogs: EnergyLog[] = []    // recent subjective energy self-reports
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

  // Subjective energy: compare logged alertness to the chronotype to validate the model.
  const avgOf = (vals: (number | null)[]) => {
    const nums = vals.filter((v): v is number => v !== null);
    return nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : null;
  };
  const wakeE = avgOf(energyLogs.map(l => l.energy_wake));
  const eveE  = avgOf(energyLogs.map(l => l.energy_evening));
  if (wakeE !== null && eveE !== null && energyLogs.length >= 3) {
    if (eveE - wakeE >= 2 && profile.chronotype !== 'late') {
      nudges.push('You consistently report more energy in the evening than at wake — an evening-leaning pattern. Anchoring morning light and a fixed wake time can pull your peak earlier.');
    } else if (wakeE - eveE >= 2) {
      nudges.push('Your energy fades noticeably by evening — protect a wind-down routine and avoid late stimulants to preserve sleep pressure.');
    } else if (wakeE <= 3) {
      nudges.push('Low morning energy is common with sleep debt or misaligned light — bright light within 30 min of waking is the fastest lever.');
    }
  }

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
