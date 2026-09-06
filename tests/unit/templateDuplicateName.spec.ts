import { describe, expect, test, vi, beforeEach } from 'vitest'

// Mock the Capacitor SQLite bridge module that app_db.ts imports. The in-memory
// stub implements just enough (run/query/execute) for createTemplate's
// duplicate-name check against a case-insensitive unique column.
const tables: Record<string, any[]> = {}

vi.mock('@capacitor-community/sqlite', () => {
  const db = {
    open: vi.fn(async () => {}),
    isDBOpen: vi.fn(async () => ({ result: true })),
    execute: vi.fn(async (sql: string) => {
      const m = sql.match(/INSERT INTO workout_template \(name\) VALUES \('(.*?)'\)/)
      if (m) {
        assertUnique(m[1])
        tables.workout_template.push({ id: tables.workout_template.length + 1, name: m[1] })
      }
      return {}
    }),
    run: vi.fn(async (sql: string, args: any[] = []) => {
      const m = sql.match(/INSERT INTO workout_template \(name\) VALUES \(\?\)/)
      if (m) {
        assertUnique(args[0])
        tables.workout_template.push({ id: tables.workout_template.length + 1, name: args[0] })
        return { changes: { lastId: tables.workout_template.length } }
      }
      return {}
    }),
    query: vi.fn(async (sql: string, args: any[] = []) => {
      if (/lower\(name\) = lower\(\?\)/.test(sql)) {
        const name = String(args[0]).toLowerCase()
        return {
          values: tables.workout_template.filter(
            (r) => String(r.name).toLowerCase() === name
          ),
        }
      }
      return { values: [] }
    }),
  }
  function assertUnique(name: string) {
    const dup = tables.workout_template.some(
      (r) => String(r.name).toLowerCase() === String(name).toLowerCase()
    )
    if (dup) {
      const err: any = new Error('UNIQUE constraint failed')
      err.code = 'SQLITE_CONSTRAINT'
      throw err
    }
  }
  return {
    CapacitorSQLite: db,
    SQLiteConnection: class {
      constructor(_db: unknown) {
        return
      }
      createConnection = vi.fn(async () => db)
      retrieveConnection = vi.fn(async () => db)
      isConnection = vi.fn(async () => ({ result: false }))
    },
  }
})

import { createTemplate, initDB } from '@/shared/db/app_db'

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'android' },
  CapacitorWeb: {},
}))

describe('createTemplate duplicate-name rejection', () => {
  beforeEach(async () => {
    tables.workout_template = [
      { id: 1, name: 'PUSH A' },
      { id: 2, name: 'Pull A' },
    ]
    await initDB()
  })

  test('rejects an exact duplicate name', async () => {
    await expect(createTemplate('PUSH A')).rejects.toThrow(
      'A template with this name already exists'
    )
  })

  test('rejects a case-insensitive duplicate name', async () => {
    await expect(createTemplate('push a')).rejects.toThrow(
      'A template with this name already exists'
    )
  })

  test('allows a fresh name and returns the new id', async () => {
    const id = await createTemplate('Legs C')
    expect(id).toBe(3)
    expect(tables.workout_template).toHaveLength(3)
  })
})
