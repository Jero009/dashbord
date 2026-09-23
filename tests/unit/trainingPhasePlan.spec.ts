import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the DB layer BEFORE importing the module under test — the override
// resolution reads the active plan through app_db's getActivePlan/getPausesForPlan.
vi.mock('@/shared/db/app_db', () => ({
  getActivePlan: vi.fn(),
  getPausesForPlan: vi.fn(),
  planConfigOf: (plan: any) => ({
    startDate: plan.start_date,
    endDate: plan.end_date,
    deloadEveryWeeks: plan.deload_every_weeks,
  }),
  pauseSpansOf: (pauses: any[]) => pauses.map((p) => ({ startDate: p.start_date, endDate: p.end_date ?? null })),
}))

import { getActivePlan, getPausesForPlan } from '@/shared/db/app_db'
import {
  initResolvedPlan,
  invalidatePlanCache,
  resolvedDeloadConfig,
} from '@/shared/utils/trainingPhase'

const at = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const mockedGetActivePlan = vi.mocked(getActivePlan)
const mockedGetPauses = vi.mocked(getPausesForPlan)

// 12-week plan Mon 2026-09-07 → Sun 2026-11-29, deload every 3 wks @ 60%.
const PLAN = {
  id: 1,
  name: 'Autumn block',
  goal: 'Squat 140',
  start_date: '2026-09-07',
  end_date: '2026-11-29',
  deload_every_weeks: 3,
  deload_factor: 0.6,
  template_ids: [1, 2],
  archived: 0,
}

describe('resolvedDeloadConfig — plan override', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidatePlanCache()
    mockedGetPauses.mockResolvedValue([])
  })

  it('plan covering today drives weeks + factor (week 3 = deload @ 60%)', async () => {
    mockedGetActivePlan.mockResolvedValue(PLAN as any)
    await initResolvedPlan()
    const cfg = await resolvedDeloadConfig(at('2026-09-23'))
    expect(cfg.isDeload).toBe(true)
    expect(cfg.weekOfPlan).toBe(3)
    expect(cfg.factor).toBe(0.6)
    expect(cfg.deloadWeeks.has(3)).toBe(true)
    expect(cfg.label).toContain('Autumn block')
  })

  it('build weeks are not deloads', async () => {
    mockedGetActivePlan.mockResolvedValue(PLAN as any)
    await initResolvedPlan()
    const cfg = await resolvedDeloadConfig(at('2026-09-29')) // week 4
    expect(cfg.isDeload).toBe(false)
    expect(cfg.weekOfPlan).toBe(4)
  })

  it('paused plan: open pause freezes the week; label notes the pause', async () => {
    mockedGetActivePlan.mockResolvedValue(PLAN as any)
    mockedGetPauses.mockResolvedValue([
      { id: 7, id_plan: 1, reason: 'sick', note: null, start_date: '2026-09-24', end_date: null },
    ] as any)
    await initResolvedPlan()
    // Queried 10-05 → frozen at week 3, still a deload week on the frozen clock.
    const cfg = await resolvedDeloadConfig(at('2026-10-05'))
    expect(cfg.weekOfPlan).toBe(3)
    expect(cfg.isDeload).toBe(true)
    expect(cfg.label).toContain('paused')
  })

  it('no active plan ⇒ null planWeek with CYCLES fallback intact', async () => {
    mockedGetActivePlan.mockResolvedValue(null)
    await initResolvedPlan()
    const cfg = await resolvedDeloadConfig(at('2026-09-23'))
    expect(cfg.weekOfPlan).toBeNull()
    expect(cfg.isDeload).toBe(true) // CYCLES: 2026-09-23 is cycle week 3
    expect(cfg.factor).toBe(0.675)
    expect(cfg.deloadWeeks.has(3)).toBe(true)
  })

  it('plan that does not cover today ⇒ CYCLES fallback', async () => {
    // getActivePlan itself filters by coverage — it returns null here.
    mockedGetActivePlan.mockResolvedValue(null)
    await initResolvedPlan()
    const cfg = await resolvedDeloadConfig(at('2027-06-15')) // between cycles anyway
    expect(cfg.weekOfPlan).toBeNull()
    expect(cfg.isDeload).toBe(false)
  })

  it('deloadWeightForConfig uses the resolved plan factor', async () => {
    mockedGetActivePlan.mockResolvedValue(PLAN as any)
    await initResolvedPlan()
    // 80 kg × 0.60 → exactly 48 (on a 2.5 step; 0.6*80 float noise rounds via floor).
    const { deloadWeightForConfig } = await import('@/shared/utils/trainingPhase')
    expect(await deloadWeightForConfig(80, at('2026-09-23'))).toBe(47.5)
    expect(await deloadWeightForConfig(100, at('2026-09-23'))).toBe(60)
  })
})
