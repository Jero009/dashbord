// Cross-domain insights & training-recovery model.
//
// Pure TypeScript — no DB, no Vue. Mirrors the structure of `circadian.ts`:
// callers fetch the raw series from the DB and pass them in; everything here is
// deterministic and unit-testable. All functions tolerate empty/short input and
// degrade gracefully (return [] / null-ish values) rather than throwing.

export interface DatedValue {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface InsightsInput {
  sleepHours: DatedValue[];   // last night's hours asleep, keyed by morning date
  rhr: DatedValue[];          // resting heart rate per day
  readiness: DatedValue[];    // readiness score (0–100) per day
  dailyVolume: DatedValue[];  // training volume (kg moved) per day
}

export type LoadStatus = 'insufficient' | 'detraining' | 'optimal' | 'high' | 'undertraining';

export interface TrainingLoad {
  acuteTotal: number;       // sum of the last 7 days
  chronicWeeklyAvg: number; // average weekly load over the last 28 days
  acwr: number;             // acute:chronic workload ratio (0 when no chronic base)
  status: LoadStatus;
}

export type RecoveryLevel = 'train' | 'maintain' | 'recover';

export interface RecoveryRecommendation {
  level: RecoveryLevel;
  reason: string;
}

export interface RecoveryInput {
  rhrToday: number | null;
  rhrBaseline: number | null; // rolling mean RHR
  readinessToday: number | null;
  acwr: number | null;
}

export type InsightTone = 'positive' | 'neutral' | 'warning';

export interface Insight {
  id: string;
  text: string;
  tone: InsightTone;
}

const TARGET_SLEEP_HOURS = 7.5;
const RHR_ELEVATED_RATIO = 1.08; // ≥8% above baseline reads as elevated
const ACWR_HIGH = 1.5;           // injury-risk "danger zone"
const ACWR_LOW = 0.8;            // detraining floor
const MIN_PAIRS = 6;             // minimum paired days for a correlation insight

// ── small numeric helpers ────────────────────────────────────────────────────

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// Pearson correlation; null when fewer than 3 points or zero variance.
export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  if (dx2 === 0 || dy2 === 0) return null;
  return num / Math.sqrt(dx2 * dy2);
}

// Align two date-keyed series on shared dates, preserving input order of `a`.
function alignPairs(a: DatedValue[], b: DatedValue[]): { xs: number[]; ys: number[] } {
  const bByDate = new Map(b.map((d) => [d.date, d.value]));
  const xs: number[] = [];
  const ys: number[] = [];
  for (const point of a) {
    const match = bByDate.get(point.date);
    if (match !== undefined && Number.isFinite(point.value) && Number.isFinite(match)) {
      xs.push(point.value);
      ys.push(match);
    }
  }
  return { xs, ys };
}

// Most recent N values from a date-keyed series (sorted ascending by date first).
function recentValues(series: DatedValue[], n: number): number[] {
  const sorted = [...series].sort((p, q) => p.date.localeCompare(q.date));
  return sorted.slice(-n).map((p) => p.value).filter((v) => Number.isFinite(v));
}

// ── training load ────────────────────────────────────────────────────────────

export function computeTrainingLoad(dailyVolume: DatedValue[]): TrainingLoad {
  const acute = recentValues(dailyVolume, 7);
  const chronic = recentValues(dailyVolume, 28);

  const acuteTotal = acute.reduce((a, b) => a + b, 0);
  const chronicTotal = chronic.reduce((a, b) => a + b, 0);
  const chronicWeeklyAvg = chronicTotal / 4;

  if (chronic.length < 14 || chronicWeeklyAvg <= 0) {
    return { acuteTotal, chronicWeeklyAvg, acwr: 0, status: 'insufficient' };
  }

  const acwr = acuteTotal / chronicWeeklyAvg;
  let status: LoadStatus;
  if (acwr > ACWR_HIGH) status = 'high';
  else if (acwr < ACWR_LOW) status = acuteTotal === 0 ? 'detraining' : 'undertraining';
  else status = 'optimal';

  return {
    acuteTotal: Math.round(acuteTotal),
    chronicWeeklyAvg: Math.round(chronicWeeklyAvg),
    acwr: Math.round(acwr * 100) / 100,
    status,
  };
}

// ── recovery recommendation ──────────────────────────────────────────────────

