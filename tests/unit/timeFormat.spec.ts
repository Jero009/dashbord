import { describe, expect, test } from 'vitest'
import { localDateISO, parseLocalDate, shiftDate, formatLocalDay, formatLocalMonth } from '@/shared/utils/timeFormat'

describe('timeFormat shiftDate', () => {
  test('moves across month boundaries', () => {
    expect(shiftDate('2026-06-01', -1)).toBe('2026-05-31')
    expect(shiftDate('2026-06-30', 1)).toBe('2026-07-01')
  })

  test('moves across year boundaries', () => {
    expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31')
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01')
  })

  test('handles leap years', () => {
    expect(shiftDate('2028-02-28', 1)).toBe('2028-02-29')
    expect(shiftDate('2027-02-28', 1)).toBe('2027-03-01')
  })

  test('round-trips with localDateISO/parseLocalDate', () => {
    expect(shiftDate('2026-06-15', 0)).toBe('2026-06-15')
    expect(shiftDate(shiftDate('2026-06-15', 40), -40)).toBe('2026-06-15')
  })

  test('result parses back to the same local calendar day', () => {
    const d = parseLocalDate(shiftDate('2026-06-15', 17))
    expect(localDateISO(d)).toBe('2026-07-02')
  })
})

describe('formatLocalDay', () => {
  test('formats a YYYY-MM-DD key as a short local day, calendar-safe', () => {
    expect(formatLocalDay('2026-06-28')).toBe('Jun 28')
    expect(formatLocalDay('2026-01-05')).toBe('Jan 5')
  })

  test('returns the original string for malformed keys instead of Invalid Date', () => {
    expect(formatLocalDay('garbage')).toBe('garbage')
    expect(formatLocalDay('')).toBe('')
  })
})

describe('formatLocalMonth', () => {
  test('long style: month + year', () => {
    expect(formatLocalMonth('2026-06')).toBe('June 2026')
    expect(formatLocalMonth('2025-12')).toBe('December 2025')
  })

  test('short style: month only', () => {
    expect(formatLocalMonth('2026-06', 'short')).toBe('Jun')
    expect(formatLocalMonth('2025-12', 'short')).toBe('Dec')
  })

  test('returns the original string for malformed keys instead of Invalid Date', () => {
    expect(formatLocalMonth('nonsense')).toBe('nonsense')
    expect(formatLocalMonth('')).toBe('')
  })
})
