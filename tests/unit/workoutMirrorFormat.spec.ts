import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the sync layer — buildPayloadForWorkout must produce the wire payload;
// we assert the timestamp/duration shape that the receiver mis-parsed (FIXPLAN #30).
// Factories are hoisted: state lives inside vi.hoisted closures.
const h = vi.hoisted(() => {
  return {
    enqueue: undefined as unknown as ReturnType<typeof vi.fn>,
    flush: undefined as unknown as ReturnType<typeof vi.fn>,
    query: undefined as unknown as ReturnType<typeof vi.fn>,
    results: [] as Array<Array<Record<string, unknown>>>,
  }
})
vi.mock('@/shared/sync/receiverSync', () => ({
  // Mirror the real mapper's key renames (dateKey→date, startedAt→started_at,
  // …) so the assertions target the actual wire shape.
  buildGymWorkoutPayload: (input: Record<string, unknown>) => ({
    date: input.dateKey,
    started_at: input.startedAt,
    ended_at: input.endedAt,
    name: input.name,
    duration_minutes: input.durationMinutes,
    session_rpe: input.sessionRpe,
    total_volume: 0,
    exercises: input.exercises,
  }),
  enqueueDirtyWorkout: (...a: unknown[]) => h.enqueue(...a),
  flushDirtyWorkoutQueue: (...a: unknown[]) => h.flush(...a),
}))
vi.mock('@/shared/db/app_db', () => ({
  getDbForSync: () => ({ query: (...a: unknown[]) => h.query(...a) }),
}))

beforeAll(() => {
  h.enqueue = vi.fn()
  h.flush = vi.fn().mockResolvedValue(1)
  h.query = vi.fn().mockImplementation(() => Promise.resolve({ values: h.results.shift() ?? [] }))
})

import { buildPayloadForWorkout } from '@/shared/sync/workoutMirror'

// System time pinned: 2026-09-23 20:15 local. Timezone is whatever the CI box
// has — the assertions below are offset-agnostic (they check SHAPE), except
// duration which is zone-independent.
const NOW = new Date(2026, 8, 23, 20, 15, 0)

describe('workoutMirror timestamps (FIXPLAN #30)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.results.length = 0
    h.query.mockImplementation(() => Promise.resolve({ values: h.results.shift() ?? [] }))
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => vi.useRealTimers())

  it('emits started_at AND ended_at as full ISO-8601 WITH timezone offset', async () => {
    // DB rows: naive-local start (space-separated) + ISO-Z end (today's reality).
    h.results.push([
      {
        name: 'Pull B',
        time_start: '2026-09-23 18:04:38',
        time_end: '2026-09-23T18:15:00.000Z',
        session_rpe: 8,
      },
    ])
    h.results.push([]) // no sets

    const p = await buildPayloadForWorkout(1)
    expect(p).not.toBeNull()
    const isoOffset = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?[+-]\d{2}:?\d{2}$/
    expect(p!.started_at).toMatch(isoOffset)
    expect(p!.ended_at).toMatch(isoOffset)
    // Both must be parseable by `new Date` and round-trip to the same instant
    // as their inputs (18:04:38 local / 18:15:00Z).
    expect(new Date(p!.started_at).getTime()).toBe(new Date(2026, 8, 23, 18, 4, 38).getTime())
    expect(new Date(p!.ended_at).getTime()).toBe(Date.UTC(2026, 8, 23, 18, 15, 0))
  })

  it('duration_minutes is computed app-side and sane (no receiver parsing)', async () => {
    // 18:04:38 local start, 18:15:00Z end — the real elapsed time, whatever
    // the local offset is, is (18:15Z − start) minutes.
    h.results.push([
      {
        name: null,
        time_start: '2026-09-23 18:04:38',
        time_end: '2026-09-23T18:15:00.000Z',
        session_rpe: null,
      },
    ])
    h.results.push([])

    const p = await buildPayloadForWorkout(2)
    const expected = Math.round(
      (Date.UTC(2026, 8, 23, 18, 15, 0) - new Date(2026, 8, 23, 18, 4, 38).getTime()) / 60000
    )
    expect(p!.duration_minutes).toBe(Math.max(0, expected))
    // The regression that started this: a seconds-long session must never
    // mirror as hours. Duration stays under 60 for this 10-minute window.
    expect(p!.duration_minutes).toBeLessThan(60)
  })

  it('null duration when end is missing or before start', async () => {
    h.results.push([
      { name: 'X', time_start: '2026-09-23 18:04:38', time_end: null, session_rpe: null },
    ])
    h.results.push([])
    expect((await buildPayloadForWorkout(3))!.duration_minutes).toBeNull()

    h.results.push([
      { name: 'X', time_start: '2026-09-23 18:04:38', time_end: '2026-09-23T17:00:00.000Z', session_rpe: null },
    ])
    h.results.push([])
    expect((await buildPayloadForWorkout(4))!.duration_minutes).toBeNull()
  })

  it('date key is the LOCAL date of the start', async () => {
    h.results.push([
      { name: 'X', time_start: '2026-09-23 23:50:00', time_end: '2026-09-24T06:00:00.000Z', session_rpe: null },
    ])
    h.results.push([])
    const p = await buildPayloadForWorkout(5)
    expect(p!.date).toBe('2026-09-23')
  })
})
