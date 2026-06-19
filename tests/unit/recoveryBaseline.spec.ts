import { describe, expect, test } from 'vitest'
import { computeRecoverySeries } from '@/shared/health/recoveryBaseline'
import type { DailyReading } from '@/shared/health/recoveryBaseline'

function seq(values: number[], startDay = 1): DailyReading[] {
  return values.map((value, i) => ({
    date: `2026-06-${String(startDay + i).padStart(2, '0')}`,
    value,
  }))
}

describe('computeRecoverySeries', () => {
  test('flat readings yield null z (no spread)', () => {
    const series = computeRecoverySeries(seq([50, 50, 50, 50, 50]), 'hrv')
    expect(series[series.length - 1].sd28).toBe(0)
    expect(series[series.length - 1].z).toBeNull()
    expect(series[series.length - 1].recoveryZ).toBeNull()
  })

  test('hrv: a low reading produces a negative recoveryZ', () => {
    // Baseline ~60, then a drop to 40 → below-baseline z is negative for HRV.
    const series = computeRecoverySeries(seq([60, 62, 58, 61, 59, 40]), 'hrv')
    const last = series[series.length - 1]
    expect(last.z).not.toBeNull()
    expect(last.z! < 0).toBe(true)
    expect(last.recoveryZ).toBe(last.z) // HRV is not inverted
  })

  test('rhr: an elevated reading produces a negative recoveryZ (inverted)', () => {
    // Baseline ~50, then a spike to 65 → high RHR is *worse* recovery.
    const series = computeRecoverySeries(seq([50, 49, 51, 50, 52, 65]), 'rhr')
    const last = series[series.length - 1]
    expect(last.z).not.toBeNull()
    expect(last.z! > 0).toBe(true) // raw z is positive (above mean)
    expect(last.recoveryZ! < 0).toBe(true) // but recovery-wise it's bad
    expect(last.recoveryZ).toBe(-last.z!)
  })

  test('respects minReadings before emitting z', () => {
    const series = computeRecoverySeries(seq([60, 40, 80]), 'hrv', { minReadings: 4 })
    expect(series.every((p) => p.z === null)).toBe(true)
  })

  test('dedupes duplicate dates keeping last and sorts ascending', () => {
    const readings: DailyReading[] = [
      { date: '2026-06-02', value: 55 },
      { date: '2026-06-01', value: 50 },
      { date: '2026-06-02', value: 60 }, // overrides the 55
    ]
    const series = computeRecoverySeries(readings, 'hrv')
    expect(series.map((p) => p.date)).toEqual(['2026-06-01', '2026-06-02'])
    expect(series[1].value).toBe(60)
  })

  test('mean7 tracks the trailing 7 readings', () => {
    const series = computeRecoverySeries(seq([10, 20, 30, 40, 50, 60, 70, 80]), 'hrv')
    // last 7 of [..80] = 20..80 → mean 50
    expect(series[series.length - 1].mean7).toBe(50)
  })
})
