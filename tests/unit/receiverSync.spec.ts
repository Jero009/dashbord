import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  buildGymWorkoutPayload,
  enqueueDirtyWorkout,
  readDirtyWorkouts,
  clearDirtyWorkouts,
  parseSchoolGrade,
  parseBriefing,
  type DirtyWorkout,
} from '@/shared/sync/receiverSync'

// jsdom in this setup doesn't expose localStorage — stub the storage surface
// (same pattern as useRestTimer.spec.ts).
const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => void store.clear(),
})

const base = {
  dateKey: '2026-09-21',
  startedAt: '2026-09-21 18:04:38',
  endedAt: '2026-09-21 19:10:00',
  name: 'Pull B',
  durationMinutes: 65,
  sessionRpe: 8,
}

describe('buildGymWorkoutPayload', () => {
  it('keeps only completed sets and computes volume', () => {
    const p = buildGymWorkoutPayload({
      ...base,
      exercises: [
        { name: 'Bench Press', sets: [
          { weight: 80, reps: 5, completed: 1 },
          { weight: 80, reps: 5, completed: 1 },
          { weight: 82.5, reps: 3, completed: 0 },
        ]},
        { name: 'Row', sets: [{ weight: 60, reps: 8, completed: 1 }] },
      ],
    })
    expect(p.exercises).toHaveLength(2)
    expect(p.exercises[0].sets).toHaveLength(2)
    expect(p.total_volume).toBe(80 * 5 * 2 + 60 * 8)
  })

  it('drops exercises with zero completed sets', () => {
    const p = buildGymWorkoutPayload({
      ...base,
      exercises: [{ name: 'Lat Pulldown', sets: [{ weight: 50, reps: 10, completed: 0 }] }],
    })
    expect(p.exercises).toHaveLength(0)
    expect(p.total_volume).toBe(0)
  })

  it('coerces string DB values to numbers', () => {
    const p = buildGymWorkoutPayload({
      ...base,
      exercises: [{ name: 'Curl', sets: [{ weight: '17.5', reps: '10', completed: 1 }] }],
    })
    expect(p.exercises[0].sets[0]).toEqual({ weight: 17.5, reps: 10 })
    expect(p.total_volume).toBe(175)
  })

  it('keeps null name and rpe nullable', () => {
    const p = buildGymWorkoutPayload({
      ...base,
      name: null,
      sessionRpe: null,
      exercises: [{ name: 'X', sets: [{ weight: 1, reps: 1, completed: 1 }] }],
    })
    expect(p.name).toBeNull()
    expect(p.session_rpe).toBeNull()
  })
})

describe('dirty workout queue', () => {
  const entry: DirtyWorkout = {
    workoutId: 7,
    payload: buildGymWorkoutPayload({
      ...base,
      exercises: [{ name: 'Bench', sets: [{ weight: 80, reps: 5, completed: 1 }] }],
    }),
  }

  beforeEach(() => localStorage.clear())

  it('enqueues and dedupes by workout id', () => {
    enqueueDirtyWorkout(entry)
    enqueueDirtyWorkout({ ...entry, payload: { ...entry.payload, total_volume: 999 } })
    const list = readDirtyWorkouts()
    expect(list).toHaveLength(1)
    expect(list[0].payload.total_volume).toBe(999)
  })

  it('clears only the ids the receiver confirmed', () => {
    enqueueDirtyWorkout(entry)
    enqueueDirtyWorkout({ ...entry, workoutId: 8 })
    clearDirtyWorkouts([7])
    expect(readDirtyWorkouts().map((d) => d.workoutId)).toEqual([8])
  })

  it('survives corrupted queue contents', () => {
    localStorage.setItem('receiverSync.dirtyWorkouts', '{not json')
    expect(readDirtyWorkouts()).toEqual([])
  })
})

describe('parsers', () => {
  it('parseSchoolGrade accepts valid rows and rejects garbage', () => {
    expect(parseSchoolGrade({ subject: 'Mat', grade: 5, date: '2026-09-15', term: '1' })).toEqual({
      subject: 'Mat', grade: 5, date: '2026-09-15', term: '1',
    })
    expect(parseSchoolGrade({ subject: 'Mat', grade: 'x', date: '2026-09-15' })).toBeNull()
    expect(parseSchoolGrade({ grade: 5, date: '2026-09-15' })).toBeNull()
    expect(parseSchoolGrade(null)).toBeNull()
  })

  it('parseBriefing accepts title+body+verdict+level, rejects empty', () => {
    expect(parseBriefing({ title: 'T', body: 'B', verdict: 'PUSH', level: 'push' })).toEqual({
      title: 'T', body: 'B', verdict: 'PUSH', level: 'push',
    })
    // Legacy row without the level fields still parses (level → null).
    expect(parseBriefing({ title: 'T', body: 'B' })).toEqual({
      title: 'T', body: 'B', verdict: null, level: null,
    })
    // Unknown level strings are kept by the parser (the store validates).
    expect(parseBriefing({ title: 'T', body: 'B', level: 'bogus' })?.level).toBe('bogus')
    expect(parseBriefing({ title: '', body: '' })).toBeNull()
    expect(parseBriefing('text')).toBeNull()
  })
})
