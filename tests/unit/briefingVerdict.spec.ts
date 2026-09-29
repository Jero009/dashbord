import { describe, it, expect } from 'vitest'
import { resolveBriefingVerdict, isSickToday } from '@/shared/utils/briefingVerdict'

describe('resolveBriefingVerdict — fully local ladder (sick > deload > recovery)', () => {
  it('sick life_event overrides everything', () => {
    const r = resolveBriefingVerdict({
      plan: { isDeload: true, weekOfPlan: 3 },
      sick: true,
      recovery: { level: 'train', reason: 'Green light' },
    })
    expect(r.level).toBe('sick')
    expect(r.verdict).toBe('SICK')
    expect(r.source).toBe('sick')
  })

  it('deload week overrides the recovery engine', () => {
    const r = resolveBriefingVerdict({
      plan: { isDeload: true, weekOfPlan: 6 },
      sick: false,
      recovery: { level: 'train', reason: 'Green light' },
    })
    expect(r.level).toBe('deload')
    expect(r.verdict).toBe('HOLD · deload week (week 6)')
    expect(r.source).toBe('deload')
  })

  it('recovery engine recover → REST', () => {
    const r = resolveBriefingVerdict({
      plan: { isDeload: false, weekOfPlan: 2 },
      sick: false,
      recovery: { level: 'recover', reason: 'Readiness is low — prioritise rest today.' },
    })
    expect(r.level).toBe('recover')
    expect(r.verdict).toBe('REST')
    expect(r.reason).toContain('Readiness is low')
    expect(r.source).toBe('recovery')
  })

  it('recovery engine maintain → normal/OK with cited reason', () => {
    const r = resolveBriefingVerdict({
      plan: { isDeload: false, weekOfPlan: 2 },
      sick: false,
      recovery: { level: 'maintain', reason: 'Load is climbing fast — hold volume rather than adding.' },
    })
    expect(r.level).toBe('normal')
    expect(r.verdict).toBe('OK')
    expect(r.reason).toContain('hold volume')
  })

  it('recovery engine train → push/GO', () => {
    const r = resolveBriefingVerdict({
      plan: { isDeload: false, weekOfPlan: 2 },
      sick: false,
      recovery: { level: 'train', reason: 'Recovery markers look good — green light to push.' },
    })
    expect(r.level).toBe('push')
    expect(r.verdict).toBe('GO')
  })

  it('no recovery signal (insufficient history) → normal, no invention', () => {
    const r = resolveBriefingVerdict({
      plan: { isDeload: false, weekOfPlan: null },
      sick: false,
      recovery: null,
    })
    expect(r.level).toBe('normal')
    expect(r.verdict).toBe('OK')
    expect(r.reason).toBeNull()
  })
})

describe('isSickToday — open sick life_event coverage', () => {
  const events = [
    { type: 'sick', start_date: '2026-09-20', end_date: null }, // open
    { type: 'sick', start_date: '2026-09-01', end_date: '2026-09-05' }, // closed, past
    { type: 'school', start_date: '2026-09-28', end_date: null }, // not sick
  ]

  it('open sick spell covering today → true', () => {
    expect(isSickToday(events, '2026-09-29')).toBe(true)
  })

  it('day before the sick start → false', () => {
    expect(isSickToday(events, '2026-09-19')).toBe(false)
  })

  it('closed spell that ended before today → false', () => {
    expect(isSickToday(events, '2026-09-06')).toBe(false)
  })

  it('start day itself counts as sick', () => {
    expect(isSickToday(events, '2026-09-20')).toBe(true)
  })

  it('end day itself still counts (recovery day, not training day)', () => {
    expect(isSickToday(events, '2026-09-05')).toBe(true)
  })

  it('non-sick events never match', () => {
    expect(isSickToday([{ type: 'school', start_date: '2026-09-28', end_date: null }], '2026-09-29')).toBe(false)
  })
})
