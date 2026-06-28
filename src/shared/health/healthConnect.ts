import { Capacitor } from '@capacitor/core';
import { Health, type AuthorizationStatus, type HealthSample, type AggregatedSample, type Workout as HCWorkout } from '@capgo/capacitor-health';
import { replaceHealthMetric, upsertReadinessScore, upsertSleepSession, getSleepSessionsBefore, getHealthMetricValuesBefore } from '@/shared/db/app_db';
import { getSleepGoalHours } from '@/shared/utils/userSettings';
import { clamp } from '@/shared/utils/math';

type HealthConnectDataType = 'steps' | 'sleep' | 'restingHeartRate' | 'heartRate' | 'respiratoryRate' | 'workouts';

// Core metrics the app actually depends on. These — and ONLY these — gate sync.
const HEALTH_CONNECT_CORE_READ_TYPES: HealthConnectDataType[] = ['steps', 'sleep', 'restingHeartRate', 'heartRate', 'respiratoryRate'];
// 'workouts' maps to READ_EXERCISE. It is optional — only used for the activity-drain
// component of the battery score (getRecentActivities, which degrades gracefully).
// It is requested so users CAN grant it, but it must never gate core sync: the Amazfit
// produces no exercise sessions, so this permission is commonly ungranted/reset and
// requiring it silently blocked all metric syncing.
const HEALTH_CONNECT_READ_TYPES: HealthConnectDataType[] = [...HEALTH_CONNECT_CORE_READ_TYPES, 'workouts'];

// True when every core metric is granted. Optional 'workouts' is intentionally ignored.
const hasCoreReadAccess = (readAuthorized: string[]) =>
  HEALTH_CONNECT_CORE_READ_TYPES.every((type) => readAuthorized.includes(type));

const HEALTH_CONNECT_SOURCE = 'health-connect';

export interface HealthConnectAccessResult {
  available: boolean;
  granted: boolean;
  reason?: string;
  status?: AuthorizationStatus;
}

export interface HealthConnectSyncResult {
  available: boolean;
  granted: boolean;
  synced: number;
}

export interface SleepStageSummary {
  stage: string;
  minutes: number;
  share: number;
}

export interface SleepStageTimeline {
  stage: string;
  startDate: string;
  endDate: string;
  minutes: number;
  offset: number;
  width: number;
}

export interface SleepHeartRatePoint {
  time: string;
  value: number;
  offset: number;
}

export interface SleepSummary {
  score: number | null;
  timeAsleepHours: number;
  timeInBedHours: number;
  efficiency: number;
  wentToSleepAt: string;
  wokeUpAt: string;
  sleepHeartRate: number | null;
  respiratoryRate: number | null;
  stages: SleepStageSummary[];
  timeline: SleepStageTimeline[];
  heartRateTimeline: SleepHeartRatePoint[];
}

export interface SleepSummaryResult extends HealthConnectAccessResult {
  summary?: SleepSummary | null;
}

export interface ReadinessInputs {
  sleepHours: number | null;
  sleepEfficiency: number | null;
  sleepScore: number | null;
  restingHr: number | null;
  sleepHeartRate: number | null;
  respiratoryRate: number | null;
  steps: number | null;
  rhrBaseline: number | null;
  sleepHrBaseline: number | null;
  respiratoryRateBaseline: number | null;
}

export function isHealthConnectAvailable() {
  return Capacitor.getPlatform() === 'android';
}

