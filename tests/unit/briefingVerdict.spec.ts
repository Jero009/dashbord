import { describe, it, expect } from 'vitest'
import { resolveBriefingVerdict } from '@/shared/utils/briefingVerdict'

describe('resolveBriefingVerdict — plan is the source of truth', () => {
  it('deload week overrides whatever Hermes said', () => {
    const r = resolveBriefingVerdict({ plan: { isDeload: true, weekOfPlan: 3 }, hermesLevel: 'push' })
    expect(r).toEqual({
      level: 'deload',
      verdict: 'HOLD · deload week (week 3)',
      fromPlan: true,
    })
  })

  it('deload week overrides even when Hermes has no level', () => {
    const r = resolveBriefingVerdict({ plan: { isDeload: true, weekOfPlan: 6 }, hermesLevel: null })
    expect(r.level).toBe('deload')
    expect(r.verdict).toBe('HOLD · deload week (week 6)')
    expect(r.fromPlan).toBe(true)
  })

  it('normal plan week passes the Hermes level through untouched', () => {
    const r = resolveBriefingVerdict({ plan: { isDeload: false, weekOfPlan: 2 }, hermesLevel: 'push' })
    expect(r).toEqual({ level: 'push', verdict: null, fromPlan: false })
  })

  it('normal plan week without a Hermes level stays null (no invention)', () => {
    const r = resolveBriefingVerdict({ plan: { isDeload: false, weekOfPlan: 2 }, hermesLevel: null })
    expect(r.level).toBeNull()
    expect(r.fromPlan).toBe(false)
  })

  it('no plan at all → pure Hermes passthrough (legacy behavior)', () => {
    const r = resolveBriefingVerdict({ plan: { isDeload: false, weekOfPlan: null }, hermesLevel: 'recover' })
    expect(r).toEqual({ level: 'recover', verdict: null, fromPlan: false })
  })
})
