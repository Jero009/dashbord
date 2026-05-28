import { Capacitor } from '@capacitor/core';
import { Health, type AuthorizationStatus, type HealthSample } from '@capgo/capacitor-health';
import { replaceHealthMetric, upsertReadinessScore } from '@/shared/db/app_db';

export type HealthMetricType =
  | 'sleep_duration'
  | 'sleep_time_in_bed'
  | 'sleep_efficiency'
  | 'sleep_score'
  | 'sleep_heart_rate'
  | 'respiratory_rate'
  | 'resting_heart_rate';

type HealthConnectDataType = 'sleep' | 'restingHeartRate' | 'heartRate' | 'respiratoryRate';

const HEALTH_CONNECT_READ_TYPES: HealthConnectDataType[] = ['sleep', 'restingHeartRate', 'heartRate', 'respiratoryRate'];
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
}

export interface SleepSummaryResult extends HealthConnectAccessResult {
  summary?: SleepSummary | null;
}

export function isHealthConnectAvailable() {
  return Capacitor.getPlatform() === 'android';
}

export function calculateReadinessScore(sleepHours: number | null, restingHr: number | null) {
  let score = 50;

  if (sleepHours !== null) {
    score += Math.min(25, (sleepHours / 8) * 25);
  }

  if (restingHr !== null) {
    score += Math.max(0, Math.min(25, 70 - restingHr));
  }

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

function buildSleepSummary(sample: HealthSample, sleepHeartRate: number | null, respiratoryRate: number | null) {
  const timeInBedHours = hoursBetween(sample.startDate, sample.endDate);
  const { totalMinutes, stageSummaries } = sumStageMinutes(sample);
  const timeAsleepHours = totalMinutes > 0 ? totalMinutes / 60 : timeInBedHours;
  const stages: SleepStageSummary[] = Object.entries(stageSummaries)
    .map(([stage, minutes]) => ({
      stage,
      minutes,
      share: totalMinutes > 0 ? minutes / totalMinutes : 0,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  return {
    timeInBedHours,
    timeAsleepHours,
    efficiency: timeInBedHours > 0 ? timeAsleepHours / timeInBedHours : 0,
    stages,
    timeline: buildSleepTimeline(sample),
    score: calculateSleepScore({
      timeAsleepHours,
      timeInBedHours,
      sleepHeartRate,
      respiratoryRate,
      stages,
    }),
  };
}

function calculateSleepScore(summary: {
  timeAsleepHours: number;
  timeInBedHours: number;
  sleepHeartRate: number | null;
  respiratoryRate: number | null;
  stages: SleepStageSummary[];
}) {
  const durationScore = clamp((summary.timeAsleepHours / 8) * 30, 0, 30);
  const efficiencyScore = clamp(summary.timeInBedHours > 0 ? summary.timeAsleepHours / summary.timeInBedHours : 0, 0, 1) * 25;

  const distinctStages = new Set(
    summary.stages
      .map((stage) => stage.stage)
      .filter((stage) => stage !== 'awake' && stage !== 'inBed')
  );
  const stageScore = clamp((distinctStages.size / 4) * 15, 0, 15);

  const sleepHrScore = summary.sleepHeartRate === null
    ? 5
    : clamp(15 - Math.abs(summary.sleepHeartRate - 55) / 2, 0, 15);

  const respiratoryScore = summary.respiratoryRate === null
    ? 5
    : clamp(15 - Math.abs(summary.respiratoryRate - 14.5) / 0.9, 0, 15);

  return Math.round(durationScore + efficiencyScore + stageScore + sleepHrScore + respiratoryScore);
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
    _type === 'resting_heart_rate'
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
  const sleepSummary = buildSleepSummary(
    session,
    sleepHeartRate,
    respiratoryRate
  );
  const summary: SleepSummary = {
    ...sleepSummary,
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

  const [sleepResult, heartRateResult, respiratoryRateResult] = await Promise.all([
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
  ]);

  const sleepByDate = new Map<string, { samples: HealthSample[] }>();
  for (const sample of sleepResult.samples) {
    const sleepHours = getSleepHours(sample);
    if (sleepHours === null) continue;

    const key = toDateKey(sample.endDate || sample.startDate);
    const bucket = sleepByDate.get(key) ?? { samples: [] };
    bucket.samples.push(sample);
    sleepByDate.set(key, bucket);
  }

  const heartRateByDate = new Map<string, { values: number[] }>();
  for (const sample of heartRateResult.samples) {
    if (!Number.isFinite(sample.value)) continue;

    const key = toDateKey(sample.startDate || sample.endDate);
    const bucket = heartRateByDate.get(key) ?? { values: [] };
    bucket.values.push(sample.value);
    heartRateByDate.set(key, bucket);
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

  for (const [date, bucket] of sleepByDate.entries()) {
    const latestSample = bucket.samples[bucket.samples.length - 1];
    if (!latestSample) continue;

    const sleepHeartRate = average(heartRateByDate.get(date)?.values ?? []);
    const respiratoryRate = average(respiratoryRateByDate.get(date)?.values ?? []);
    const sleepSummary = buildSleepSummary(latestSample, sleepHeartRate, respiratoryRate);

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
  }

  for (const [date, bucket] of heartRateByDate.entries()) {
    const restingHr = average(bucket.values);
    if (restingHr === null) continue;

    await replaceHealthMetric(date, 'resting_heart_rate', Math.round(restingHr), 'bpm', HEALTH_CONNECT_SOURCE);
    synced += 1;
  }

  for (const [date, bucket] of respiratoryRateByDate.entries()) {
    const respiratoryRate = average(bucket.values);
    if (respiratoryRate === null) continue;

    await replaceHealthMetric(date, 'respiratory_rate', Number(respiratoryRate.toFixed(1)), 'rpm', HEALTH_CONNECT_SOURCE);
    synced += 1;
  }

  const readinessDates = new Set([...sleepByDate.keys(), ...heartRateByDate.keys()]);
  for (const date of readinessDates) {
    const sleepHours = average(
      (sleepByDate.get(date)?.samples ?? []).map((sample) => getSleepHours(sample)).filter((value): value is number => value !== null)
    );
    const restingHr = average(heartRateByDate.get(date)?.values ?? []);

    if (sleepHours === null && restingHr === null) {
      continue;
    }

    await upsertReadinessScore(date, calculateReadinessScore(sleepHours, restingHr), {
      sleepHours,
      restingHr,
      source: HEALTH_CONNECT_SOURCE,
    });
  }

  return {
    available: true,
    granted: true,
    synced,
  };
}
