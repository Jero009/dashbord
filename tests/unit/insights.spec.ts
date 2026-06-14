import { describe, expect, test } from 'vitest'
import {
  mean,
  pearson,
  computeTrainingLoad,
  computeRecoveryRecommendation,
  computeInsights,
  type DatedValue,
} from '@/shared/health/insights'

// Helper: build a date-keyed series counting forward from a start date.
function series(start: string, values: number[]): DatedValue[] {
  const out: DatedValue[] = []
  const d = new Date(start + 'T00:00:00')
  for (const value of values) {
    const key = d.toISOString().slice(0, 10)
    out.push({ date: key, value })
    d.setDate(d.getDate() + 1)
  }
  return out
}

describe('numeric helpers', () => {
  test('mean of empty array is 0', () => {
    expect(mean([])).toBe(0)
  })

  test('pearson detects perfect positive correlation', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 5)
  })

  test('pearson detects perfect negative correlation', () => {
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 5)
  })

  test('pearson returns null on too few points or zero variance', () => {
    expect(pearson([1, 2], [1, 2])).toBeNull()
    expect(pearson([5, 5, 5], [1, 2, 3])).toBeNull()
  })
})

describe('computeTrainingLoad', () => {
  test('insufficient history reports insufficient', () => {
    const load = computeTrainingLoad(series('2026-06-01', [100, 200, 300]))
    expect(load.status).toBe('insufficient')
    expect(load.acwr).toBe(0)
  })

  test('steady load over 28 days is optimal with acwr near 1', () => {
    const load = computeTrainingLoad(series('2026-05-18', Array(28).fill(100)))
    expect(load.status).toBe('optimal')
    expect(load.acwr).toBeCloseTo(1, 1)
  })

  test('spiking recent load flags high', () => {
    const vals = [...Array(21).fill(50), ...Array(7).fill(400)]
    const load = computeTrainingLoad(series('2026-05-18', vals))
    expect(load.status).toBe('high')
    expect(load.acwr).toBeGreaterThan(1.5)
  })
})

describe('computeRecoveryRecommendation', () => {
  test('good markers → train', () => {
    const rec = computeRecoveryRecommendation({
      rhrToday: 50, rhrBaseline: 50, readinessToday: 80, acwr: 1.0,
    })
    expect(rec.level).toBe('train')
  })

  test('low readiness → recover', () => {
    const rec = computeRecoveryRecommendation({
      rhrToday: 50, rhrBaseline: 50, readinessToday: 40, acwr: 1.0,
    })
    expect(rec.level).toBe('recover')
  })

  test('elevated RHR with high load → recover', () => {
    const rec = computeRecoveryRecommendation({
      rhrToday: 60, rhrBaseline: 50, readinessToday: 70, acwr: 1.8,
    })
    expect(rec.level).toBe('recover')
  })

  test('elevated RHR alone → maintain', () => {
    const rec = computeRecoveryRecommendation({
      rhrToday: 56, rhrBaseline: 50, readinessToday: 70, acwr: 1.0,
    })
    expect(rec.level).toBe('maintain')
  })

  test('null inputs default to train', () => {
    const rec = computeRecoveryRecommendation({
      rhrToday: null, rhrBaseline: null, readinessToday: null, acwr: null,
    })
    expect(rec.level).toBe('train')
  })
})

describe('computeInsights', () => {
  test('empty input yields no insights', () => {
    expect(computeInsights({ sleepHours: [], rhr: [], readiness: [], dailyVolume: [] })).toEqual([])
  })

  test('positive sleep↔volume correlation surfaces a positive insight', () => {
    const sleepHours = series('2026-06-01', [6, 6.5, 7, 7.5, 8, 8.5, 9])
    const dailyVolume = series('2026-06-01', [1000, 1500, 2000, 2500, 3000, 3500, 4000])
    const out = computeInsights({ sleepHours, rhr: [], readiness: [], dailyVolume })
    expect(out.some((i) => i.id === 'sleep-volume' && i.tone === 'positive')).toBe(true)
  })

  test('low sleep week surfaces a warning, ordered first', () => {
    const sleepHours = series('2026-06-01', [5, 5.5, 6, 5.8, 6.2, 5.9, 6.1])
    const out = computeInsights({ sleepHours, rhr: [], readiness: [], dailyVolume: [] })
    expect(out[0].tone).toBe('warning')
    expect(out.some((i) => i.id === 'sleep-low')).toBe(true)
  })

  test('rising RHR trend surfaces a warning', () => {
    const rhr = series('2026-06-01', [50, 50, 51, 50, 56, 57, 58])
    const out = computeInsights({ sleepHours: [], rhr, readiness: [], dailyVolume: [] })
    expect(out.some((i) => i.id === 'rhr-up')).toBe(true)
  })
})
