import { describe, expect, it } from 'vitest';
import {
  canSyncHealthType,
  localDayWindow,
  stepTotalFromAggregation,
} from '@/shared/health/healthConnect';


describe('Health Connect step aggregation', () => {
  it('treats a successful empty aggregate as a real zero', () => {
    expect(stepTotalFromAggregation({ successful: true, samples: [] })).toBe(0);
  });

  it('does not turn a failed native aggregate into zero', () => {
    expect(stepTotalFromAggregation({ successful: false, samples: [] })).toBeNull();
  });

  it('sums valid aggregate buckets and ignores invalid values', () => {
    expect(stepTotalFromAggregation({
      successful: true,
      samples: [
        { value: 1200 },
        { value: 800 },
        { value: Number.NaN },
      ],
    })).toBe(2000);
  });
});

describe('Health Connect per-metric permission gating', () => {
  it('syncs steps when steps alone is granted', () => {
    expect(canSyncHealthType(['steps'], 'steps')).toBe(true);
    expect(canSyncHealthType(['steps'], 'sleep')).toBe(false);
  });
});

describe('local step-day windows', () => {
  it('uses a 23-hour local day across the spring DST transition', () => {
    const window = localDayWindow(0, new Date('2026-03-29T12:00:00+02:00'), 'Europe/Ljubljana');
    expect(window.dateKey).toBe('2026-03-29');
    expect(new Date(window.endISO).getTime() - new Date(window.startISO).getTime()).toBe(23 * 60 * 60 * 1000);
  });

  it('uses a 25-hour local day across the autumn DST transition', () => {
    const window = localDayWindow(0, new Date('2026-10-25T12:00:00+01:00'), 'Europe/Ljubljana');
    expect(window.dateKey).toBe('2026-10-25');
    expect(new Date(window.endISO).getTime() - new Date(window.startISO).getTime()).toBe(25 * 60 * 60 * 1000);
  });
});
