import { describe, expect, test } from 'vitest'
import {
  sessionRpeLoad,
  computeDailyLoads,
  acwrFlag,
  computeAcwrSeries,
  enumerateDates,
  addDays,
} from '@/shared/health/trainingLoad'
import type { SessionLoadInput } from '@/shared/health/trainingLoad'

describe('sessionRpeLoad', () => {
  test('multiplies rpe by duration', () => {
    expect(sessionRpeLoad(8, 60)).toBe(480)
  })
  test('null when rpe or duration missing', () => {
    expect(sessionRpeLoad(null, 60)).toBeNull()
    expect(sessionRpeLoad(8, null)).toBeNull()
  })
  test('non-positive inputs yield 0, not negative load', () => {
    expect(sessionRpeLoad(0, 60)).toBe(0)
    expect(sessionRpeLoad(8, 0)).toBe(0)
  })
})

describe('computeDailyLoads', () => {
  test('sums multiple sessions on the same day and falls back to volume', () => {
    const sessions: SessionLoadInput[] = [
      { date: '2026-06-01', volumeLoad: 1000, durationMinutes: null, sessionRpe: null },
      { date: '2026-06-01', volumeLoad: 500, durationMinutes: null, sessionRpe: null },
    ]
    const [day] = computeDailyLoads(sessions)
    expect(day.volumeLoad).toBe(1500)
    expect(day.rpeLoad).toBeNull()
    expect(day.load).toBe(1500)
    expect(day.loadSource).toBe('volume')
  })

  test('uses rpe load when RPE present', () => {
    const sessions: SessionLoadInput[] = [
      { date: '2026-06-02', volumeLoad: 2000, durationMinutes: 50, sessionRpe: 7 },
    ]
    const [day] = computeDailyLoads(sessions)
    expect(day.rpeLoad).toBe(350)
    expect(day.load).toBe(350)
    expect(day.loadSource).toBe('rpe')
  })

  test('returns days sorted ascending', () => {
    const sessions: SessionLoadInput[] = [
      { date: '2026-06-03', volumeLoad: 1, durationMinutes: null, sessionRpe: null },
      { date: '2026-06-01', volumeLoad: 1, durationMinutes: null, sessionRpe: null },
    ]
    expect(computeDailyLoads(sessions).map((d) => d.date)).toEqual([
      '2026-06-01',
      '2026-06-03',
    ])
  })
})

describe('acwrFlag', () => {
  test('zone boundaries', () => {
    expect(acwrFlag(0.5)).toBe('detraining')
    expect(acwrFlag(0.79)).toBe('detraining')
    expect(acwrFlag(0.8)).toBe('optimal')
    expect(acwrFlag(1.3)).toBe('optimal')
    expect(acwrFlag(1.31)).toBe('caution')
    expect(acwrFlag(1.5)).toBe('caution')
    expect(acwrFlag(1.6)).toBe('high_risk')
  })
})

describe('date helpers', () => {
  test('addDays crosses month boundary', () => {
    expect(addDays('2026-06-30', 1)).toBe('2026-07-01')
    expect(addDays('2026-06-01', -1)).toBe('2026-05-31')
  })
  test('enumerateDates is inclusive', () => {
    expect(enumerateDates('2026-06-01', '2026-06-03')).toEqual([
      '2026-06-01',
      '2026-06-02',
      '2026-06-03',
    ])
  })
})

describe('computeAcwrSeries', () => {
  test('steady daily load gives ACWR ~1.0', () => {
    // 30 days of constant volume load.
    const loads = Array.from({ length: 30 }, (_, i) => ({
      date: addDays('2026-06-01', i),
      volumeLoad: 1000,
      rpeLoad: null,
      load: 1000,
      loadSource: 'volume' as const,
    }))
    const series = computeAcwrSeries(loads, { minChronicDays: 14 })
    const last = series[series.length - 1]
    expect(last.acwr).toBeCloseTo(1.0, 1)
    expect(last.flag).toBe('optimal')
  })

  test('null ACWR until minChronicDays of history', () => {
    const loads = Array.from({ length: 20 }, (_, i) => ({
      date: addDays('2026-06-01', i),
      volumeLoad: 1000,
      rpeLoad: null,
      load: 1000,
      loadSource: 'volume' as const,
    }))
    const series = computeAcwrSeries(loads, { minChronicDays: 14 })
    expect(series[12].acwr).toBeNull() // day 13, history < 14
    expect(series[13].acwr).not.toBeNull() // day 14
  })

  test('acute spike pushes ACWR into high risk', () => {
    // 27 days low load, then a big spike on the last day.
    const base = Array.from({ length: 27 }, (_, i) => ({
      date: addDays('2026-06-01', i),
      volumeLoad: 200,
      rpeLoad: null,
      load: 200,
      loadSource: 'volume' as const,
    }))
    base.push({
      date: addDays('2026-06-01', 27),
      volumeLoad: 5000,
      rpeLoad: null,
      load: 5000,
      loadSource: 'volume' as const,
    })
    const series = computeAcwrSeries(base, { minChronicDays: 14 })
    const last = series[series.length - 1]
    expect(last.acwr).not.toBeNull()
    expect(last.acwr! > 1.5).toBe(true)
    expect(last.flag).toBe('high_risk')
  })

  test('rest days drag the acute average down (gap fill)', () => {
    // One workout, then a long gap → acute load decays toward 0.
    const loads = [
      { date: '2026-06-01', volumeLoad: 7000, rpeLoad: null, load: 7000, loadSource: 'volume' as const },
      { date: '2026-06-20', volumeLoad: 1000, rpeLoad: null, load: 1000, loadSource: 'volume' as const },
    ]
    const series = computeAcwrSeries(loads, { minChronicDays: 14 })
    expect(series.length).toBe(20) // gap-filled calendar span
  })

  test('empty input yields empty series', () => {
    expect(computeAcwrSeries([])).toEqual([])
  })
})
