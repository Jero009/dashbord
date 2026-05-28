import { Capacitor } from '@capacitor/core';
import { Health, type AuthorizationStatus, type HealthSample } from '@capgo/capacitor-health';
import { replaceHealthMetric, upsertReadinessScore } from '@/shared/db/app_db';

export type HealthMetricType = 'sleep_duration' | 'resting_heart_rate';

type HealthConnectDataType = 'sleep' | 'restingHeartRate';

const HEALTH_CONNECT_READ_TYPES: HealthConnectDataType[] = ['sleep', 'restingHeartRate'];
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

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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
