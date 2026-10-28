import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const tables = {
  plans: [] as Array<Record<string, unknown>>,
  workouts: [] as Array<Record<string, unknown>>,
  templates: [] as Array<Record<string, unknown>>,
}

vi.mock('@capacitor-community/sqlite', () => {
  const db = {
    open: vi.fn(async () => {}),
    isDBOpen: vi.fn(async () => ({ result: true })),
    execute: vi.fn(async () => ({})),
    run: vi.fn(async (sql: string, args: unknown[] = []) => {
      if (sql.includes('UPDATE gym_plan SET archived = 1')) {
        const [endDate, id] = args
        const guarded = sql.includes('COALESCE(archived, 0) = 0')
        const plan = tables.plans.find((row) => row.id === id && (!guarded || !row.archived))
        if (plan) {
          plan.archived = 1
          plan.end_date = endDate
        }
      }
      return {}
    }),
    query: vi.fn(async (sql: string) => ({
      values: sql.includes('SELECT * FROM gym_plan WHERE COALESCE(archived, 0) = 0')
        ? tables.plans.filter((row) => !row.archived)
        : [],
    })),
  }
  return {
    CapacitorSQLite: db,
    SQLiteConnection: class {
      createConnection = vi.fn(async () => db)
      retrieveConnection = vi.fn(async () => db)
      isConnection = vi.fn(async () => ({ result: false }))
    },
  }
})

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'android' },
  CapacitorWeb: {},
}))

import { endPlan, getPlans, initDB } from '@/shared/db/app_db'

describe('endPlan', () => {
  beforeAll(async () => { await initDB() })

  beforeEach(() => {
    tables.plans = [
      { id: 1, name: 'Current', end_date: '2027-01-24', archived: 0 },
      { id: 2, name: 'Past', end_date: '2026-08-31', archived: 1 },
    ]
    tables.workouts = [{ id: 10, name: 'Push' }]
    tables.templates = [{ id: 20, name: 'Push A' }]
  })

  it('archives the current plan at the supplied local date without deleting history', async () => {
    await endPlan(1, '2026-10-28')

    expect(tables.plans[0]).toMatchObject({ archived: 1, end_date: '2026-10-28' })
    expect(await getPlans()).toEqual([])
    expect(tables.workouts).toEqual([{ id: 10, name: 'Push' }])
    expect(tables.templates).toEqual([{ id: 20, name: 'Push A' }])
  })

  it('does not modify an already archived plan', async () => {
    await endPlan(2, '2026-10-28')

    expect(tables.plans[1]).toMatchObject({ archived: 1, end_date: '2026-08-31' })
  })
})
