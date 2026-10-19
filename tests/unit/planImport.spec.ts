import { describe, expect, it } from 'vitest'
import { parsePlanImport, latestPendingPlan, type PlanImport } from '@/features/gym/planImport'

const sample = {
  id: 'e9a675cb-6ef8-409d-95df-f744ddb8fb9f',
  name: 'Winter strength', goal: null, start_date: '2026-11-01', end_date: '2027-01-23',
  deload_every_weeks: 3, deload_factor: 0.675,
  templates: [{ name: 'Pull', exercises: [{ name: 'Lat Pulldown', sets: 3, reps: 10, rpe: 8 }] }],
}

describe('incoming plan validation', () => {
  it('accepts a complete plan with exercise targets', () => {
    expect(parsePlanImport(sample)).toEqual(sample)
  })
  it('rejects invalid dates, duplicate exercise names and unbounded counts', () => {
    expect(parsePlanImport({ ...sample, end_date: '2026-02-30' })).toBeNull()
    expect(parsePlanImport({ ...sample, templates: [{ name: 'Pull', exercises: [sample.templates[0].exercises[0], { name: 'lat pulldown', sets: 3, reps: 8 }] }] })).toBeNull()
    expect(parsePlanImport({ ...sample, templates: [{ name: 'Pull', exercises: [{ name: 'X', sets: -1, reps: 8 }] }] })).toBeNull()
  })
  it('does not show rejected or imported IDs again, even in overlapping rows', () => {
    const other = { ...sample, id: 'f9a675cb-6ef8-409d-95df-f744ddb8fb9f', name: 'Other' }
    const rows = [
      { received_at: 10, data: [sample] },
      { received_at: 11, data: [sample, other] },
    ]
    expect(latestPendingPlan(rows, new Set([sample.id]))).toEqual(other as PlanImport)
    expect(latestPendingPlan(rows, new Set([sample.id, other.id]))).toBeNull()
  })
})
