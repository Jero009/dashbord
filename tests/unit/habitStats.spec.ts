import { describe, expect, test } from 'vitest'
import {
  isScheduledOn,
  shiftDate,
  currentStreak,
  bestStreak,
  completionRate,
} from '@/shared/utils/habitStats'

const daily = { days_of_week: null }
// 2026-06-08 is a Monday; Mon/Wed/Fri schedule
const mwf = { days_of_week: '1,3,5' }

describe('habitStats', () => {
  test('shiftDate moves across month boundaries', () => {
    expect(shiftDate('2026-06-01', -1)).toBe('2026-05-31')
    expect(shiftDate('2026-06-30', 1)).toBe('2026-07-01')
  })

  test('isScheduledOn respects day-of-week list', () => {
    expect(isScheduledOn(daily, '2026-06-09')).toBe(true)
    expect(isScheduledOn(mwf, '2026-06-08')).toBe(true) // Monday
    expect(isScheduledOn(mwf, '2026-06-09')).toBe(false) // Tuesday
  })

  test('currentStreak counts consecutive completed days', () => {
    const done = new Set(['2026-06-08', '2026-06-09', '2026-06-10'])
    expect(currentStreak(daily, done, '2026-06-10')).toBe(3)
  })

  test('currentStreak does not break on incomplete anchor day', () => {
    const done = new Set(['2026-06-08', '2026-06-09'])
    expect(currentStreak(daily, done, '2026-06-10')).toBe(2)
  })

  test('currentStreak breaks on a missed past day', () => {
    const done = new Set(['2026-06-07', '2026-06-09', '2026-06-10'])
    expect(currentStreak(daily, done, '2026-06-10')).toBe(2)
  })

  test('currentStreak skips unscheduled days', () => {
    // Mon 06-08 and Wed 06-10 done; Tue is unscheduled and must not break
    const done = new Set(['2026-06-08', '2026-06-10'])
    expect(currentStreak(mwf, done, '2026-06-10')).toBe(2)
  })

  test('bestStreak finds the longest run over a window', () => {
    const done = new Set(['2026-06-01', '2026-06-02', '2026-06-04', '2026-06-05', '2026-06-06'])
    expect(bestStreak(daily, done, '2026-06-01', '2026-06-07')).toBe(3)
  })

  test('completionRate counts only scheduled days', () => {
    // Week of Mon 06-08 .. Sun 06-14 has Mon/Wed/Fri scheduled (3 days)
    const done = new Set(['2026-06-08', '2026-06-12'])
    expect(completionRate(mwf, done, '2026-06-08', '2026-06-14')).toBeCloseTo(2 / 3)
  })

  test('completionRate returns null when nothing scheduled', () => {
    // Tue 06-09 only — not a Mon/Wed/Fri
    expect(completionRate(mwf, new Set(), '2026-06-09', '2026-06-09')).toBeNull()
  })
})
