import { describe, expect, test } from 'vitest'
import { evaluateOvertraining, acwrZoneLabel } from '@/shared/health/overtraining'
import type { OvertrainingInput } from '@/shared/health/overtraining'

describe('evaluateOvertraining', () => {
  test('empty input is green', () => {
    expect(evaluateOvertraining([]).status).toBe('green')
  })

  test('red: ACWR > 1.5 AND 2+ consecutive low-recovery days', () => {
    const points: OvertrainingInput[] = [
      { date: '2026-06-01', acwr: 1.0, recoveryZ: 0.2 },
      { date: '2026-06-02', acwr: 1.6, recoveryZ: -1.3 },
      { date: '2026-06-03', acwr: 1.7, recoveryZ: -1.4 },
    ]
    const res = evaluateOvertraining(points)
    expect(res.status).toBe('red')
    expect(res.overreaching).toBe(true)
    expect(res.consecutiveLowRecovery).toBe(2)
  })

  test('yellow: high ACWR but recovery fine', () => {
    const points: OvertrainingInput[] = [
      { date: '2026-06-02', acwr: 1.6, recoveryZ: 0.1 },
      { date: '2026-06-03', acwr: 1.7, recoveryZ: 0.0 },
    ]
    const res = evaluateOvertraining(points)
    expect(res.status).toBe('yellow')
    expect(res.overreaching).toBe(false)
  })

  test('yellow: sustained low recovery but ACWR optimal', () => {
    const points: OvertrainingInput[] = [
      { date: '2026-06-02', acwr: 1.0, recoveryZ: -1.2 },
      { date: '2026-06-03', acwr: 1.05, recoveryZ: -1.5 },
    ]
    const res = evaluateOvertraining(points)
    expect(res.status).toBe('yellow')
  })

  test('not red when only one low-recovery day despite high ACWR', () => {
    const points: OvertrainingInput[] = [
      { date: '2026-06-02', acwr: 1.7, recoveryZ: 0.5 },
      { date: '2026-06-03', acwr: 1.7, recoveryZ: -1.4 },
    ]
    const res = evaluateOvertraining(points)
    expect(res.consecutiveLowRecovery).toBe(1)
    expect(res.status).toBe('yellow') // high ACWR alone → yellow, not red
  })

  test('green: balanced load and recovery', () => {
    const points: OvertrainingInput[] = [
      { date: '2026-06-02', acwr: 1.0, recoveryZ: 0.3 },
      { date: '2026-06-03', acwr: 1.1, recoveryZ: 0.1 },
    ]
    expect(evaluateOvertraining(points).status).toBe('green')
  })

  test('uses latest non-null ACWR when the very last day lacks one', () => {
    const points: OvertrainingInput[] = [
      { date: '2026-06-02', acwr: 1.6, recoveryZ: -1.3 },
      { date: '2026-06-03', acwr: null, recoveryZ: -1.4 },
    ]
    const res = evaluateOvertraining(points)
    expect(res.acwr).toBe(1.6)
    expect(res.status).toBe('red')
  })
})

describe('acwrZoneLabel', () => {
  test('maps values to labels', () => {
    expect(acwrZoneLabel(null)).toBe('—')
    expect(acwrZoneLabel(0.7)).toBe('Detraining')
    expect(acwrZoneLabel(1.0)).toBe('Optimal')
    expect(acwrZoneLabel(1.4)).toBe('Caution')
    expect(acwrZoneLabel(1.8)).toBe('High risk')
  })
})