export function computeRecoveryRecommendation(input: RecoveryInput): RecoveryRecommendation {
  const { rhrToday, rhrBaseline, readinessToday, acwr } = input;

  const rhrRatio =
    rhrToday && rhrBaseline && rhrBaseline > 0 ? rhrToday / rhrBaseline : null;

  const rhrElevated = rhrRatio !== null && rhrRatio >= RHR_ELEVATED_RATIO;
  const readinessLow = readinessToday !== null && readinessToday < 45;
  const readinessMid = readinessToday !== null && readinessToday >= 45 && readinessToday < 60;
  const loadHigh = acwr !== null && acwr > ACWR_HIGH;

  // Strong stop signals → recover.
  if (readinessLow || (rhrElevated && loadHigh)) {
    const reason = readinessLow
      ? 'Readiness is low — prioritise rest today.'
      : 'Resting heart rate is up and training load is spiking — back off.';
    return { level: 'recover', reason };
  }

  // Mild caution → maintain.
  if (rhrElevated || loadHigh || readinessMid) {
    let reason = 'Keep volume steady today.';
    if (loadHigh) reason = 'Load is climbing fast — hold volume rather than adding.';
    else if (rhrElevated) reason = 'Resting heart rate is slightly elevated — keep it moderate.';
    return { level: 'maintain', reason };
  }

  return { level: 'train', reason: 'Recovery markers look good — green light to push.' };
}

// ── correlation & trend insights ─────────────────────────────────────────────

export function computeInsights(input: InsightsInput): Insight[] {
  const { sleepHours, rhr, readiness, dailyVolume } = input;
  const insights: Insight[] = [];

  // Sleep ↔ same-day training volume.
  const sv = alignPairs(sleepHours, dailyVolume);
  if (sv.xs.length >= MIN_PAIRS) {
    const r = pearson(sv.xs, sv.ys);
    if (r !== null && r >= 0.4) {
      insights.push({
        id: 'sleep-volume',
        tone: 'positive',
        text: 'You train harder after better sleep — your biggest sessions follow your longest nights.',
      });
    } else if (r !== null && r <= -0.4) {
      insights.push({
        id: 'sleep-volume-neg',
        tone: 'neutral',
        text: 'Your hardest sessions tend to follow shorter nights — watch for accumulating fatigue.',
      });
    }
  }

  // RHR ↔ readiness.
  const rr = alignPairs(rhr, readiness);
  if (rr.xs.length >= MIN_PAIRS) {
    const r = pearson(rr.xs, rr.ys);
    if (r !== null && r <= -0.4) {
      insights.push({
        id: 'rhr-readiness',
        tone: 'neutral',
        text: 'Readiness closely tracks your resting heart rate — elevated-RHR days score lower.',
      });
    }
  }

  // Weekly sleep average vs target.
  const recentSleep = recentValues(sleepHours, 7);
  if (recentSleep.length >= 3) {
    const avg = mean(recentSleep);
    if (avg < 7) {
      insights.push({
        id: 'sleep-low',
        tone: 'warning',
        text: `Averaging ${avg.toFixed(1)}h sleep this week — below the ${TARGET_SLEEP_HOURS}h target.`,
      });
    } else if (avg >= TARGET_SLEEP_HOURS) {
      insights.push({
        id: 'sleep-good',
        tone: 'positive',
        text: `Strong sleep week — averaging ${avg.toFixed(1)}h a night.`,
      });
    }
  }

  // RHR trend: last 3 days vs the prior baseline.
  const rhrAsc = [...rhr].sort((p, q) => p.date.localeCompare(q.date)).map((p) => p.value);
  if (rhrAsc.length >= 7) {
    const last3 = mean(rhrAsc.slice(-3));
    const base = mean(rhrAsc.slice(0, -3));
    if (base > 0 && last3 / base >= RHR_ELEVATED_RATIO) {
      insights.push({
        id: 'rhr-up',
        tone: 'warning',
        text: `Resting heart rate is trending up (${Math.round(last3)} vs ${Math.round(base)} bpm) — a sign of strain.`,
      });
    }
  }

  // Order: warnings first, then positives, then neutral. Cap at 4.
  const rank: Record<InsightTone, number> = { warning: 0, positive: 1, neutral: 2 };
  return insights.sort((a, b) => rank[a.tone] - rank[b.tone]).slice(0, 4);
}
