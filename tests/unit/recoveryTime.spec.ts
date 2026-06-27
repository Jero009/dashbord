import { describe, expect, test } from 'vitest'
import {
  estimateRecoveryHours,
  recoveryTimeStatus,
  recoveryTimeLabel,
  aggregateLatestTrainingDay,
} from '@/shared/health/recoveryTime'
import type { SessionForRecovery } from '@/shared/health/recoveryTime'

describe('estimateRecoveryHours', () => {
  test('hard RPE session at neutral recovery/sleep ~ 2 days', () => {
    // RPE 8 × 60 min = 480 sRPE → 480/12.5 = 38.4 → 38 h
    const est = estimateRecoveryHours({ rpeLoad: 480, volumeLoad: 5000, recoveryZ: null, sleepScore: null })
    expect(est.basis).toBe('rpe')
    expect(est.totalHours).toBe(38)
  })

  test('prefers sRPE over volume when both present', () => {
    const est = estimateRecoveryHours({ rpeLoad: 240, volumeLoad: 50000, recoveryZ: null, sleepScore: null })
    expect(est.basis).toBe('rpe')
    expect(est.totalHours).toBe(Math.round(240 / 12.5))
  })

  test('falls back to volume when no RPE', () => {
    // 10 000 kg → 10000/280 ≈ 35.7 → 36 h
    const est = estimateRecoveryHours({ rpeLoad: null, volumeLoad: 10000, recoveryZ: null, sleepScore: null })
    expect(est.basis).toBe('volume')
    expect(est.totalHours).toBe(36)
  })

  test('no load → zero hours', () => {
    const est = estimateRecoveryHours({ rpeLoad: null, volumeLoad: 0, recoveryZ: null, sleepScore: null })
    expect(est.basis).toBe('none')
    expect(est.totalHours).toBe(0)
  })

  test('poor recovery and poor sleep lengthen the time', () => {
    const base = estimateRecoveryHours({ rpeLoad: 480, volumeLoad: 0, recoveryZ: null, sleepScore: null })
    const worse = estimateRecoveryHours({ rpeLoad: 480, volumeLoad: 0, recoveryZ: -2, sleepScore: 50 })
    expect(worse.recoveryMultiplier).toBeGreaterThan(1)
    expect(worse.sleepMultiplier).toBeGreaterThan(1)
    expect(worse.totalHours).toBeGreaterThan(base.totalHours)
  })

  test('good recovery and good sleep shorten the time', () => {
    const base = estimateRecoveryHours({ rpeLoad: 480, volumeLoad: 0, recoveryZ: null, sleepScore: null })
    const better = estimateRecoveryHours({ rpeLoad: 480, volumeLoad: 0, recoveryZ: 1.5, sleepScore: 95 })
    expect(better.recoveryMultiplier).toBeLessThan(1)
    expect(better.sleepMultiplier).toBeLessThan(1)
    expect(better.totalHours).toBeLessThan(base.totalHours)
  })

  test('modifiers are clamped to sane bounds', () => {
    const extreme = estimateRecoveryHours({ rpeLoad: 480, volumeLoad: 0, recoveryZ: -10, sleepScore: 0 })
    expect(extreme.recoveryMultiplier).toBeLessThanOrEqual(1.4)
    expect(extreme.sleepMultiplier).toBeLessThanOrEqual(1.3)
    expect(extreme.totalHours).toBeLessThanOrEqual(96)
  })
})

describe('recoveryTimeLabel', () => {
  test('formats across ranges', () => {
    expect(recoveryTimeLabel(0)).toBe('Recovered')
    expect(recoveryTimeLabel(0.5)).toBe('<1h')
    expect(recoveryTimeLabel(18)).toBe('18h')
    expect(recoveryTimeLabel(28)).toBe('1d 4h')
    expect(recoveryTimeLabel(48)).toBe('2d')
  })
})

describe('recoveryTimeStatus', () => {
  const end = '2026-06-27T10:00:00.000Z'

  test('counts down from the session end', () => {
    // 38 h total; 8 h elapsed → ~30 h remaining
    const now = new Date('2026-06-27T18:00:00.000Z')
    const st = recoveryTimeStatus(
      { rpeLoad: 480, volumeLoad: 0, recoveryZ: null, sleepScore: null },
      end,
      now
    )
    expect(st.totalHours).toBe(38)
    expect(st.remainingHours).toBeCloseTo(30, 0)
    expect(st.recovered).toBe(false)
    expect(st.readyAt).toBe(new Date(new Date(end).getTime() + 38 * 3600000).toISOString())
  })

  test('recovered once enough time has passed', () => {
    const now = new Date('2026-06-30T10:00:00.000Z') // 72 h later
    const st = recoveryTimeStatus(
      { rpeLoad: 480, volumeLoad: 0, recoveryZ: null, sleepScore: null },
      end,
      now
    )
    expect(st.remainingHours).toBe(0)
    expect(st.recovered).toBe(true)
    expect(st.label).toBe('Recovered')
  })

  test('no session → recovered', () => {
    const st = recoveryTimeStatus({ rpeLoad: null, volumeLoad: 0, recoveryZ: null, sleepScore: null }, null)
    expect(st.recovered).toBe(true)
    expect(st.label).toBe('Recovered')
  })

  test('missing end time reports full estimate without a countdown', () => {
    const st = recoveryTimeStatus({ rpeLoad: 480, volumeLoad: 0, recoveryZ: null, sleepScore: null }, null)
    expect(st.readyAt).toBeNull()
    expect(st.remainingHours).toBe(st.totalHours)
    expect(st.recovered).toBe(false)
  })
})

describe('aggregateLatestTrainingDay', () => {
  const mk = (date: string, rpe: number | null, dur: number | null, vol: number, end: string | null): SessionForRecovery => ({
    date,
    time_end: end,
    session_rpe: rpe,
    duration_minutes: dur,
    volume: vol,
  })

  test('picks the most recent day with load', () => {
    const sessions = [
      mk('2026-06-20', 7, 50, 4000, '2026-06-20T11:00:00Z'),
      mk('2026-06-25', 8, 60, 6000, '2026-06-25T19:00:00Z'),
    ]
    const day = aggregateLatestTrainingDay(sessions)
    expect(day?.date).toBe('2026-06-25')
    expect(day?.rpeLoad).toBe(480)
    expect(day?.volumeLoad).toBe(6000)
    expect(day?.sessionEndIso).toBe('2026-06-25T19:00:00Z')
  })

  test('sums two-a-days and takes the latest end time', () => {
    const sessions = [
      mk('2026-06-25', 6, 30, 2000, '2026-06-25T08:00:00Z'),
      mk('2026-06-25', 8, 45, 3000, '2026-06-25T18:00:00Z'),
    ]
    const day = aggregateLatestTrainingDay(sessions)
    expect(day?.rpeLoad).toBe(6 * 30 + 8 * 45)
    expect(day?.volumeLoad).toBe(5000)
    expect(day?.sessionEndIso).toBe('2026-06-25T18:00:00Z')
  })

  test('rpeLoad null when the day had no RPE, volume still counts', () => {
    const sessions = [mk('2026-06-25', null, null, 4000, '2026-06-25T18:00:00Z')]
    const day = aggregateLatestTrainingDay(sessions)
    expect(day?.rpeLoad).toBeNull()
    expect(day?.volumeLoad).toBe(4000)
  })

  test('returns null when there is no load', () => {
    expect(aggregateLatestTrainingDay([])).toBeNull()
    expect(aggregateLatestTrainingDay([mk('2026-06-25', null, null, 0, null)])).toBeNull()
  })
})
