import { describe, expect, it } from 'vitest';
import { averageByDay } from '@/shared/health/vitalsAggregate';

// Fixed local-date bucketer: takes the YYYY-MM-DD prefix (tests run in a fixed TZ
// on CI, and the bucket key contract is "the day the sample belongs to").
const dayOf = (iso: string) => iso.slice(0, 10);

describe('averageByDay', () => {
  it('returns [] for empty input', () => {
    expect(averageByDay([], dayOf)).toEqual([]);
  });

  it('averages multiple samples within one day', () => {
    const out = averageByDay(
      [
        { startDate: '2026-09-10T23:50:00Z', value: 40 },
        { startDate: '2026-09-10T23:55:00Z', value: 60 },
        { startDate: '2026-09-10T23:58:00Z', value: 50 },
      ],
      dayOf
    );
    expect(out).toEqual([{ date: '2026-09-10', value: 50 }]);
  });

  it('separates samples on different days and sorts ascending', () => {
    const out = averageByDay(
      [
        { startDate: '2026-09-12T08:00:00Z', value: 30 },
        { startDate: '2026-09-10T08:00:00Z', value: 50 },
        { startDate: '2026-09-11T08:00:00Z', value: 40 },
      ],
      dayOf
    );
    expect(out.map((r) => r.date)).toEqual(['2026-09-10', '2026-09-11', '2026-09-12']);
  });

  it('skips NaN and Infinity samples', () => {
    const out = averageByDay(
      [
        { startDate: '2026-09-10T08:00:00Z', value: Number.NaN },
        { startDate: '2026-09-10T09:00:00Z', value: Number.POSITIVE_INFINITY },
        { startDate: '2026-09-10T10:00:00Z', value: Number.NEGATIVE_INFINITY },
        { startDate: '2026-09-10T11:00:00Z', value: 42 },
      ],
      dayOf
    );
    expect(out).toEqual([{ date: '2026-09-10', value: 42 }]);
  });

  it('produces no bucket for a day with only invalid samples', () => {
    const out = averageByDay(
      [
        { startDate: '2026-09-10T08:00:00Z', value: Number.NaN },
        { startDate: '2026-09-11T08:00:00Z', value: 40 },
      ],
      dayOf
    );
    expect(out.map((r) => r.date)).toEqual(['2026-09-11']);
  });

  it('uses the injected bucket function, not raw string prefixes', () => {
    // Overnight sample 2026-09-10T23:30 local → bucketed to 2026-09-10 by a
    // local-aware toDateKey even if its UTC prefix differs.
    const localDayShifted = (iso: string) => {
      const d = new Date(iso);
      d.setUTCHours(d.getUTCHours() + 2); // simulate UTC+2 local
      return d.toISOString().slice(0, 10);
    };
    const out = averageByDay(
      [{ startDate: '2026-09-10T22:30:00Z', value: 55 }], // 00:30 local next day
      localDayShifted
    );
    expect(out).toEqual([{ date: '2026-09-11', value: 55 }]);
  });

  it('handles fractional sample values (keeps precision)', () => {
    const out = averageByDay(
      [
        { startDate: '2026-09-10T08:00:00Z', value: 97.5 },
        { startDate: '2026-09-10T20:00:00Z', value: 98.5 },
      ],
      dayOf
    );
    expect(out[0].value).toBeCloseTo(98.0, 10);
  });
});
