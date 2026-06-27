import { describe, expect, test } from 'vitest'
import {
  computeCircadianProfile,
  computeCircadianScore,
  computeAlertnessCurve,
  computeCircadianWindows,
} from '@/shared/health/circadian'
import type { SleepRecord, DayType } from '@/shared/health/circadian'

// Build a sleeper who goes to bed ~00:00 and wakes ~08:00 (mid-sleep ≈ 04:00).
function nights(count: number, bedHour = 0, wakeHour = 8): SleepRecord[] {
  const out: SleepRecord[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(2026, 5, 1 + i)
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const bed = new Date(d)
    bed.setHours(bedHour, 0, 0, 0)
    // Bedtime before midnight belongs to the previous evening.
    if (bedHour >= 18) bed.setDate(bed.getDate() - 1)
    const wake = new Date(d)
    wake.setHours(wakeHour, 0, 0, 0)
    out.push({
      date,
      bedtime: bed.toISOString(),
      waketime: wake.toISOString(),
      timeAsleepHours: (wake.getTime() - bed.getTime()) / 3600000,
      efficiency: 0.9,
    })
  }
  return out
}

describe('computeCircadianProfile phase estimates', () => {
  test('DLMO precedes sleep onset and CTmin precedes wake', () => {
    const sessions = nights(10) // bed 00:00, wake 08:00, mid-sleep ≈ 04:00
    const profile = computeCircadianProfile(sessions, new Map())
    expect(profile.msfsc).not.toBeNull()
    expect(profile.dlmoEstimate).not.toBeNull()
    expect(profile.ctminEstimate).not.toBeNull()

    const dlmo = profile.dlmoEstimate!
    const ctmin = profile.ctminEstimate!

    // DLMO ≈ 2h before sleep onset (00:00) → ~22:00 the prior evening.
    expect(dlmo).toBeGreaterThan(21)
    expect(dlmo).toBeLessThan(23.5)

    // CTmin ≈ 2–3h before wake (08:00) → ~05:00, and crucially BEFORE wake.
    expect(ctmin).toBeGreaterThan(3.5)
    expect(ctmin).toBeLessThan(7) // never after the 08:00 wake time
  })

  test('CTmin sits ~7h after DLMO', () => {
    const profile = computeCircadianProfile(nights(10), new Map())
    let gap = profile.ctminEstimate! - profile.dlmoEstimate!
    if (gap < 0) gap += 24
    expect(gap).toBeCloseTo(7, 1)
  })
})

describe('computeAlertnessCurve', () => {
  test('alertness is lowest near CTmin', () => {
    const profile = computeCircadianProfile(nights(10), new Map())
    const curve = computeAlertnessCurve(profile, 8)
    const lowest = curve.reduce((a, b) => (b.alertness < a.alertness ? b : a))
    const ctmin = profile.ctminEstimate!
    let dist = Math.abs(lowest.hour - ctmin)
    if (dist > 12) dist = 24 - dist
    expect(dist).toBeLessThanOrEqual(2)
  })
})

describe('computeCircadianWindows', () => {
  test('morning exercise window opens shortly after wake', () => {
    const profile = computeCircadianProfile(nights(10), new Map())
    const w = computeCircadianWindows(profile, 8)
    expect(w.exerciseMorning).not.toBeNull()
    expect(w.exerciseMorning!.start).toBeCloseTo(8.5, 1)
  })
})

describe('computeCircadianScore', () => {
  test('regular adequate sleep scores well; null below 3 nights', () => {
    expect(computeCircadianScore(nights(2), 55, 55).total).toBeNull()
    const good = computeCircadianScore(nights(14), 52, 55)
    expect(good.total).not.toBeNull()
    expect(good.total!).toBeGreaterThan(60)
    expect(good.consistency).toBeGreaterThan(80)
  })

  test('irregular bedtimes lower the consistency component', () => {
    const irregular: SleepRecord[] = nights(14).map((s, i) => {
      const bed = new Date(s.bedtime)
      bed.setHours(bed.getHours() + (i % 2 === 0 ? -3 : 3))
      return { ...s, bedtime: bed.toISOString() }
    })
    const score = computeCircadianScore(irregular, 55, 55)
    expect(score.consistency).toBeLessThan(60)
  })
})

// dayTypes param is exercised so the free-day MSFsc branch is covered.
describe('social jetlag', () => {
  test('aligned work/free days yield low social jetlag', () => {
    const sessions = nights(14)
    const dayTypes = new Map<string, DayType>()
    sessions.forEach((s, i) => dayTypes.set(s.date, i % 7 < 5 ? 'work' : 'free'))
    const profile = computeCircadianProfile(sessions, dayTypes)
    expect(profile.socialJetlag).not.toBeNull()
    expect(profile.socialJetlag!).toBeLessThan(1)
  })
})
