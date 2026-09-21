// Phone → receiver sync (local-first mirror).
//
// The phone's SQLite is canonical; the health-receiver on the docker VM holds
// a mirror the agent (Hermes) reads and writes. This module is the app-side
// transport:
//
//   push  →  POST {receiver}/webhook  body: {"gym_workout": [ {...}, ... ]}
//            (the receiver keys rows off the TOP-LEVEL JSON key — never use a
//            ?type= query param on POST; it silently lands as type "data")
//   pull  →  GET  {receiver}/latest?type=<t>&limit=N
//            → [{ received_at: unix-s, data: [...] }, …]
//
// HTTPS is mandatory (Android 9+ blocks cleartext); the Tailscale sidecar on
// :9443 proxies the receiver's plain-HTTP :8901. All requests are
// fire-and-fail: offline use must never surface an error to the user — rows
// stay dirty and ride the next flush.
import { Capacitor, CapacitorHttp } from '@capacitor/core'

const STAMP_KEY = 'receiverSync.lastPullAt'

// Receiver row caps (mirrors hermesPush.ts conventions).
const MAX_PULL_ROWS = 50

export interface GymWorkoutPayload {
  /** Local date key YYYY-MM-DD of the session (local timezone, not UTC). */
  date: string
  /** Session start/end as ISO-8601 local wall-clock strings. */
  started_at: string
  ended_at: string
  /** Workout/template name, e.g. the PPL slot ("Pull B"). Nullable. */
  name: string | null
  duration_minutes: number | null
  session_rpe: number | null
  total_volume: number
  exercises: Array<{
    name: string
    sets: Array<{ weight: number; reps: number }>
  }>
}

export interface SchoolGradePayload {
  subject: string
  grade: number
  date: string
  term: string | null
}

function receiverBase(): string {
  return localStorage.getItem('hermesReceiverBase') || 'https://docker.tail85cdcd.ts.net:9443'
}

/**
 * Push a batch of rows under one top-level type key. Never throws.
 * Returns true when the receiver accepted the batch.
 */
async function pushRows(type: string, rows: unknown[]): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || rows.length === 0) return true
  try {
    const res = await CapacitorHttp.post({
      url: `${receiverBase()}/webhook`,
      headers: { 'Content-Type': 'application/json' },
      // Keyed top level — see module docs. Extra wrapper field is tolerated.
      data: { [type]: rows },
      readTimeout: 8000,
      connectTimeout: 8000,
    })
    return res.status >= 200 && res.status < 300
  } catch {
    return false
  }
}

