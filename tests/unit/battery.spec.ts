import { describe, expect, it } from 'vitest';
import { calculateBattery, type ActivitySummary } from '@/shared/health/healthConnect';

const now = new Date(2026, 9, 2, 12, 0, 0);

const activity = (overrides: Partial<ActivitySummary> = {}): ActivitySummary => ({
  workoutType: 'walking',
  startDate: '2026-10-02T10:00:00',
  endDate: '2026-10-02T10:30:00',
  durationMinutes: 30,
  calories: 250,
  distanceKm: null,
  sourceName: null,
  ...overrides,
});

describe('calculateBattery live inputs', () => {
  it('preserves the baseline-only output', () => {
    expect(calculateBattery(80, now, [], [])).toEqual({
      score: 67,
      baseline: 80,
      drains: { time: 13, workout: 0, activity: 0 },
      readyToTrain: true,
      readyToStudy: true,
      status: 'Good',
    });
  });

  it('preserves workout drain and suppresses activity drain', () => {
    const workouts = [{
      time_start: '2026-10-02T09:00:00',
      time_end: '2026-10-02T10:00:00',
      total_kg: 3000,
    }];

    expect(calculateBattery(80, now, workouts, [activity()])).toMatchObject({
      score: 32,
      drains: { time: 13, workout: 35, activity: 0 },
      readyToTrain: false,
      readyToStudy: false,
      status: 'Recharge',
    });
  });

  it('preserves activity drain when no app workout exists', () => {
    expect(calculateBattery(80, now, [], [activity()])).toMatchObject({
      score: 57,
      drains: { time: 13, workout: 0, activity: 10 },
      readyToTrain: false,
      readyToStudy: true,
      status: 'Good',
    });
  });
});
