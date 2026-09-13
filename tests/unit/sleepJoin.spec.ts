import { describe, it, expect } from 'vitest';
import type { HealthSample } from '@capgo/capacitor-health';
import {
  averageOf,
  toChronologicalHrSamples,
  sleepWindowHeartRate,
  sleepWindowHeartRateAverage,
  rrWithinWindow,
  rrWithinWindowAverage,
  pickPrimarySleepSample,
  getSleepHours,
} from '@/shared/health/sleepJoin';

const iso = (s: string) => new Date(s).toISOString();

const sleepSample = (start: string, end: string, stages?: HealthSample['stages']): HealthSample =>
  ({
    startDate: iso(start),
    endDate: iso(end),
    ...(stages ? { stages } : {}),
  }) as HealthSample;

const hr = (t: string, value: number): HealthSample =>
  ({ startDate: iso(t), endDate: iso(t), value }) as HealthSample;

// A 23:50 → 07:00 overnight window (straddles midnight on 2026-09-10)
const NIGHT = sleepSample('2026-09-10T23:50', '2026-09-11T07:00');

describe('getSleepHours', () => {
  it('excludes awake/inBed stages', () => {
    const s = sleepSample('2026-09-10T23:00', '2026-09-11T07:00', [
      { stage: 'awake', startDate: iso('2026-09-10T23:00'), endDate: iso('2026-09-10T23:30'), durationMinutes: 30 },
      { stage: 'deep', startDate: iso('2026-09-10T23:30'), endDate: iso('2026-09-11T01:30'), durationMinutes: 120 },
      { stage: 'inBed', startDate: iso('2026-09-11T06:30'), endDate: iso('2026-09-11T07:00'), durationMinutes: 30 },
      { stage: 'light', startDate: iso('2026-09-11T01:30'), endDate: iso('2026-09-11T06:30'), durationMinutes: 300 },
    ]);
    expect(getSleepHours(s)).toBeCloseTo((120 + 300) / 60, 6);
  });

  it('falls back to the full span when there are no stages', () => {
    expect(getSleepHours(NIGHT)).toBeCloseTo((7 * 60 + 10) / 60, 6);
  });

  it('returns null on unparseable or inverted dates', () => {
    // inverted span: end <= start
    expect(getSleepHours(sleepSample('2026-09-10T07:00', '2026-09-10T02:00'))).toBeNull();
    const bad = { startDate: 'not-a-date', endDate: 'also-bad' } as unknown as HealthSample;
    expect(getSleepHours(bad)).toBeNull();
  });
});

describe('sleepWindowHeartRate', () => {
  const samples = toChronologicalHrSamples([
    hr('2026-09-10T22:00', 60), // before bedtime
    hr('2026-09-10T23:50', 62), // exactly at bedtime (boundary → included)
    hr('2026-09-11T03:00', 55),
    hr('2026-09-11T07:00', 64), // exactly at waketime (boundary → included)
    hr('2026-09-11T08:00', 72), // after waketime
  ]);
  // NaN-timestamp sample → dropped by the chronological filter
  samples.push({ startDate: 'garbage', endDate: 'garbage', value: 80 } as HealthSample);

  it('includes boundary samples, excludes outside ones, drops NaN timestamps', () => {
    const inWindow = sleepWindowHeartRate(NIGHT, samples);
    expect(inWindow.map((s) => s.value)).toEqual([62, 55, 64]);
  });

  it('returns [] when the sleep sample has unparseable dates', () => {
    const bad = { startDate: 'nope', endDate: 'nope' } as unknown as HealthSample;
    expect(sleepWindowHeartRate(bad, samples)).toEqual([]);
  });

  it('average matches the window samples; null when empty', () => {
    expect(sleepWindowHeartRateAverage(NIGHT, samples)).toBeCloseTo((62 + 55 + 64) / 3, 6);
    expect(sleepWindowHeartRateAverage(NIGHT, [])).toBeNull();
  });
});

describe('rrWithinWindow', () => {
  // Sparse RR readings on both sides of midnight of the same night
  const rrSamples = toChronologicalHrSamples([
    hr('2026-09-10T23:55', 14.2), // pre-midnight, belongs to this night
    hr('2026-09-11T02:00', 13.8),
    hr('2026-09-11T06:30', 14.0),
    hr('2026-09-11T12:00', 15.5), // daytime — excluded
  ]);

  it('keeps the full night: pre-midnight AND post-midnight readings', () => {
    const values = rrWithinWindow(NIGHT, rrSamples).map((s) => s.value);
    expect(values).toEqual([14.2, 13.8, 14.0]);
    expect(rrWithinWindowAverage(NIGHT, rrSamples)).toBeCloseTo((14.2 + 13.8 + 14.0) / 3, 6);
  });

  it('returns null average when no readings fall in the window', () => {
    expect(rrWithinWindowAverage(NIGHT, [])).toBeNull();
  });
});

describe('pickPrimarySleepSample', () => {
  it('picks the longest-asleep sample, not the last', () => {
    const nap = sleepSample('2026-09-10T14:00', '2026-09-10T15:00');
    const overnight = sleepSample('2026-09-10T23:00', '2026-09-11T07:00');
    const samples = [overnight, nap]; // last = nap
    expect(pickPrimarySleepSample(samples, getSleepHours)).toBe(overnight);
  });

  it('returns null for an empty bucket', () => {
    expect(pickPrimarySleepSample([], getSleepHours)).toBeNull();
  });
});

describe('averageOf', () => {
  it('is null on empty, mean otherwise', () => {
    expect(averageOf([])).toBeNull();
    expect(averageOf([1, 2, 3])).toBe(2);
  });
});
