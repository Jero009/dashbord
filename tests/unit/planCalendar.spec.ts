import { describe, it, expect } from 'vitest'
import {
  planDayIndex,
  planWeek,
  planWeeksTotal,
  deloadWeekNumbers,
  deloadDates,
  isPlanDeloadWeek,
  nextDeloadDate,
  adherenceFor,
  addDays,
  type PlanConfig,
  type PauseSpan,
} from '@/shared/utils/planCalendar'

// All expected values hand-verified with python date math before pinning.
const at = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// 12-week plan: Mon 2026-09-07 → Sun 2026-11-29 (84 days), deloads every 3 wks.
const PLAN: PlanConfig = {
  startDate: '2026-09-07',
  endDate: '2026-11-29',
  deloadEveryWeeks: 3,
}

const CLOSED_PAUSE: PauseSpan = { startDate: '2026-09-24', endDate: '2026-09-29' } // 6 days

describe('planDayIndex', () => {
  it('is the wall day offset before any pauses', () => {
    expect(planDayIndex(PLAN, [], '2026-09-07')).toBe(0)
    expect(planDayIndex(PLAN, [], '2026-09-23')).toBe(16)
  })

  it('is null before the plan and after the (unpaused) end', () => {
    expect(planDayIndex(PLAN, [], '2026-09-06')).toBeNull()
    expect(planDayIndex(PLAN, [], '2026-11-30')).toBeNull()
  })

  it('subtracts completed pause days (frozen days share one index)', () => {
    // Pause 09-24..09-29: each frozen day maps to 09-24's index (17).
    expect(planDayIndex(PLAN, [CLOSED_PAUSE], '2026-09-24')).toBe(17)
    expect(planDayIndex(PLAN, [CLOSED_PAUSE], '2026-09-27')).toBe(17)
    expect(planDayIndex(PLAN, [CLOSED_PAUSE], '2026-09-30')).toBe(17)
    // Clock resumes: 10-01 has index 18.
    expect(planDayIndex(PLAN, [CLOSED_PAUSE], '2026-10-01')).toBe(18)
  })

  it('extends the plan end by the paused days (end slides)', () => {
    // 6 paused days → effective end = 2026-12-05, index 83.
    expect(planDayIndex(PLAN, [CLOSED_PAUSE], '2026-12-05')).toBe(83)
    expect(planDayIndex(PLAN, [CLOSED_PAUSE], '2026-12-06')).toBeNull()
  })
})

describe('planWeek', () => {
  it('1-based week from the wall clock, no pauses', () => {
    expect(planWeek(PLAN, [], at('2026-09-07'))).toBe(1)
    // Sunday 09-20 is still week 2; Monday 09-21 starts week 3.
    expect(planWeek(PLAN, [], at('2026-09-20'))).toBe(2)
    expect(planWeek(PLAN, [], at('2026-09-21'))).toBe(3)
    expect(planWeek(PLAN, [], at('2026-09-23'))).toBe(3)
  })

  it('pause shifts the clock: 09-30 equals 09-24\'s week', () => {
    expect(planWeek(PLAN, [CLOSED_PAUSE], at('2026-09-24'))).toBe(3)
    expect(planWeek(PLAN, [CLOSED_PAUSE], at('2026-09-30'))).toBe(3)
  })

  it('open pause freezes the week at the pause start', () => {
    const open: PauseSpan[] = [{ startDate: '2026-09-24', endDate: null }]
    expect(planWeek(PLAN, open, at('2026-09-24'))).toBe(3)
    expect(planWeek(PLAN, open, at('2026-10-05'))).toBe(3)
  })

  it('null outside the plan window', () => {
    expect(planWeek(PLAN, [], at('2026-09-01'))).toBeNull()
    expect(planWeek(PLAN, [], at('2026-12-15'))).toBeNull()
  })
})

describe('planWeeksTotal', () => {
  it('84 days = 12 weeks, pauses never change the total', () => {
    expect(planWeeksTotal(PLAN, [])).toBe(12)
    expect(planWeeksTotal(PLAN, [CLOSED_PAUSE])).toBe(12)
  })
})

describe('deloadWeekNumbers', () => {
  it('every Nth week: N=3 on 12 weeks ⇒ {3,6,9,12}', () => {
    expect(deloadWeekNumbers(PLAN)).toEqual(new Set([3, 6, 9, 12]))
  })

  it('N=0 disables deloads ⇒ empty set', () => {
    expect(deloadWeekNumbers({ ...PLAN, deloadEveryWeeks: 0 })).toEqual(new Set())
  })

  it('partial trailing week is not a deload', () => {
    // 10-week plan, N=3 ⇒ deloads 3, 6, 9 — never 12.
    expect(deloadWeekNumbers({ ...PLAN, endDate: '2026-11-15' })).toEqual(new Set([3, 6, 9]))
  })
})

