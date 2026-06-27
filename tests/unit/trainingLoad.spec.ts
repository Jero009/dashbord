import { describe, expect, test } from 'vitest'
import {
  sessionRpeLoad,
  computeDailyLoads,
  selectLoadMetric,
  dailyLoadValue,
  acwrFlag,
  computeAcwrSeries,
  enumerateDates,
  addDays,
} from '@/shared/health/trainingLoad'
import type { SessionLoadInput, DailyLoad } from '@/shared/health/trainingLoad'

const day = (date: string, volumeLoad: number, rpeLoad: number | null = null): DailyLoad => ({
  date,
  volumeLoad,
  rpeLoad,
})

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
  test('sums volume across multiple sessions on the same day', () => {
    const sessions: SessionLoadInput[] = [
      { date: '2026-06-01', volumeLoad: 1000, durationMinutes: null, sessionRpe: null },
      { date: '2026-06-01', volumeLoad: 500, durationMinutes: null, sessionRpe: null },
    ]
    const [d] = computeDailyLoads(sessions)
    expect(d.volumeLoad).toBe(1500)
    expect(d.rpeLoad).toBeNull()
  })

  test('computes rpe load when RPE present', () => {
    const sessions: SessionLoadInput[] = [
      { date: '2026-06-02', volumeLoad: 2000, durationMinutes: 50, sessionRpe: 7 },
    ]
    const [d] = computeDailyLoads(sessions)
    expect(d.rpeLoad).toBe(350)
    expect(d.volumeLoad).toBe(2000)
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

describe('selectLoadMetric', () => {
  test('volume when no RPE recorded', () => {
    expect(selectLoadMetric([day('2026-06-01', 1000)])).toBe('volume')
  })
  test('rpe only when every training day has RPE', () => {
    expect(selectLoadMetric([day('2026-06-01', 1000, 350), day('2026-06-02', 800, 280)])).toBe('rpe')
  })
  test('falls back to volume when RPE is partial (no unit mixing)', () => {
    expect(selectLoadMetric([day('2026-06-01', 1000, 350), day('2026-06-02', 800, null)])).toBe('volume')
  })
  test('ignores zero-load days when deciding', () => {
    expect(selectLoadMetric([day('2026-06-01', 1000, 350), day('2026-06-02', 0, null)])).toBe('rpe')
  })
  test('empty input is volume', () => {
    expect(selectLoadMetric([])).toBe('volume')
  })
})

describe('dailyLoadValue', () => {
  test('returns the requested unit', () => {
    const d = day('2026-06-01', 1000, 350)
    expect(dailyLoadValue(d, 'volume')).toBe(1000)
    expect(dailyLoadValue(d, 'rpe')).toBe(350)
    expect(dailyLoadValue(day('2026-06-01', 1000, null), 'rpe')).toBe(0)
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
    const loads = Array.from({ length: 30 }, (_, i) => day(addDays('2026-06-01', i), 1000))
    const series = computeAcwrSeries(loads, { minChronicDays: 14 })
    const last = series[series.length - 1]
    expect(last.acwr).toBeCloseTo(1.0, 1)
    expect(last.flag).toBe('optimal')
    expect(last.metric).toBe('volume')
  })

  test('null ACWR until minChronicDays of history', () => {
    const loads = Array.from({ length: 20 }, (_, i) => day(addDays('2026-06-01', i), 1000))
    const series = computeAcwrSeries(loads, { minChronicDays: 14 })
    expect(series[12].acwr).toBeNull() // day 13, history < 14
    expect(series[13].acwr).not.toBeNull() // day 14
  })

  test('acute spike pushes ACWR into high risk', () => {
    const base = Array.from({ length: 27 }, (_, i) => day(addDays('2026-06-01', i), 200))
    base.push(day(addDays('2026-06-01', 27), 5000))
    const series = computeAcwrSeries(base, { minChronicDays: 14 })
    const last = series[series.length - 1]
    expect(last.acwr).not.toBeNull()
    expect(last.acwr! > 1.5).toBe(true)
    expect(last.flag).toBe('high_risk')
  })

  test('rest days drag the acute average down (gap fill)', () => {
    const loads = [day('2026-06-01', 7000), day('2026-06-20', 1000)]
    const series = computeAcwrSeries(loads, { minChronicDays: 14 })
    expect(series.length).toBe(20) // gap-filled calendar span
  })

  test('uses a single consistent unit — full RPE coverage selects rpe', () => {
    const loads = Array.from({ length: 30 }, (_, i) => day(addDays('2026-06-01', i), 2000, 400))
    const series = computeAcwrSeries(loads, { minChronicDays: 14 })
    expect(series[0].metric).toBe('rpe')
    expect(series[series.length - 1].load).toBe(400) // rpe unit, not volume
  })

  test('partial RPE coverage stays in volume (no unit mixing)', () => {
    const loads = Array.from({ length: 30 }, (_, i) =>
      day(addDays('2026-06-01', i), 2000, i % 2 === 0 ? 400 : null)
    )
    const series = computeAcwrSeries(loads, { minChronicDays: 14 })
    expect(series[0].metric).toBe('volume')
    expect(series[series.length - 1].load).toBe(2000)
  })

  test('endDate extends the series so rest days decay the acute load', () => {
    // 28 days steady training, then 14 rest days up to endDate.
    const loads = Array.from({ length: 28 }, (_, i) => day(addDays('2026-06-01', i), 1000))
    const lastTrain = addDays('2026-06-01', 27)
    const restEnd = addDays(lastTrain, 14)
    const series = computeAcwrSeries(loads, { minChronicDays: 14, endDate: restEnd })
    const last = series[series.length - 1]
    expect(last.date).toBe(restEnd)
    expect(last.load).toBe(0) // a gap-filled rest day
    expect(last.acwr).not.toBeNull()
    expect(last.acwr! < 0.8).toBe(true) // acute decayed below chronic
    expect(last.flag).toBe('detraining')
  })

  test('endDate before the last workout is ignored', () => {
    const loads = [day('2026-06-01', 1000), day('2026-06-10', 1000)]
    const series = computeAcwrSeries(loads, { endDate: '2026-06-05' })
    expect(series[series.length - 1].date).toBe('2026-06-10')
  })

  test('empty input yields empty series', () => {
    expect(computeAcwrSeries([])).toEqual([])
  })

  test('defaults to EWMA and stays sensitive to an acute spike', () => {
    const base = Array.from({ length: 27 }, (_, i) => day(addDays('2026-06-01', i), 200))
    base.push(day(addDays('2026-06-01', 27), 5000))
    const ewma = computeAcwrSeries(base, { minChronicDays: 14 })
    const rolling = computeAcwrSeries(base, { minChronicDays: 14, method: 'rolling' })
    const lastEwma = ewma[ewma.length - 1]
    // EWMA flags the spike as high risk (sensitivity, Williams 2017)...
    expect(lastEwma.acwr! > 1.5).toBe(true)
    expect(lastEwma.flag).toBe('high_risk')
    // ...and the method option genuinely changes the maths.
    expect(lastEwma.acwr).not.toBe(rolling[rolling.length - 1].acwr)
  })

  test('EWMA acute load decays faster than chronic during a rest streak', () => {
    const loads = Array.from({ length: 28 }, (_, i) => day(addDays('2026-06-01', i), 1000))
    const restEnd = addDays(addDays('2026-06-01', 27), 10)
    const last = computeAcwrSeries(loads, { endDate: restEnd })[
      computeAcwrSeries(loads, { endDate: restEnd }).length - 1
    ]
    // Short acute time-constant collapses toward zero faster than the chronic one.
    expect(last.acute).toBeLessThan(last.chronic)
    expect(last.flag).toBe('detraining')
  })

  test('EWMA steady state still sits at ACWR ~1.0', () => {
    const loads = Array.from({ length: 40 }, (_, i) => day(addDays('2026-06-01', i), 1500))
    const last = computeAcwrSeries(loads)[39]
    expect(last.acwr).toBeCloseTo(1.0, 1)
    expect(last.flag).toBe('optimal')
  })

  test('rolling uncoupled chronic excludes the acute window', () => {
    // 21 light days then 7 heavy days. Coupled chronic includes the heavy week
    // (raising the denominator); uncoupled chronic uses only the prior light
    // weeks, so the same acute load reads as a larger ratio.
    const loads = [
      ...Array.from({ length: 21 }, (_, i) => day(addDays('2026-06-01', i), 100)),
      ...Array.from({ length: 7 }, (_, i) => day(addDays('2026-06-22', i), 1000)),
    ]
    const coupled = computeAcwrSeries(loads, { method: 'rolling', coupling: 'coupled' })
    const uncoupled = computeAcwrSeries(loads, { method: 'rolling', coupling: 'uncoupled' })
    const lc = coupled[coupled.length - 1]
    const lu = uncoupled[uncoupled.length - 1]
    expect(lu.acwr!).toBeGreaterThan(lc.acwr!)
  })
})
