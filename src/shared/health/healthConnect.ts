import { Capacitor } from '@capacitor/core';
import { Health, type AuthorizationStatus, type HealthSample } from '@capgo/capacitor-health';
import { replaceHealthMetric, upsertReadinessScore } from '@/shared/db/app_db';

export type HealthMetricType = 'sleep_duration' | 'resting_heart_rate';

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

function calculateSleepScore(summary: {
  timeAsleepHours: number;
  timeInBedHours: number;
  sleepHeartRate: number | null;
  respiratoryRate: number | null;
  stages: SleepStageSummary[];
}) {
  const durationScore = clamp((summary.timeAsleepHours / 8) * 30, 0, 30);
  const efficiencyScore = clamp(summary.timeInBedHours > 0 ? summary.timeAsleepHours / summary.timeInBedHours : 0, 0, 1) * 25;

  const distinctStages = new Set(summary.stages.map((stage) => stage.stage));
  const stageScore = clamp((distinctStages.size / 5) * 15, 0, 15);

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

export async function readHealthMetrics(_type: HealthMetricType, _startDate: string, _endDate: string) {
  if (!isHealthConnectAvailable()) {
    throw new Error('Health Connect is only available on Android builds.');
  }

  const availability = await ensureAvailability();
  if (!availability.available) {
    throw new Error(availability.reason ?? 'Health Connect is unavailable on this device.');
  }

  const dataType: HealthConnectDataType = _type === 'sleep_duration' ? 'sleep' : 'restingHeartRate';
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

  const timeInBedHours = hoursBetween(session.startDate, session.endDate);
  const { totalMinutes, stageSummaries } = sumStageMinutes(session);
  const timeAsleepHours = totalMinutes > 0 ? totalMinutes / 60 : timeInBedHours;

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

  const stages: SleepStageSummary[] = Object.entries(stageSummaries)
    .map(([stage, minutes]) => ({
      stage,
      minutes,
      share: totalMinutes > 0 ? minutes / totalMinutes : 0,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  const summary: SleepSummary = {
    score: calculateSleepScore({
      timeAsleepHours,
      timeInBedHours,
      sleepHeartRate,
      respiratoryRate,
      stages,
    }),
    timeAsleepHours,
    timeInBedHours,
    efficiency: timeInBedHours > 0 ? timeAsleepHours / timeInBedHours : 0,
    wentToSleepAt: session.startDate,
    wokeUpAt: session.endDate,
    sleepHeartRate: sleepHeartRate === null ? null : Math.round(sleepHeartRate),
    respiratoryRate: respiratoryRate === null ? null : Number(respiratoryRate.toFixed(1)),
    stages,
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

  const [sleepResult, heartRateResult] = await Promise.all([
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
  ]);

  const sleepByDate = new Map<string, { values: number[] }>();
  for (const sample of sleepResult.samples) {
    const sleepHours = getSleepHours(sample);
    if (sleepHours === null) continue;

    const key = toDateKey(sample.endDate || sample.startDate);
    const bucket = sleepByDate.get(key) ?? { values: [] };
    bucket.values.push(sleepHours);
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

  let synced = 0;

  for (const [date, bucket] of sleepByDate.entries()) {
    const sleepHours = average(bucket.values);
    if (sleepHours === null) continue;

    await replaceHealthMetric(date, 'sleep_duration', Number(sleepHours.toFixed(2)), 'hours', HEALTH_CONNECT_SOURCE);
    synced += 1;
  }

  for (const [date, bucket] of heartRateByDate.entries()) {
    const restingHr = average(bucket.values);
    if (restingHr === null) continue;

    await replaceHealthMetric(date, 'resting_heart_rate', Math.round(restingHr), 'bpm', HEALTH_CONNECT_SOURCE);
    synced += 1;
  }

  const readinessDates = new Set([...sleepByDate.keys(), ...heartRateByDate.keys()]);
  for (const date of readinessDates) {
    const sleepHours = average(sleepByDate.get(date)?.values ?? []);
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