describe('deloadDates', () => {
  it('without pauses: week starts of each deload week', () => {
    expect(deloadDates(PLAN, [])).toEqual(['2026-09-21', '2026-10-12', '2026-11-02', '2026-11-23'])
  })

  it('deload weeks after the pause slide by the paused days; earlier ones keep their date', () => {
    // Week 3 (09-21) is before the pause — it already happened, it cannot move.
    // Weeks 6/9/12 shift +6d: 10-18, 11-08, 11-29.
    expect(deloadDates(PLAN, [CLOSED_PAUSE])).toEqual(['2026-09-21', '2026-10-18', '2026-11-08', '2026-11-29'])
  })
})

describe('isPlanDeloadWeek', () => {
  it('true in deload weeks, false in build weeks', () => {
    expect(isPlanDeloadWeek(PLAN, [], at('2026-09-23'))).toBe(true) // week 3
    expect(isPlanDeloadWeek(PLAN, [], at('2026-09-29'))).toBe(false) // week 4
  })

  it('respects the paused clock: 09-30 is still deload week 3', () => {
    expect(isPlanDeloadWeek(PLAN, [CLOSED_PAUSE], at('2026-09-30'))).toBe(true)
  })
})

describe('nextDeloadDate', () => {
  it('next deload strictly after now', () => {
    expect(nextDeloadDate(PLAN, [], at('2026-09-23'))).toBe('2026-10-12')
    // Strictly after: on the deload start itself the NEXT one is returned.
    expect(nextDeloadDate(PLAN, [], at('2026-09-21'))).toBe('2026-10-12')
  })

  it('skips paused days', () => {
    // With the 6-day pause, week 6 lands 10-18 instead of 10-12.
    expect(nextDeloadDate(PLAN, [CLOSED_PAUSE], at('2026-09-30'))).toBe('2026-10-18')
  })

  it('null when no deload remains', () => {
    expect(nextDeloadDate(PLAN, [], at('2026-11-24'))).toBeNull()
    expect(nextDeloadDate({ ...PLAN, deloadEveryWeeks: 0 }, [], at('2026-09-23'))).toBeNull()
  })
})

describe('adherenceFor', () => {
  it('expectedByNow = whole elapsed weeks × expectedPerWeek', () => {
    // 09-23 = index 16 → floor(17/7) = 2 elapsed weeks.
    expect(adherenceFor(6, 4, PLAN, [], at('2026-09-23'))).toEqual({ expectedByNow: 8, completion: 0.75 })
  })

  it('expectedByNow excludes paused days', () => {
    // 10-05 with the 6-day pause → index 22 → 3 elapsed weeks (4 without pause).
    expect(adherenceFor(12, 4, PLAN, [CLOSED_PAUSE], at('2026-10-05')).expectedByNow).toBe(12)
  })

  it('open pause freezes expectedByNow', () => {
    const open: PauseSpan[] = [{ startDate: '2026-09-24', endDate: null }]
    // Frozen at index 17 → 2 elapsed weeks → 8 expected.
    expect(adherenceFor(8, 4, PLAN, open, at('2026-10-05')).expectedByNow).toBe(8)
  })

  it('completion never exceeds 1', () => {
    expect(adherenceFor(100, 4, PLAN, [], at('2026-09-23')).completion).toBe(1)
  })

  it('two pauses both subtract from the elapsed clock', () => {
    // Verified: wall index 55 on 2026-11-01, pauses 6 + 3 days → index 46 → 6 elapsed weeks.
    const pauses: PauseSpan[] = [CLOSED_PAUSE, { startDate: '2026-10-20', endDate: '2026-10-22' }]
    expect(adherenceFor(20, 4, PLAN, pauses, at('2026-11-01'))).toEqual({ expectedByNow: 24, completion: 20 / 24 })
  })

  it('zero expected before the plan starts', () => {
    expect(adherenceFor(5, 4, PLAN, [], at('2026-09-01'))).toEqual({ expectedByNow: 0, completion: 0 })
  })
})

describe('addDays', () => {
  it('crosses month boundaries safely (local, no UTC drift)', () => {
    expect(addDays('2026-09-30', 6)).toBe('2026-10-06')
    expect(addDays('2026-11-29', 6)).toBe('2026-12-05')
  })

  it('handles negative days and year boundaries', () => {
    expect(addDays('2026-09-07', -1)).toBe('2026-09-06')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01') // 2027 not a leap year
  })
})

describe('year boundary plan', () => {
  // 12-week plan Mon 2026-11-20 → Thu 2027-02-11.
  const WINTER: PlanConfig = { startDate: '2026-11-20', endDate: '2027-02-11', deloadEveryWeeks: 4 }

  it('week math is correct across New Year', () => {
    expect(planWeek(WINTER, [], at('2026-11-20'))).toBe(1)
    expect(planWeek(WINTER, [], at('2026-12-25'))).toBe(6)
    expect(planWeek(WINTER, [], at('2027-01-15'))).toBe(9)
    expect(planWeek(WINTER, [], at('2027-02-11'))).toBe(12)
  })

  it('deloads land in January', () => {
    expect(deloadWeekNumbers(WINTER)).toEqual(new Set([4, 8, 12]))
    expect(deloadDates(WINTER, [])).toEqual(['2026-12-11', '2027-01-08', '2027-02-05'])
  })
})
