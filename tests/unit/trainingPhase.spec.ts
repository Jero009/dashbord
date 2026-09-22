import { describe, it, expect } from 'vitest'
import {
  cycleWeek,
  isDeloadWeek,
  deloadWeightFor,
  deloadNotice,
  DELOAD_FACTOR,
} from '@/shared/utils/trainingPhase'

// Fixed "now" helper — all dates local (the helper parses local components).
const at = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

describe('cycleWeek', () => {
  it('week 1 on the cycle start Monday', () => {
    expect(cycleWeek(at('2026-09-07'))?.week).toBe(1)
  })

  it('weeks 3/6/9/12 are deloads', () => {
    // Cycle 1 starts Mon 2026-09-07 → week 3 = Mon 2026-09-21.
    expect(cycleWeek(at('2026-09-21'))).toMatchObject({ week: 3, isDeload: true })
    expect(cycleWeek(at('2026-09-27'))).toMatchObject({ week: 3, isDeload: true }) // Sunday
    // Week 6 = Mon 2026-10-12. Week 9 = Mon 2026-11-02.
    expect(cycleWeek(at('2026-10-12'))).toMatchObject({ week: 6, isDeload: true })
    expect(cycleWeek(at('2026-11-02'))).toMatchObject({ week: 9, isDeload: true })
    // Cycle 2 starts Mon 2026-12-07 → week 12 = Mon 2027-02-22.
    expect(cycleWeek(at('2027-02-22'))).toMatchObject({ week: 12, isDeload: true })
  })

  it('build weeks are not deloads', () => {
    expect(cycleWeek(at('2026-09-22'))).toMatchObject({ week: 3, isDeload: true }) // today IS deload
    expect(cycleWeek(at('2026-09-29'))).toMatchObject({ week: 4, isDeload: false })
    expect(cycleWeek(at('2026-11-03'))).toMatchObject({ week: 9, isDeload: true }) // Tuesday same week
    expect(cycleWeek(at('2026-10-19'))).toMatchObject({ week: 7, isDeload: false })
  })

  it('13th week is the review week (not a deload)', () => {
    expect(cycleWeek(at('2026-11-30'))).toMatchObject({ week: 13, isDeload: false })
  })

  it('null after the last cycle ends', () => {
    // Cycles 1→2→3 are back-to-back (Dec 7 / Mar 8 starts) — no gap.
    // Cycle 3 review week ends 2027-06-06 → null after.
    expect(cycleWeek(at('2027-06-15'))).toBeNull()
  })

  it('week 13 boundary: day 90 in, day 91 out', () => {
    // Cycle 1: start Sep 7. Day 90 = Dec 6 (last review day), day 91 = Dec 7.
    expect(cycleWeek(at('2026-12-06'))).not.toBeNull()
    expect(cycleWeek(at('2026-12-07'))).toMatchObject({ week: 1 }) // next cycle's day 0
  })
})

describe('isDeloadWeek', () => {
  it('true on deload weeks, false otherwise, false between cycles', () => {
    expect(isDeloadWeek(at('2026-09-21'))).toBe(true)
    expect(isDeloadWeek(at('2026-09-23'))).toBe(true)
    expect(isDeloadWeek(at('2026-09-29'))).toBe(false)
    expect(isDeloadWeek(at('2026-12-01'))).toBe(false) // review week
  })
})

describe('deloadWeightFor', () => {
  it('scales to ~67.5% and rounds DOWN to 2.5 kg steps', () => {
    expect(deloadWeightFor(80)).toBe(52.5) // 54.0 → floor(54/2.5)*2.5 = 52.5
    expect(deloadWeightFor(100)).toBe(67.5) // exactly on a 2.5 step
    expect(deloadWeightFor(35)).toBe(22.5) // 23.625 → 22.5
  })

  it('floors, never rounds up (err light on a deload)', () => {
    // 82.5 * 0.675 = 55.6875 → 55.0 (floor to 2.5), NOT 57.5.
    expect(deloadWeightFor(82.5)).toBe(55)
  })

  it('rejects zero/negative/garbage', () => {
    expect(deloadWeightFor(0)).toBeNull()
    expect(deloadWeightFor(-80)).toBeNull()
    expect(deloadWeightFor(NaN)).toBeNull()
  })

  it('never returns less than the empty-bar minimum', () => {
    expect(deloadWeightFor(2.5)).toBeGreaterThanOrEqual(2.5)
  })
})

describe('deloadNotice', () => {
  it('names the week on deload weeks', () => {
    expect(deloadNotice(at('2026-09-21'))).toBe('Deload week (week 3) — suggest ~68% of last time')
  })

  it('null on build weeks and between cycles', () => {
    expect(deloadNotice(at('2026-09-29'))).toBeNull()
    expect(deloadNotice(at('2026-12-01'))).toBeNull()
  })

  it('DELOAD_FACTOR stays inside the plan’s 65–70% band', () => {
    expect(DELOAD_FACTOR).toBeGreaterThanOrEqual(0.65)
    expect(DELOAD_FACTOR).toBeLessThanOrEqual(0.70)
  })
})
