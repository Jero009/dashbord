import { describe, expect, test } from 'vitest'
import {
  mean,
  pearson,
  computeInsights,
  type DatedValue,
} from '@/shared/health/insights'
import { computeTodayRecovery } from '@/shared/health/todayRecovery'
import type { SessionLoadInput } from '@/shared/health/trainingLoad'

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

// ── computeTodayRecovery (shared Home/Analytics verdict) ─────────────────────

function sessions(days: string[], volume: number): SessionLoadInput[] {
  return days.map((date) => ({ date, volumeLoad: volume, durationMinutes: 60, sessionRpe: null }))
}

// 28 days ending 2026-06-28: 3 weeks light, final week heavy (ACWR spike).
const TRAINED = Array.from({ length: 28 }, (_, i) => {
  const d = new Date('2026-06-01T00:00:00')
  d.setDate(d.getDate() + i)
  return d.toISOString().slice(0, 10)
})
const LIGHT = sessions(TRAINED.slice(0, 21), 1000)
const SPIKE = sessions(TRAINED.slice(21), 12000)

describe('computeTodayRecovery', () => {
  test('no training history → null (chip hides)', () => {
    const out = computeTodayRecovery({ sessions: [], rhr: [], readiness: [], today: '2026-06-28' })
    expect(out).toBeNull()
  })

  test('steady light load + good markers → train', () => {
    const rhr = series('2026-06-01', Array(28).fill(50))
    const readiness = series('2026-06-01', Array(28).fill(80))
    const out = computeTodayRecovery({ sessions: LIGHT, rhr, readiness, today: '2026-06-28' })
    expect(out?.level).toBe('train')
  })

  test('load spike with suppressed RHR → recover', () => {
    // RHR flat then climbing the final week (z ≤ −1 vs trailing baseline).
    const rhrVals = [...Array(21).fill(50), 54, 56, 58, 60, 62, 64, 66]
    const rhr = series('2026-06-01', rhrVals)
    const readiness = series('2026-06-01', Array(28).fill(80))
    const out = computeTodayRecovery({ sessions: [...LIGHT, ...SPIKE], rhr, readiness, today: '2026-06-28' })
    expect(out?.level).toBe('recover')
  })

  test('low readiness alone → recover', () => {
    const rhr = series('2026-06-01', Array(28).fill(50))
    const readiness = series('2026-06-01', [...Array(27).fill(80), 40])
    const out = computeTodayRecovery({ sessions: LIGHT, rhr, readiness, today: '2026-06-28' })
    expect(out?.level).toBe('recover')
  })

  test('moderate readiness alone → maintain', () => {
    const rhr = series('2026-06-01', Array(28).fill(50))
    const readiness = series('2026-06-01', [...Array(27).fill(80), 50])
    const out = computeTodayRecovery({ sessions: LIGHT, rhr, readiness, today: '2026-06-28' })
    expect(out?.level).toBe('maintain')
  })
})