/** Fetch recent rows of a type. Never throws — [] on failure. */
async function pullRows(type: string, limit = 10): Promise<Array<{ received_at: number; data: unknown }>> {
  try {
    const res = await CapacitorHttp.get({
      url: `${receiverBase()}/latest?type=${encodeURIComponent(type)}&limit=${Math.max(1, limit)}`,
      readTimeout: 8000,
      connectTimeout: 8000,
    })
    const rows = (Array.isArray(res.data) ? res.data : []) as Array<{ received_at?: unknown; data?: unknown }>
    return rows
      .filter((r) => r && typeof r === 'object')
      .map((r) => ({ received_at: Number(r.received_at) || 0, data: r.data ?? null }))
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Push: gym workouts
// ---------------------------------------------------------------------------

/**
 * Build the wire payload from rows the caller already loaded. Kept pure so the
 * shape is unit-testable without Capacitor (mocks produce these objects).
 */
export function buildGymWorkoutPayload(input: {
  dateKey: string
  startedAt: string
  endedAt: string
  name: string | null
  durationMinutes: number | null
  sessionRpe: number | null
  exercises: Array<{ name: string; sets: Array<{ weight: unknown; reps: unknown; completed: unknown }> }>
}): GymWorkoutPayload {
  const exercises = input.exercises
    .map((ex) => ({
      name: ex.name,
      sets: ex.sets
        .filter((s) => s.completed)
        .map((s) => ({ weight: Number(s.weight) || 0, reps: Number(s.reps) || 0 })),
    }))
    .filter((ex) => ex.sets.length > 0)

  const totalVolume = exercises.reduce(
    (sum, ex) => sum + ex.sets.reduce((s, set) => s + set.weight * set.reps, 0),
    0
  )

  return {
    date: input.dateKey,
    started_at: input.startedAt,
    ended_at: input.endedAt,
    name: input.name,
    duration_minutes: input.durationMinutes,
    session_rpe: input.sessionRpe,
    total_volume: Math.round(totalVolume * 100) / 100,
    exercises,
  }
}

/**
 * Flush dirty workouts. `payloads` comes from buildGymWorkoutPayload — the
 * caller owns loading rows and clearing the dirty flag ONLY on `true`.
 */
export async function flushGymWorkouts(payloads: GymWorkoutPayload[]): Promise<boolean> {
  if (payloads.length === 0) return true
  return pushRows('gym_workout', payloads)
}

// ---------------------------------------------------------------------------
// Pull: generic incremental reader (grades, briefing, …)
// ---------------------------------------------------------------------------

export interface PulledItem<T> {
  receivedAt: number
  item: T
}

function coerceArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') return [data]
  return []
}

/**
 * Incremental pull: rows newer than the stored stamp, advancing the stamp on
 * success. A 2-hour overlap re-reads a few rows every call — callers dedupe by
 * receivedAt. Overlap heals clock skew between sender and receiver.
 */
export async function pullIncremental<T>(
  type: string,
  parse: (raw: unknown) => T | null,
  limit = MAX_PULL_ROWS
): Promise<Array<PulledItem<T>>> {
  const last = Number(localStorage.getItem(STAMP_KEY + '.' + type)) || 0
  const rows = await pullRows(type, limit)
  if (rows.length === 0) return []

  // The overlap window: anything within 2h of the stamp re-arrives; callers
  // dedupe by receivedAt.
  const overlap = last > 0 ? last - 2 * 3600 : 0
  const out: Array<PulledItem<T>> = []
  for (const row of rows) {
    for (const raw of coerceArray(row.data)) {
      const parsed = parse(raw)
      if (parsed && row.received_at > overlap) out.push({ receivedAt: row.received_at, item: parsed })
    }
  }
  const newest = rows.reduce((max, r) => Math.max(max, r.received_at), last)
  if (newest > last) localStorage.setItem(STAMP_KEY + '.' + type, String(newest))
  return out.sort((a, b) => b.receivedAt - a.receivedAt)
}

export function parseSchoolGrade(raw: unknown): SchoolGradePayload | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const subject = typeof r.subject === 'string' ? r.subject : ''
  const grade = Number(r.grade)
  const date = typeof r.date === 'string' ? r.date : ''
  if (!subject || !date || !Number.isFinite(grade)) return null
  return {
    subject,
    grade,
    date,
    term: typeof r.term === 'string' ? r.term : null,
  }
}

export function parseBriefing(raw: unknown): { title: string; body: string } | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const title = typeof r.title === 'string' ? r.title : ''
  const body = typeof r.body === 'string' ? r.body : ''
  if (!title && !body) return null
  return { title, body }
}

// ---------------------------------------------------------------------------
// Dirty-queue for unsent workouts (offline gym sessions)
// ---------------------------------------------------------------------------

const DIRTY_KEY = 'receiverSync.dirtyWorkouts'

export interface DirtyWorkout {
  /** Local workout row id — lets callers clear the flag after a flush. */
  workoutId: number
  payload: GymWorkoutPayload
}

export function enqueueDirtyWorkout(entry: DirtyWorkout): void {
  const list = readDirty()
  const filtered = list.filter((d) => d.workoutId !== entry.workoutId)
  filtered.push(entry)
  localStorage.setItem(DIRTY_KEY, JSON.stringify(filtered))
}

export function readDirtyWorkouts(): DirtyWorkout[] {
  return readDirty()
}

/** Remove entries the receiver confirmed (flush returned true). */
export function clearDirtyWorkouts(ids: number[]): void {
  if (ids.length === 0) return
  const remaining = readDirty().filter((d) => !ids.includes(d.workoutId))
  localStorage.setItem(DIRTY_KEY, JSON.stringify(remaining))
}

function readDirty(): DirtyWorkout[] {
  try {
    const raw = localStorage.getItem(DIRTY_KEY)
    const list = raw ? (JSON.parse(raw) as DirtyWorkout[]) : []
    return Array.isArray(list) ? list.filter((d) => d && typeof d.workoutId === 'number' && d.payload) : []
  } catch {
    return []
  }
}

/**
 * One flush cycle for queued workouts: push everything queued, clear what the
 * receiver confirmed. Call on app start and after each workout end.
 */
export async function flushDirtyWorkoutQueue(): Promise<number> {
  const queue = readDirtyWorkouts()
  if (queue.length === 0) return 0
  const ok = await flushGymWorkouts(queue.map((d) => d.payload))
  if (ok) {
    clearDirtyWorkouts(queue.map((d) => d.workoutId))
    return queue.length
  }
  return 0
}
