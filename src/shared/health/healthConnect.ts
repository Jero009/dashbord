import { Capacitor } from '@capacitor/core';
import { Health, type AuthorizationStatus, type HealthSample, type Workout as HCWorkout } from '@capgo/capacitor-health';
import { replaceHealthMetric, upsertReadinessScore, upsertSleepSession } from '@/shared/db/app_db';

export type HealthMetricType =
  | 'steps'
  | 'sleep_duration'
  | 'sleep_time_in_bed'
  | 'sleep_efficiency'
  | 'sleep_score'
  | 'sleep_heart_rate'
  | 'respiratory_rate'
  | 'resting_heart_rate';

type HealthConnectDataType = 'steps' | 'sleep' | 'restingHeartRate' | 'heartRate' | 'respiratoryRate' | 'workouts';

const HEALTH_CONNECT_READ_TYPES: HealthConnectDataType[] = ['steps', 'sleep', 'restingHeartRate', 'heartRate', 'respiratoryRate', 'workouts'];
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
  score: number;
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
}

export function isHealthConnectAvailable() {
  return Capacitor.getPlatform() === 'android';
}

export function calculateReadinessScore(inputs: ReadinessInputs) {
  const sleepHoursScore = inputs.sleepHours === null ? 0 : clamp((inputs.sleepHours / 8) * 18, 0, 18);
  const sleepEfficiencyScore = inputs.sleepEfficiency === null ? 0 : clamp(inputs.sleepEfficiency * 12, 0, 12);
  const sleepScoreScore = inputs.sleepScore === null ? 0 : clamp((inputs.sleepScore / 100) * 22, 0, 22);
  const restingHrScore = inputs.restingHr === null ? 6 : clamp(16 - Math.abs(inputs.restingHr - 60) * 1.2, 0, 16);
  const sleepHeartRateScore = inputs.sleepHeartRate === null ? 4 : clamp(12 - Math.abs(inputs.sleepHeartRate - 55) * 0.8, 0, 12);
  const respiratoryRateScore = inputs.respiratoryRate === null ? 3 : clamp(8 - Math.abs(inputs.respiratoryRate - 14.5) * 1.4, 0, 8);
  const stepPenalty = inputs.steps === null ? 0 : clamp((inputs.steps - 10000) / 1500, 0, 10);

  const score =
    24 +
    sleepHoursScore +
    sleepEfficiencyScore +
    sleepScoreScore +
    restingHrScore +
    sleepHeartRateScore +
    respiratoryRateScore -
    stepPenalty;

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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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

  return {
    timeInBedHours,
    timeAsleepHours,
    efficiency,
    stages,
    timeline: buildSleepTimeline(sample),
    heartRateTimeline: [],
    score: calculateSleepScore({
      timeAsleepHours,
      targetSleepHours: options.targetSleepHours ?? 8.0,
      efficiency,
      deepPct,
      remPct,
      timingVarianceMinutes: options.timingVarianceMinutes ?? null,
      respiratoryRate,
      respiratoryRateBaseline: options.respiratoryRateBaseline ?? null,
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
}

function calculateSleepScore(inputs: SleepScoreInputs): number {
  // Duration vs user target: 25 pts
  const durationScore = clamp((inputs.timeAsleepHours / inputs.targetSleepHours) * 25, 0, 25);

  // Sleep efficiency: 20 pts
  const efficiencyScore = clamp(inputs.efficiency * 20, 0, 20);

  // Stage composition: 12.5 pts each for deep and REM
  // Targets: deep ≥18%, REM ≥22% of total sleep time
  const hasStageData = inputs.deepPct !== null || inputs.remPct !== null;
  const deepScore = !hasStageData ? 6.25
    : inputs.deepPct === null ? 6.25
    : clamp((inputs.deepPct / 0.18) * 12.5, 0, 12.5);
  const remScore = !hasStageData ? 6.25
    : inputs.remPct === null ? 6.25
    : clamp((inputs.remPct / 0.22) * 12.5, 0, 12.5);

  // Bedtime timing consistency: 15 pts (0 pts at ≥60 min variance)
  const timingScore = inputs.timingVarianceMinutes === null
    ? 7.5
    : clamp(15 - (inputs.timingVarianceMinutes / 60) * 15, 0, 15);

  // Respiratory deviation from personal baseline: 15 pts (0 pts at ≥3 bpm deviation)
  const respiratoryScore =
    inputs.respiratoryRate === null || inputs.respiratoryRateBaseline === null
      ? 7.5
      : clamp(15 - (Math.abs(inputs.respiratoryRate - inputs.respiratoryRateBaseline) / 3) * 15, 0, 15);

  return Math.round(durationScore + efficiencyScore + deepScore + remScore + timingScore + respiratoryScore);
}

function toDateKey(date: string) {
  return date.slice(0, 10);
}

function getSleepHours(sample: HealthSample) {
  if (sample.stages?.length) {
    return sample.stages.reduce((sum, stage) => sum + stage.durationMinutes, 0) / 60;
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

  const granted = HEALTH_CONNECT_READ_TYPES.every((type) => status.readAuthorized.includes(type));

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

  const availability = await ensureAvailability();
  if (!availability.available) {
    return false;
  }

  const auth = await Health.checkAuthorization({
    read: HEALTH_CONNECT_READ_TYPES,
  });

  return HEALTH_CONNECT_READ_TYPES.every((type) => auth.readAuthorized.includes(type));
}

export async function readHealthMetrics(_type: HealthMetricType, _startDate: string, _endDate: string) {
  if (!isHealthConnectAvailable()) {
    throw new Error('Health Connect is only available on Android builds.');
  }

  const availability = await ensureAvailability();
  if (!availability.available) {
    throw new Error(availability.reason ?? 'Health Connect is unavailable on this device.');
  }

  const dataType: HealthConnectDataType =
    _type === 'steps'
      ? 'steps'
      : _type === 'resting_heart_rate'
        ? 'restingHeartRate'
        : _type === 'sleep_heart_rate'
          ? 'heartRate'
          : _type === 'respiratory_rate'
            ? 'respiratoryRate'
            : 'sleep';
  const result = await Health.readSamples({
    dataType,
    startDate: _startDate,
    endDate: _endDate,
    limit: 1000,
    ascending: true,
  });

  return result.samples;
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
  const granted = HEALTH_CONNECT_READ_TYPES.every((type) => auth.readAuthorized.includes(type));

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
    return {
      available: false,
      granted: false,
      synced: 0,
    };
  }

  const availability = await ensureAvailability();
  if (!availability.available) {
    return {
      available: false,
      granted: false,
      synced: 0,
    };
  }

  const auth = await Health.checkAuthorization({
    read: HEALTH_CONNECT_READ_TYPES,
  });

  const granted = HEALTH_CONNECT_READ_TYPES.every((type) => auth.readAuthorized.includes(type));
  if (!granted) {
    return {
      available: true,
      granted: false,
      synced: 0,
    };
  }

  const endDate = new Date().toISOString();
  const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  const [stepsResult, sleepResult, restingHeartRateResult, heartRateResult, respiratoryRateResult] = await Promise.all([
    Health.readSamples({
      dataType: 'steps',
      startDate,
      endDate,
      limit: 1000,
      ascending: true,
    }),
    Health.readSamples({
      dataType: 'sleep',
      startDate,
      endDate,
      limit: 1000,
      ascending: true,
    }),
    Health.readSamples({
      dataType: 'restingHeartRate',
      startDate,
      endDate,
      limit: 1000,
      ascending: true,
    }),
    Health.readSamples({
      dataType: 'heartRate',
      startDate,
      endDate,
      limit: 1000,
      ascending: true,
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
  for (const sample of stepsResult.samples) {
    if (!Number.isFinite(sample.value)) continue;

    const key = toDateKey(sample.startDate || sample.endDate);
    stepsByDate.set(key, (stepsByDate.get(key) ?? 0) + sample.value);
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

  const heartRateByDate = new Map<string, { values: number[]; samples: HealthSample[] }>();
  for (const sample of heartRateResult.samples) {
    if (!Number.isFinite(sample.value)) continue;

    const key = toDateKey(sample.startDate || sample.endDate);
    const bucket = heartRateByDate.get(key) ?? { values: [], samples: [] };
    bucket.values.push(sample.value);
    bucket.samples.push(sample);
    heartRateByDate.set(key, bucket);
  }

  const restingHeartRateByDate = new Map<string, { values: number[] }>();
  for (const sample of restingHeartRateResult.samples) {
    if (!Number.isFinite(sample.value)) continue;

    const key = toDateKey(sample.startDate || sample.endDate);
    const bucket = restingHeartRateByDate.get(key) ?? { values: [] };
    bucket.values.push(sample.value);
    restingHeartRateByDate.set(key, bucket);
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

  for (const [date, bucket] of sortedSleepEntries) {
    const latestSample = bucket.samples[bucket.samples.length - 1];
    if (!latestSample) continue;

    const hrBucket = heartRateByDate.get(date);
    const sleepHeartRate = average(hrBucket?.values ?? []);
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
      await replaceHealthMetric(date, 'sleep_score', sleepSummary.score, 'score', HEALTH_CONNECT_SOURCE);
      synced += 1;

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
      const hrTimelineJson = hrBucket?.samples.length
        ? JSON.stringify(
            hrBucket.samples
              .filter((s) => Number.isFinite(s.value))
              .map((s) => ({
                t: s.startDate,
                v: Math.round(s.value),
                o: Math.round(clamp(((new Date(s.startDate).getTime() - windowStart) / windowSpan) * 100, 0, 100)),
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

  for (const [date, bucket] of restingHeartRateByDate.entries()) {
    const restingHr = average(bucket.values);
    if (restingHr === null) continue;
    try {
      await replaceHealthMetric(date, 'resting_heart_rate', Math.round(restingHr), 'bpm', HEALTH_CONNECT_SOURCE);
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

  const readinessDates = new Set([...sleepByDate.keys(), ...restingHeartRateByDate.keys()]);
  for (const date of readinessDates) {
    const sleepBucket = sleepByDate.get(date);
    const latestSample = sleepBucket?.samples[sleepBucket.samples.length - 1] ?? null;
    const sleepHours = average(
      (sleepBucket?.samples ?? []).map((sample) => getSleepHours(sample)).filter((value): value is number => value !== null)
    );
    const restingHr = average(restingHeartRateByDate.get(date)?.values ?? []);
    const sleepHeartRate = average(heartRateByDate.get(date)?.values ?? []);
    const respiratoryRate = average(respiratoryRateByDate.get(date)?.values ?? []);
    const sleepSummary = latestSample ? buildSleepSummary(latestSample, sleepHeartRate, respiratoryRate) : null;

    if (sleepHours === null && restingHr === null && sleepSummary === null) {
      continue;
    }

    const readinessInputs = {
      sleepHours: sleepSummary?.timeAsleepHours ?? sleepHours,
      sleepEfficiency: sleepSummary?.efficiency ?? null,
      sleepScore: sleepSummary?.score ?? null,
      restingHr,
      sleepHeartRate,
      respiratoryRate,
      steps: stepsByDate.get(date) ?? null,
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
  events: { type: string; date: string; time_start: string | null; time_end: string | null }[]
): BatteryResult {
  // 1. Time drain — gradual fatigue through the day
  const timeDrain = Math.max(0, baseline - applyReadinessDrain(baseline, now));

  // 2. Workout drain — gym sessions completed today
  const workoutDrain = clamp(
    workouts.reduce((sum, w) => {
      const durationMins = Math.max(0, (new Date(w.time_end).getTime() - new Date(w.time_start).getTime()) / 60000);
      const fromDuration = clamp(durationMins / 3, 0, 20);
      const fromVolume = clamp((w.total_kg ?? 0) / 300, 0, 15);
      return sum + fromDuration + fromVolume;
    }, 0),
    0, 35
  );

  // 3. Activity drain — Health Connect workouts today
  const todayStr = now.toISOString().slice(0, 10);
  const todayActivities = activities.filter((a) => a.startDate.slice(0, 10) === todayStr);
  const activityDrain = clamp(
    todayActivities.reduce((sum, a) => {
      const fromDuration = clamp(a.durationMinutes / 3, 0, 20);
      const fromCalories = a.calories ? clamp(a.calories / 50, 0, 20) : 0;
      return sum + Math.max(fromDuration, fromCalories);
    }, 0),
    0, 30
  );

  // 4. Event drain — calendar events that have already started
  const eventDrain = clamp(
    events.reduce((sum, e) => {
      if (!e.time_start) return sum;
      const start = new Date(`${e.date}T${e.time_start}`);
      if (start > now) return sum; // future event, no drain yet
      const endTime = e.time_end ? new Date(`${e.date}T${e.time_end}`) : new Date(start.getTime() + 3600000);
      const durationHours = Math.max(0, (Math.min(endTime.getTime(), now.getTime()) - start.getTime()) / 3600000);
      const drainPerHour = e.type === 'recovery' ? -2 : e.type === 'workout' ? 6 : e.type === 'reminder' ? 0 : 4;
      return sum + clamp(durationHours * drainPerHour, -5, 15);
    }, 0),
    0, 25
  );

  const score = clamp(Math.round(baseline - timeDrain - workoutDrain - activityDrain - eventDrain), 0, 100);

  return {
    score,
    baseline,
    drains: {
      time: Math.round(timeDrain),
      workout: Math.round(workoutDrain),
      activity: Math.round(activityDrain),
      event: Math.round(eventDrain),
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
