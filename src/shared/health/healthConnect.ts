import { Capacitor } from '@capacitor/core';

export type HealthMetricType = 'sleep_duration' | 'resting_heart_rate';

export function isHealthConnectAvailable() {
  return Capacitor.getPlatform() === 'android';
}

export async function requestHealthConnectPermissions() {
  if (!isHealthConnectAvailable()) {
    throw new Error('Health Connect is only available on Android builds.');
  }

  // Placeholder until native Health Connect plugin is wired.
  return { granted: false };
}

export async function readHealthMetrics(_type: HealthMetricType, _startDate: string, _endDate: string) {
  if (!isHealthConnectAvailable()) {
    throw new Error('Health Connect is only available on Android builds.');
  }

  // Placeholder: implement once Health Connect plugin is added.
  return [];
}