export function calculateReadinessScore(inputs: ReadinessInputs) {
  const sleepHoursScore = inputs.sleepHours === null ? 0 : clamp((inputs.sleepHours / 8) * 18, 0, 18);
  const sleepEfficiencyScore = inputs.sleepEfficiency === null ? 0 : clamp(inputs.sleepEfficiency * 12, 0, 12);
  const sleepScoreScore = inputs.sleepScore === null ? 0 : clamp((inputs.sleepScore / 100) * 22, 0, 22);
  const rhrTarget = inputs.rhrBaseline ?? 60;
  const restingHrScore = inputs.restingHr === null ? 0 : clamp(16 - Math.abs(inputs.restingHr - rhrTarget) * 1.6, 0, 16);
  const sleepHrTarget = inputs.sleepHrBaseline ?? 55;
  const sleepHeartRateScore = inputs.sleepHeartRate === null ? 0 : clamp(12 - Math.abs(inputs.sleepHeartRate - sleepHrTarget) * 0.8, 0, 12);
  const rrTarget = inputs.respiratoryRateBaseline ?? 14.5;
  const respiratoryRateScore = inputs.respiratoryRate === null ? 0 : clamp(8 - Math.abs(inputs.respiratoryRate - rrTarget) * 1.4, 0, 8);

  // Base floor scaled by how many of the 6 scored inputs are present, so a day with
  // little data doesn't get the same +24 floor as a fully-measured day. Full data
  // keeps the original +24 (preserving downstream battery-baseline calibration).
  const scoredInputs = [
    inputs.sleepHours, inputs.sleepEfficiency, inputs.sleepScore,
    inputs.restingHr, inputs.sleepHeartRate, inputs.respiratoryRate,
  ];
  const presentCount = scoredInputs.filter((v) => v !== null).length;
  const base = 24 * (presentCount / scoredInputs.length);

  const score =
    base +
    sleepHoursScore +
    sleepEfficiencyScore +
    sleepScoreScore +
    restingHrScore +
    sleepHeartRateScore +
    respiratoryRateScore;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function applyReadinessDrain(baseScore: number, currentDate = new Date()) {
  const start = new Date(currentDate);
  start.setHours(6, 0, 0, 0);

  const maxDrain = 35;
  const drainWindowHours = 16;

  if (currentDate <= start) {
    return baseScore;
  }

  const elapsedHours = (currentDate.getTime() - start.getTime()) / (1000 * 60 * 60);
  const drain = Math.min(maxDrain, (elapsedHours / drainWindowHours) * maxDrain);

  return Math.max(0, Math.round(baseScore - drain));
}


function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function hoursBetween(startDate: string, endDate: string) {
  return Math.max(0, (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60));
}

function sumStageMinutes(sample: HealthSample) {
  const stages = sample.stages ?? [];
  const sleepStages = stages.filter((stage) => stage.stage !== 'awake' && stage.stage !== 'inBed');
  const totalMinutes = sleepStages.reduce((sum, stage) => sum + stage.durationMinutes, 0);
  const stageSummaries = stages.reduce<Record<string, number>>((acc, stage) => {
    acc[stage.stage] = (acc[stage.stage] ?? 0) + stage.durationMinutes;
    return acc;
  }, {});

  return {
    totalMinutes,
    stageSummaries,
  };
}

function buildSleepTimeline(sample: HealthSample) {
  const stages = sample.stages ?? [];
  const windowStart = new Date(sample.startDate).getTime();
  const windowEnd = new Date(sample.endDate).getTime();
  const windowMinutes = Math.max(1, (windowEnd - windowStart) / (1000 * 60));

  return stages
    .map((stage) => {
      const start = new Date(stage.startDate).getTime();
      const offset = clamp(((start - windowStart) / (1000 * 60 * windowMinutes)) * 100, 0, 100);
      const width = clamp(Math.min((stage.durationMinutes / windowMinutes) * 100, 100 - offset), 0, 100);

      return {
        stage: stage.stage,
        startDate: stage.startDate,
        endDate: stage.endDate,
        minutes: stage.durationMinutes,
        offset,
        width,
      } satisfies SleepStageTimeline;
    })
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
}

function buildSleepSummary(
  sample: HealthSample,
  sleepHeartRate: number | null,
  respiratoryRate: number | null,
  options: {
    targetSleepHours?: number;
    timingVarianceMinutes?: number | null;
    respiratoryRateBaseline?: number | null;
  } = {}
) {
  const timeInBedHours = hoursBetween(sample.startDate, sample.endDate);
  const { totalMinutes, stageSummaries } = sumStageMinutes(sample);
  const timeAsleepHours = totalMinutes > 0 ? totalMinutes / 60 : timeInBedHours;
  const efficiency = timeInBedHours > 0 ? timeAsleepHours / timeInBedHours : 0;

  const stages: SleepStageSummary[] = Object.entries(stageSummaries)
    .map(([stage, minutes]) => ({
      stage,
      minutes,
      share: totalMinutes > 0 ? minutes / totalMinutes : 0,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  const sleepOnlyMinutes = stages
    .filter((s) => s.stage !== 'awake' && s.stage !== 'inBed')
    .reduce((sum, s) => sum + s.minutes, 0);

  const hasStages = sleepOnlyMinutes > 0;
  const deepPct = hasStages ? (stageSummaries['deep'] ?? 0) / sleepOnlyMinutes : null;
  const remPct = hasStages ? (stageSummaries['rem'] ?? 0) / sleepOnlyMinutes : null;
  const wasoMinutes = hasStages ? (stageSummaries['awake'] ?? 0) : null;

  return {
    timeInBedHours,
    timeAsleepHours,
    efficiency,
    stages,
    timeline: buildSleepTimeline(sample),
    heartRateTimeline: [],
    score: calculateSleepScore({
      timeAsleepHours,
      targetSleepHours: options.targetSleepHours ?? getSleepGoalHours(),
      efficiency,
      deepPct,
      remPct,
      timingVarianceMinutes: options.timingVarianceMinutes ?? null,
      respiratoryRate,
      respiratoryRateBaseline: options.respiratoryRateBaseline ?? null,
      wasoMinutes,
    }),
  };
}

interface SleepScoreInputs {
  timeAsleepHours: number;
  targetSleepHours: number;
  efficiency: number;                       // 0–1
  deepPct: number | null;                   // fraction of sleep time (0–1)
  remPct: number | null;                    // fraction of sleep time (0–1)
  timingVarianceMinutes: number | null;     // deviation from rolling bedtime mean
  respiratoryRate: number | null;
  respiratoryRateBaseline: number | null;   // rolling personal mean
  wasoMinutes: number | null;               // wake-after-sleep-onset minutes; null = no stage data
}

function calculateSleepScore(inputs: SleepScoreInputs): number | null {
  if (inputs.timeAsleepHours < 1) return null;

  // Duration vs user target: 25 pts
  const durationScore = clamp((inputs.timeAsleepHours / inputs.targetSleepHours) * 25, 0, 25);

  // Sleep efficiency: 15 pts
  const efficiencyScore = clamp(inputs.efficiency * 15, 0, 15);

  // WASO: 10 pts (full ≤10 min, 0 at ≥40 min). No stage data = neutral half-credit
  // so a device without sleep staging degrades gracefully instead of capping ~70.
  const wasoScore = inputs.wasoMinutes === null
    ? 5
    : clamp(10 - Math.max(0, inputs.wasoMinutes - 10) / 3, 0, 10);

  // Stage composition — deep: 10 pts (≥18%), REM: 12.5 pts (≥22%).
  // No stage data = neutral half-credit (5 / 6.25), not 0.
  const hasStageData = inputs.deepPct !== null || inputs.remPct !== null;
  const deepScore = inputs.deepPct === null
    ? (hasStageData ? 0 : 5)
    : clamp((inputs.deepPct / 0.18) * 10, 0, 10);
  const remScore = inputs.remPct === null
    ? (hasStageData ? 0 : 6.25)
    : clamp((inputs.remPct / 0.22) * 12.5, 0, 12.5);

  // Bedtime timing consistency: 15 pts (0 pts at ≥45 min variance)
  const timingScore = inputs.timingVarianceMinutes === null
    ? 7.5
    : clamp(15 - (inputs.timingVarianceMinutes / 45) * 15, 0, 15);

  // Respiratory deviation from personal baseline: 12.5 pts (0 pts at ≥3 bpm deviation)
  const respiratoryScore =
    inputs.respiratoryRate === null || inputs.respiratoryRateBaseline === null
      ? 6.25
      : clamp(12.5 - (Math.abs(inputs.respiratoryRate - inputs.respiratoryRateBaseline) / 3) * 12.5, 0, 12.5);

  return Math.min(100, Math.round(durationScore + efficiencyScore + wasoScore + deepScore + remScore + timingScore + respiratoryScore));
}

function toDateKey(date: string): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// When a day bucket holds multiple sleep samples (naps / split sessions), the
// main overnight sleep is the one with the most time asleep — not necessarily the
// last-recorded one. Picking by duration avoids a short nap overriding it.
function pickPrimarySleepSample(samples: HealthSample[]): HealthSample | null {
  if (!samples.length) return null;
  return samples.reduce((best, s) =>
    (getSleepHours(s) ?? 0) > (getSleepHours(best) ?? 0) ? s : best
  );
}

function getSleepHours(sample: HealthSample) {
  if (sample.stages?.length) {
    // Time actually asleep — exclude awake/inBed so this matches sumStageMinutes
    // (which feeds timeAsleepHours). Summing all stages overcounts as time-in-bed.
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

async function ensureAvailability() {
  const availability = await Health.isAvailable();

  if (!availability.available) {
    return {
      available: false,
      granted: false,
      reason: availability.reason ?? 'Health Connect is unavailable on this device.',
    } satisfies HealthConnectAccessResult;
  }

  return {
    available: true,
    granted: false,
  } satisfies HealthConnectAccessResult;
}

export async function requestHealthConnectPermissions(): Promise<HealthConnectAccessResult> {
  if (!isHealthConnectAvailable()) {
    return {
      available: false,
      granted: false,
      reason: 'Health Connect is only available on Android builds.',
    };
  }

  const availability = await ensureAvailability();
  if (!availability.available) {
    return availability;
  }

  const status = await Health.requestAuthorization({
    read: HEALTH_CONNECT_READ_TYPES,
  });

  const granted = hasCoreReadAccess(status.readAuthorized);

  return {
    available: true,
    granted,
    status,
  };
}

export async function openHealthConnectSettings() {
  if (!isHealthConnectAvailable()) {
    return;
  }

  await Health.openHealthConnectSettings();
}

export async function canAutoSyncHealthConnectMetrics() {
  if (!isHealthConnectAvailable()) {
    return false;
  }

  // Any native rejection (e.g. corrupted Health Connect / Play Services auth state)
  // must resolve to "cannot sync" — never propagate and risk killing startup.
  try {
    const availability = await ensureAvailability();
    if (!availability.available) {
      return false;
    }

    const auth = await Health.checkAuthorization({
      read: HEALTH_CONNECT_READ_TYPES,
    });

    return hasCoreReadAccess(auth.readAuthorized);
  } catch (error) {
    console.error('Health Connect authorization check failed:', error);
    return false;
  }
}

export interface HealthConnectExerciseAccess {
  available: boolean;
  coreGranted: boolean;
  exerciseGranted: boolean;
}

// The @capgo/capacitor-health plugin declares READ_EXERCISE and reads
// ExerciseSessionRecord internally. After any Health Connect permission reset
// this 'workouts' permission is often ungranted, which can trigger a native
// SecurityException that kills the process during a read. We can't stop the
// plugin's internal read, but we CAN detect the missing grant and prompt the
// user to fix it before it bites. Returns coreGranted so callers can avoid
// nagging users who haven't connected Health Connect at all yet.
export async function checkHealthConnectExerciseAccess(): Promise<HealthConnectExerciseAccess> {
  const fallback: HealthConnectExerciseAccess = { available: false, coreGranted: false, exerciseGranted: false };
  if (!isHealthConnectAvailable()) return fallback;

  try {
    const availability = await ensureAvailability();
    if (!availability.available) return fallback;

    const auth = await Health.checkAuthorization({ read: HEALTH_CONNECT_READ_TYPES });
    return {
      available: true,
      coreGranted: hasCoreReadAccess(auth.readAuthorized),
      exerciseGranted: auth.readAuthorized.includes('workouts'),
    };
  } catch (error) {
    console.error('Health Connect exercise authorization check failed:', error);
    return fallback;
  }
}

export async function getLatestSleepSummary(daysBack = 14): Promise<SleepSummaryResult> {
  if (!isHealthConnectAvailable()) {
    return {
      available: false,
      granted: false,
      reason: 'Health Connect is only available on Android builds.',
      summary: null,
    };
  }

  const availability = await ensureAvailability();
  if (!availability.available) {
    return {
      ...availability,
      summary: null,
    };
  }

  const auth = await Health.checkAuthorization({
    read: HEALTH_CONNECT_READ_TYPES,
  });
  const granted = hasCoreReadAccess(auth.readAuthorized);

  if (!granted) {
    return {
      available: true,
      granted: false,
      summary: null,
    };
  }

  const endDate = new Date().toISOString();
  const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  const sleepResult = await Health.readSamples({
    dataType: 'sleep',
    startDate,
    endDate,
    limit: 50,
    ascending: false,
  });

  const session = sleepResult.samples[0];
  if (!session) {
    return {
      available: true,
      granted: true,
      summary: null,
    };
  }

  const [sleepHeartRateResult, respiratoryRateResult] = await Promise.all([
    Health.readSamples({
      dataType: 'heartRate',
      startDate: session.startDate,
      endDate: session.endDate,
      limit: 1000,
      ascending: true,
    }),
    Health.readSamples({
      dataType: 'respiratoryRate',
      startDate: session.startDate,
      endDate: session.endDate,
      limit: 1000,
      ascending: true,
    }),
  ]);

  const sleepHeartRate = average(sleepHeartRateResult.samples.map((sample) => sample.value));
  const respiratoryRate = average(respiratoryRateResult.samples.map((sample) => sample.value));
  const sleepWindowStart = new Date(session.startDate).getTime();
  const sleepWindowEnd = new Date(session.endDate).getTime();
  const sleepWindowSpan = Math.max(1, sleepWindowEnd - sleepWindowStart);
  const heartRateTimeline: SleepHeartRatePoint[] = sleepHeartRateResult.samples
    .map((sample) => {
      const time = new Date(sample.startDate).getTime();
      return {
        time: sample.startDate,
        value: sample.value,
        offset: clamp(((time - sleepWindowStart) / sleepWindowSpan) * 100, 0, 100),
      };
    })
    .filter((sample) => Number.isFinite(sample.value))
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const sleepSummary = buildSleepSummary(
    session,
    sleepHeartRate,
    respiratoryRate
  );
  const summary: SleepSummary = {
    ...sleepSummary,
    heartRateTimeline,
    wentToSleepAt: session.startDate,
    wokeUpAt: session.endDate,
    sleepHeartRate: sleepHeartRate === null ? null : Math.round(sleepHeartRate),
    respiratoryRate: respiratoryRate === null ? null : Number(respiratoryRate.toFixed(1)),
  };

  return {
    available: true,
    granted: true,
    summary,
  };
}

export async function syncHealthConnectMetrics(daysBack = 30): Promise<HealthConnectSyncResult> {
  if (!isHealthConnectAvailable()) {
    return { available: false, granted: false, synced: 0 };
  }

  const availability = await ensureAvailability();
  if (!availability.available) {
    return { available: false, granted: false, synced: 0 };
  }

  const auth = await Health.checkAuthorization({
    read: HEALTH_CONNECT_READ_TYPES,
  });

  const granted = hasCoreReadAccess(auth.readAuthorized);
  if (!granted) {
    return { available: true, granted: false, synced: 0 };
  }

  const endDate = new Date().toISOString();
  const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
  // Continuous HR is recorded per-minute by the Amazfit (~1440/day).
  // 30 days = ~43k samples — far over any 1000-sample limit.
  // Use a 7-day window newest-first so recent days are always in the result set.
  const recentStartDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [stepsResult, sleepResult, restingHeartRateResult, heartRateResult, respiratoryRateResult] = await Promise.all([
    // queryAggregated returns one pre-summed total per day — avoids overcounting
    // that happens when per-minute delta samples are manually summed.
    // .catch guards against native bridge errors on APKs built before queryAggregated
    // was available — a missing native method bypasses JS try/catch on Capacitor Android.
    Health.queryAggregated({
      dataType: 'steps',
      startDate: recentStartDate,
      endDate,
      bucket: 'day',
      aggregation: 'sum',
    }).catch(() => ({ samples: [] as import('@capgo/capacitor-health').AggregatedSample[] })),
    Health.readSamples({
      dataType: 'sleep',
      startDate,
      endDate,
      limit: 1000,
      ascending: true,
    }),
    // queryAggregated with min matches the resting HR shown in Health Connect.
    Health.queryAggregated({
      dataType: 'restingHeartRate',
      startDate,
      endDate,
      bucket: 'day',
      aggregation: 'min',
    }).catch(() => ({ samples: [] as import('@capgo/capacitor-health').AggregatedSample[] })),
    Health.readSamples({
      dataType: 'heartRate',
      startDate: recentStartDate,
      endDate,
      limit: 5000,
      ascending: false,
    }),
    Health.readSamples({
      dataType: 'respiratoryRate',
      startDate,
      endDate,
      limit: 1000,
      ascending: true,
    }),
  ]);

  const stepsByDate = new Map<string, number>();
  for (const sample of (stepsResult as { samples: AggregatedSample[] }).samples) {
    if (!Number.isFinite(sample.value) || sample.value <= 0) continue;
    const key = toDateKey(sample.startDate);
    stepsByDate.set(key, sample.value);
  }

  const sleepByDate = new Map<string, { samples: HealthSample[] }>();
  for (const sample of sleepResult.samples) {
    const sleepHours = getSleepHours(sample);
    if (sleepHours === null) continue;

    const key = toDateKey(sample.endDate || sample.startDate);
    const bucket = sleepByDate.get(key) ?? { samples: [] };
    bucket.samples.push(sample);
    sleepByDate.set(key, bucket);
  }

  // All HR samples sorted chronologically. Sleep HR is computed from the samples that
  // fall WITHIN each night's sleep window (bedtime→waketime) rather than bucketed by
  // calendar day: an overnight session straddles midnight, so date-bucketing split the
  // night's HR across two days and left the wake-up day with only the post-midnight
  // (and daytime-polluted) portion. Window matching fixes same-day sleep-HR sync.
  const heartRateSamples = heartRateResult.samples
    .filter((sample) => Number.isFinite(sample.value))
    .map((sample) => ({ time: new Date(sample.startDate).getTime(), value: sample.value, startDate: sample.startDate }))
    .filter((sample) => Number.isFinite(sample.time))
    .sort((a, b) => a.time - b.time);

  const sleepWindowHeartRate = (sample: HealthSample) => {
    const startMs = new Date(sample.startDate).getTime();
    const endMs = new Date(sample.endDate).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return [];
    return heartRateSamples.filter((s) => s.time >= startMs && s.time <= endMs);
  };

  const restingHeartRateByDate = new Map<string, number>();
  for (const sample of (restingHeartRateResult as { samples: AggregatedSample[] }).samples) {
    if (!Number.isFinite(sample.value) || sample.value <= 0) continue;
    const key = toDateKey(sample.startDate);
    restingHeartRateByDate.set(key, Math.round(sample.value));
  }

  const respiratoryRateByDate = new Map<string, { values: number[] }>();
  for (const sample of respiratoryRateResult.samples) {
    if (!Number.isFinite(sample.value)) continue;

    const key = toDateKey(sample.startDate || sample.endDate);
    const bucket = respiratoryRateByDate.get(key) ?? { values: [] };
    bucket.values.push(sample.value);
    respiratoryRateByDate.set(key, bucket);
  }

  let synced = 0;

  for (const [date, steps] of stepsByDate.entries()) {
    try {
      await replaceHealthMetric(date, 'steps', Math.round(steps), 'count', HEALTH_CONNECT_SOURCE);
      synced += 1;
    } catch (e) {
      console.error(`[healthConnect] Steps sync failed for ${date}:`, e);
    }
  }

  // Process sleep in chronological order so rolling baselines accumulate correctly
  const sortedSleepEntries = [...sleepByDate.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const rollingBedtimeMinutes: number[] = [];
  const rollingRespRates: number[] = [];
  const ROLLING_WINDOW = 14;

  // Seed rolling baselines from sleep sessions persisted before this window so the
  // first nights in the window are scored against real history, not null baselines.
  const earliestSleepDate = sortedSleepEntries[0]?.[0];
  if (earliestSleepDate) {
    const priorSessions = await getSleepSessionsBefore(earliestSleepDate, ROLLING_WINDOW);
    for (const s of [...priorSessions].reverse()) { // chronological (oldest first)
      const bm = new Date(s.bedtime);
      if (!isNaN(bm.getTime())) rollingBedtimeMinutes.push(bm.getHours() * 60 + bm.getMinutes());
      if (s.respiratory_rate !== null) rollingRespRates.push(s.respiratory_rate);
    }
  }

  for (const [date, bucket] of sortedSleepEntries) {
    const latestSample = pickPrimarySleepSample(bucket.samples);
    // Skip nights where sleep duration can't be determined (unparseable dates,
    // no stages) — otherwise we'd persist a bogus 0-hour sleep_duration metric.
    if (!latestSample || getSleepHours(latestSample) === null) continue;

    const sleepHrSamples = sleepWindowHeartRate(latestSample);
    const sleepHeartRate = average(sleepHrSamples.map((s) => s.value));
    const respiratoryRate = average(respiratoryRateByDate.get(date)?.values ?? []);

    // Bedtime in minutes since midnight, handling overnight sessions (e.g. 23:00)
    const bedtimeDate = new Date(latestSample.startDate);
    const bedtimeMinutes = bedtimeDate.getHours() * 60 + bedtimeDate.getMinutes();

    // Timing variance: deviation from rolling mean of prior bedtimes
    let timingVarianceMinutes: number | null = null;
    if (rollingBedtimeMinutes.length >= 3) {
      const window = rollingBedtimeMinutes.slice(-ROLLING_WINDOW);
      const mean = window.reduce((s, v) => s + v, 0) / window.length;
      let diff = Math.abs(bedtimeMinutes - mean);
      // Wrap-around: 23:50 vs 00:10 should be 20 min apart, not 1420
      if (diff > 720) diff = 1440 - diff;
      timingVarianceMinutes = diff;
    }

    // Respiratory baseline: rolling mean of prior nights
    let respiratoryRateBaseline: number | null = null;
    if (rollingRespRates.length >= 3) {
      const window = rollingRespRates.slice(-ROLLING_WINDOW);
      respiratoryRateBaseline = window.reduce((s, v) => s + v, 0) / window.length;
    }

    const sleepSummary = buildSleepSummary(latestSample, sleepHeartRate, respiratoryRate, {
      timingVarianceMinutes,
      respiratoryRateBaseline,
    });

    // Update rolling state AFTER scoring so current night doesn't influence its own baseline
    rollingBedtimeMinutes.push(bedtimeMinutes);
    if (respiratoryRate !== null) rollingRespRates.push(respiratoryRate);

    try {
      await replaceHealthMetric(date, 'sleep_duration', Number(sleepSummary.timeAsleepHours.toFixed(2)), 'hours', HEALTH_CONNECT_SOURCE);
      synced += 1;
      await replaceHealthMetric(date, 'sleep_time_in_bed', Number(sleepSummary.timeInBedHours.toFixed(2)), 'hours', HEALTH_CONNECT_SOURCE);
      synced += 1;
      await replaceHealthMetric(date, 'sleep_efficiency', Number((sleepSummary.efficiency * 100).toFixed(0)), 'percent', HEALTH_CONNECT_SOURCE);
      synced += 1;
      if (sleepSummary.score !== null) {
        await replaceHealthMetric(date, 'sleep_score', sleepSummary.score, 'score', HEALTH_CONNECT_SOURCE);
        synced += 1;
      }

      for (const stage of sleepSummary.stages) {
        await replaceHealthMetric(date, `sleep_stage_${stage.stage}`, Number(stage.minutes.toFixed(0)), 'minutes', HEALTH_CONNECT_SOURCE);
        synced += 1;
      }

      if (sleepHeartRate !== null) {
        await replaceHealthMetric(date, 'sleep_heart_rate', Math.round(sleepHeartRate), 'bpm', HEALTH_CONNECT_SOURCE);
        synced += 1;
      }

      // Build compact HR timeline for session storage
      const windowStart = new Date(latestSample.startDate).getTime();
      const windowEnd = new Date(latestSample.endDate).getTime();
      const windowSpan = Math.max(1, windowEnd - windowStart);
      const hrTimelineJson = sleepHrSamples.length
        ? JSON.stringify(
            sleepHrSamples
              .map((s) => ({
                t: s.startDate,
                v: Math.round(s.value),
                o: Math.round(clamp(((s.time - windowStart) / windowSpan) * 100, 0, 100)),
              }))
              .sort((a, b) => a.t.localeCompare(b.t))
          )
        : null;

      const rawStages = latestSample.stages ?? [];
      const stageTimelineJson = rawStages.length
        ? JSON.stringify(
            rawStages.map((s) => ({
              s: s.stage,
              start: s.startDate,
              end: s.endDate,
              dur: s.durationMinutes,
            }))
          )
        : null;

      const stageMin = (name: string) =>
        rawStages.filter((s) => s.stage === name).reduce((sum, s) => sum + s.durationMinutes, 0);

      await upsertSleepSession({
        date,
        bedtime: latestSample.startDate,
        waketime: latestSample.endDate,
        time_asleep_hours: Number(sleepSummary.timeAsleepHours.toFixed(3)),
        time_in_bed_hours: Number(sleepSummary.timeInBedHours.toFixed(3)),
        efficiency: sleepSummary.efficiency,
        score: sleepSummary.score,
        sleep_hr: sleepHeartRate !== null ? Math.round(sleepHeartRate) : null,
        respiratory_rate: respiratoryRate !== null ? Number(respiratoryRate.toFixed(1)) : null,
        stage_deep_min: stageMin('deep'),
        stage_light_min: stageMin('light'),
        stage_rem_min: stageMin('rem'),
        stage_awake_min: stageMin('awake'),
        stage_asleep_min: stageMin('asleep'),
        hr_timeline_json: hrTimelineJson,
        stage_timeline_json: stageTimelineJson,
      });
    } catch (e) {
      console.error(`[healthConnect] Sleep sync failed for ${date}:`, e);
    }
  }

  for (const [date, restingHr] of restingHeartRateByDate.entries()) {
    try {
      await replaceHealthMetric(date, 'resting_heart_rate', restingHr, 'bpm', HEALTH_CONNECT_SOURCE);
      synced += 1;
    } catch (e) {
      console.error(`[healthConnect] Resting HR sync failed for ${date}:`, e);
    }
  }

  for (const [date, bucket] of respiratoryRateByDate.entries()) {
    const respiratoryRate = average(bucket.values);
    if (respiratoryRate === null) continue;
    try {
      await replaceHealthMetric(date, 'respiratory_rate', Number(respiratoryRate.toFixed(1)), 'rpm', HEALTH_CONNECT_SOURCE);
      synced += 1;
    } catch (e) {
      console.error(`[healthConnect] Respiratory rate sync failed for ${date}:`, e);
    }
  }

  const BASELINE_WINDOW = 14;
  const rollingRhrValues: number[] = [];
  const rollingSleepHrValues: number[] = [];
  const rollingRespRateValues: number[] = [];

  const readinessDates = new Set(
    [...sleepByDate.keys(), ...restingHeartRateByDate.keys()].sort()
  );

  // Seed readiness baselines from history persisted before this window.
  const earliestReadinessDate = [...readinessDates][0];
  if (earliestReadinessDate) {
    const [priorRhr, priorSessionsForReadiness] = await Promise.all([
      getHealthMetricValuesBefore('resting_heart_rate', earliestReadinessDate, BASELINE_WINDOW),
      getSleepSessionsBefore(earliestReadinessDate, BASELINE_WINDOW),
    ]);
    for (const v of [...priorRhr].reverse()) rollingRhrValues.push(v);
    for (const s of [...priorSessionsForReadiness].reverse()) {
      if (s.sleep_hr !== null) rollingSleepHrValues.push(s.sleep_hr);
      if (s.respiratory_rate !== null) rollingRespRateValues.push(s.respiratory_rate);
    }
  }
  for (const date of readinessDates) {
    const sleepBucket = sleepByDate.get(date);
    const latestSample = pickPrimarySleepSample(sleepBucket?.samples ?? []);
    const sleepHours = average(
      (sleepBucket?.samples ?? []).map((sample) => getSleepHours(sample)).filter((value): value is number => value !== null)
    );
    const restingHr = restingHeartRateByDate.get(date) ?? null;
    const sleepHeartRate = latestSample ? average(sleepWindowHeartRate(latestSample).map((s) => s.value)) : null;
    const respiratoryRate = average(respiratoryRateByDate.get(date)?.values ?? []);
    const sleepSummary = latestSample ? buildSleepSummary(latestSample, sleepHeartRate, respiratoryRate) : null;

    if (sleepHours === null && restingHr === null && sleepSummary === null) {
      continue;
    }

    // Compute prior-N-night baselines before pushing today's values
    const rhrBaseline = rollingRhrValues.length >= 3
      ? rollingRhrValues.slice(-BASELINE_WINDOW).reduce((s, v) => s + v, 0) / Math.min(rollingRhrValues.length, BASELINE_WINDOW)
      : null;
    const sleepHrBaseline = rollingSleepHrValues.length >= 3
      ? rollingSleepHrValues.slice(-BASELINE_WINDOW).reduce((s, v) => s + v, 0) / Math.min(rollingSleepHrValues.length, BASELINE_WINDOW)
      : null;
    const rrBaseline = rollingRespRateValues.length >= 3
      ? rollingRespRateValues.slice(-BASELINE_WINDOW).reduce((s, v) => s + v, 0) / Math.min(rollingRespRateValues.length, BASELINE_WINDOW)
      : null;

    if (restingHr !== null) rollingRhrValues.push(restingHr);
    if (sleepHeartRate !== null) rollingSleepHrValues.push(sleepHeartRate);
    if (respiratoryRate !== null) rollingRespRateValues.push(respiratoryRate);

    const readinessInputs = {
      sleepHours: sleepSummary?.timeAsleepHours ?? sleepHours,
      sleepEfficiency: sleepSummary?.efficiency ?? null,
      sleepScore: sleepSummary?.score ?? null,
      restingHr,
      sleepHeartRate,
      respiratoryRate,
      steps: stepsByDate.get(date) ?? null,
      rhrBaseline,
      sleepHrBaseline,
      respiratoryRateBaseline: rrBaseline,
    };

    await upsertReadinessScore(date, calculateReadinessScore(readinessInputs), {
      ...readinessInputs,
      source: HEALTH_CONNECT_SOURCE,
    });
  }

  return {
    available: true,
    granted: true,
    synced,
  };
}

export interface BatteryDrains {
  time: number;
  workout: number;
  activity: number;
  event: number;
  circadian: number;
}

export interface BatteryResult {
  score: number;
  baseline: number;
  drains: BatteryDrains;
  readyToTrain: boolean;
  readyToStudy: boolean;
  status: 'Peak' | 'Good' | 'Low' | 'Recharge';
}

export function calculateBattery(
  baseline: number,
  now: Date,
  workouts: { time_start: string; time_end: string; total_kg: number | null }[],
  activities: ActivitySummary[],
  events: { type: string; date: string; time_start: string | null; time_end: string | null }[],
  circadianScore: number | null = null
): BatteryResult {
  // Circadian modifier: irregular rhythm reduces effective baseline by up to 10%
  // (score 0 → ×0.90, score 100 → ×1.00). Matches the documented 0.90–1.00 range.
  const circMod = circadianScore !== null ? (0.90 + 0.10 * circadianScore / 100) : 1.0;
  const adjustedBaseline = Math.round(clamp(baseline * circMod, 0, 100));
  const circadianDrain = Math.round(baseline - adjustedBaseline);

  // 1. Time drain — gradual fatigue through the day
  const timeDrain = Math.max(0, adjustedBaseline - applyReadinessDrain(adjustedBaseline, now));

  // 2. Workout drain — gym sessions completed today
  const workoutDrain = clamp(
    workouts.reduce((sum, w) => {
      const startMs = new Date(w.time_start).getTime();
      const endMs = new Date(w.time_end).getTime();
      // Malformed/missing timestamps must degrade to 0 duration, not NaN.
      const durationMins = Number.isFinite(startMs) && Number.isFinite(endMs)
        ? Math.max(0, (endMs - startMs) / 60000)
        : 0;
      const fromDuration = clamp(durationMins / 3, 0, 20);
      const fromVolume = clamp((w.total_kg ?? 0) / 200, 0, 15);
      return sum + fromDuration + fromVolume;
    }, 0),
    0, 35
  );

  // 3. Activity drain — Health Connect workouts today
  const todayStr = toDateKey(now.toISOString());
  const todayActivities = activities.filter((a) => toDateKey(a.startDate) === todayStr);
  const activityDrain = clamp(
    todayActivities.reduce((sum, a) => {
      const fromDuration = clamp(a.durationMinutes / 3, 0, 20);
      const fromCalories = a.calories ? clamp(a.calories / 50, 0, 20) : 0;
      return sum + Math.max(fromDuration, fromCalories);
    }, 0),
    0, 30
  );

  // 4. Event drain — calendar events that have already started.
  // Anchor the window to TODAY (recurring events carry their original past date,
  // so using e.date would always count the full historical duration regardless of
  // how much of today's occurrence has actually elapsed).
  const eventDrain = clamp(
    events.reduce((sum, e) => {
      if (!e.time_start) return sum;
      const start = new Date(`${todayStr}T${e.time_start}`);
      if (start > now) return sum; // future event, no drain yet
      let endTime = e.time_end ? new Date(`${todayStr}T${e.time_end}`) : new Date(start.getTime() + 3600000);
      // Overnight window (e.g. sleep 23:00→07:00): end rolls into the next day.
      if (endTime.getTime() <= start.getTime()) endTime = new Date(endTime.getTime() + 24 * 3600000);
      const durationHours = Math.max(0, (Math.min(endTime.getTime(), now.getTime()) - start.getTime()) / 3600000);
      const drainPerHour =
        e.type === 'sleep'    ? -5 :
        e.type === 'recovery' ? -2 :
        e.type === 'workout'  ?  6 :
        e.type === 'school'   ?  2 :
        e.type === 'reminder' ?  0 : 4;
      return sum + clamp(durationHours * drainPerHour, -5, 15);
    }, 0),
    -20, 25
  );

  const effectiveActivityDrain = workoutDrain > 0 ? 0 : activityDrain;
  const score = clamp(Math.round(adjustedBaseline - timeDrain - workoutDrain - effectiveActivityDrain - eventDrain), 0, 100);

  return {
    score,
    baseline: adjustedBaseline,
    drains: {
      time: Math.round(timeDrain),
      workout: Math.round(workoutDrain),
      activity: Math.round(effectiveActivityDrain),
      event: Math.round(eventDrain),
      circadian: circadianDrain,
    },
    readyToTrain: score >= 60,
    readyToStudy: score >= 40,
    status: score >= 70 ? 'Peak' : score >= 55 ? 'Good' : score >= 35 ? 'Low' : 'Recharge',
  };
}

export interface ActivitySummary {
  workoutType: string;
  startDate: string;
  endDate: string;
  durationMinutes: number;
  calories: number | null;
  distanceKm: number | null;
  sourceName: string | null;
}

export async function getRecentActivities(daysBack = 7): Promise<ActivitySummary[]> {
  if (!isHealthConnectAvailable()) return [];

  try {
    const endDate = new Date().toISOString();
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
    const result = await Health.queryWorkouts({ startDate, endDate, limit: 50, ascending: false });

    return result.workouts.map((w: HCWorkout) => ({
      workoutType: w.workoutType,
      startDate: w.startDate,
      endDate: w.endDate,
      durationMinutes: Math.round(w.duration / 60),
      calories: w.totalEnergyBurned != null ? Math.round(w.totalEnergyBurned) : null,
      distanceKm: w.totalDistance != null ? Math.round(w.totalDistance / 100) / 10 : null,
      sourceName: w.sourceName ?? null,
    }));
  } catch {
    return [];
  }
}
