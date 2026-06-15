import { describe, it, expect } from 'vitest';
import {
  eventOccursOn,
  expandOccurrencesInMonth,
  expandOccurrencesInRange,
  recurrenceLabel,
} from '@/shared/utils/recurrence';

describe('eventOccursOn', () => {
  it('non-recurring matches only its own date', () => {
    const ev = { date: '2026-06-15', recurrence: 'none' };
    expect(eventOccursOn(ev, '2026-06-15')).toBe(true);
    expect(eventOccursOn(ev, '2026-06-16')).toBe(false);
  });

  it('never matches before the start date', () => {
    const ev = { date: '2026-06-15', recurrence: 'daily' };
    expect(eventOccursOn(ev, '2026-06-14')).toBe(false);
  });

  it('daily with interval', () => {
    const ev = { date: '2026-06-15', recurrence: 'daily', recur_interval: 3 };
    expect(eventOccursOn(ev, '2026-06-15')).toBe(true);
    expect(eventOccursOn(ev, '2026-06-18')).toBe(true);
    expect(eventOccursOn(ev, '2026-06-17')).toBe(false);
  });

  it('weekly defaults to the start weekday', () => {
    const ev = { date: '2026-06-15', recurrence: 'weekly' }; // Monday
    expect(eventOccursOn(ev, '2026-06-22')).toBe(true);
    expect(eventOccursOn(ev, '2026-06-23')).toBe(false);
  });

  it('weekly with explicit days and interval', () => {
    // Mondays & Wednesdays, every 2 weeks, starting Mon 2026-06-15
    const ev = { date: '2026-06-15', recurrence: 'weekly', recur_days: '1,3', recur_interval: 2 };
    expect(eventOccursOn(ev, '2026-06-15')).toBe(true); // Mon wk0
    expect(eventOccursOn(ev, '2026-06-17')).toBe(true); // Wed wk0
    expect(eventOccursOn(ev, '2026-06-22')).toBe(false); // Mon wk1 (skipped by interval)
    expect(eventOccursOn(ev, '2026-06-29')).toBe(true); // Mon wk2
  });

  it('weekdays skips weekends', () => {
    const ev = { date: '2026-06-15', recurrence: 'weekdays' }; // Monday
    expect(eventOccursOn(ev, '2026-06-19')).toBe(true); // Friday
    expect(eventOccursOn(ev, '2026-06-20')).toBe(false); // Saturday
    expect(eventOccursOn(ev, '2026-06-22')).toBe(true); // next Monday
  });

  it('monthly keeps day-of-month and skips short months', () => {
    const ev = { date: '2026-01-31', recurrence: 'monthly' };
    expect(eventOccursOn(ev, '2026-01-31')).toBe(true);
    expect(eventOccursOn(ev, '2026-02-28')).toBe(false); // Feb has no 31st -> skipped
    expect(eventOccursOn(ev, '2026-03-31')).toBe(true);
  });

  it('yearly skips Feb 29 in non-leap years', () => {
    const ev = { date: '2024-02-29', recurrence: 'yearly' };
    expect(eventOccursOn(ev, '2025-02-28')).toBe(false);
    expect(eventOccursOn(ev, '2028-02-29')).toBe(true); // next leap year
  });

  it('honours end_date (until)', () => {
    const ev = { date: '2026-06-15', recurrence: 'daily', end_date: '2026-06-17' };
    expect(eventOccursOn(ev, '2026-06-17')).toBe(true);
    expect(eventOccursOn(ev, '2026-06-18')).toBe(false);
  });

  it('honours recur_count', () => {
    const ev = { date: '2026-06-15', recurrence: 'daily', recur_count: 3 };
    expect(eventOccursOn(ev, '2026-06-17')).toBe(true); // 3rd occurrence
    expect(eventOccursOn(ev, '2026-06-18')).toBe(false); // 4th — beyond count
  });
});

describe('expandOccurrencesInMonth', () => {
  it('expands a weekly event across a month', () => {
    const ev = { date: '2026-06-01', recurrence: 'weekly' }; // Monday
    const dates = expandOccurrencesInMonth(ev, '2026-06');
    expect(dates).toEqual(['2026-06-01', '2026-06-08', '2026-06-15', '2026-06-22', '2026-06-29']);
  });

  it('returns the single date for a non-recurring event in that month', () => {
    const ev = { date: '2026-06-10', recurrence: 'none' };
    expect(expandOccurrencesInMonth(ev, '2026-06')).toEqual(['2026-06-10']);
    expect(expandOccurrencesInMonth(ev, '2026-07')).toEqual([]);
  });
});

describe('expandOccurrencesInRange', () => {
  it('clamps to the range', () => {
    const ev = { date: '2026-06-15', recurrence: 'daily' };
    expect(expandOccurrencesInRange(ev, '2026-06-17', '2026-06-19')).toEqual([
      '2026-06-17', '2026-06-18', '2026-06-19',
    ]);
  });
});

describe('recurrenceLabel', () => {
  it('formats common cadences', () => {
    expect(recurrenceLabel({ date: '2026-06-15', recurrence: 'none' })).toBe('');
    expect(recurrenceLabel({ date: '2026-06-15', recurrence: 'daily' })).toBe('Daily');
    expect(recurrenceLabel({ date: '2026-06-15', recurrence: 'weekly', recur_interval: 2 })).toBe('Every 2 weeks');
    expect(recurrenceLabel({ date: '2026-06-15', recurrence: 'weekdays' })).toBe('Every weekday');
    expect(recurrenceLabel({ date: '2026-06-15', recurrence: 'daily', recur_count: 5 })).toBe('Daily, 5×');
  });
});
