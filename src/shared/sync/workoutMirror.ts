// Workout-end → receiver mirror (task A of the integration plan).
//
// Loads the just-ended workout from SQLite, builds the wire payload, queues it
// dirty, and flushes the whole queue. Queuing ALWAYS happens first: if the
// push fails (offline gym), the payload rides the next flush cycle. Never
// throws, never blocks the end-workout UX — sync is a background concern.
import type { GymWorkoutPayload } from '@/shared/sync/receiverSync'
import {
  buildGymWorkoutPayload,
  enqueueDirtyWorkout,
  flushDirtyWorkoutQueue,
} from '@/shared/sync/receiverSync'
import { getDbForSync } from '@/shared/db/app_db'

export function localDateKey(d = new Date()): string {
  // Local date key — NEVER toISOString().slice(0,10) (UTC drift, see AGENTS.md).
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Mirror one finished workout to the receiver. Fire-and-forget from the
 * caller's perspective; resolves when the flush attempt settles.
 */
export async function mirrorWorkoutToReceiver(workoutId: number): Promise<void> {
  try {
    const payload = await buildPayloadForWorkout(workoutId)
    if (!payload) return
    enqueueDirtyWorkout({ workoutId, payload })
    await flushDirtyWorkoutQueue()
  } catch {
    // A sync failure must never break the end-workout flow; the dirty queue
    // retries on next app start / next workout end.
  }
}

/** Load rows and build the payload. Null when the workout has no data. */
export async function buildPayloadForWorkout(workoutId: number): Promise<GymWorkoutPayload | null> {
  const db = getDbForSync()
  if (!db) return null

  const wRes = await db.query('SELECT name, time_start, time_end, session_rpe FROM workout WHERE id = ?', [workoutId])
  const w = wRes.values?.[0]
  if (!w) return null

  const exRes = await db.query(`
    SELECT e.name AS exercise_name, wes.weight, wes.reps, wes.completed
    FROM workout_exercise we
    JOIN exercise e ON e.id = we.exercise_id
    LEFT JOIN workout_exercise_sets wes ON wes.workout_exercise_id = we.id
    WHERE we.workout_id = ?
    ORDER BY we.order_index, wes.set_number
  `, [workoutId])

  const byExercise = new Map<string, Array<{ weight: unknown; reps: unknown; completed: unknown }>>()
  for (const row of (exRes.values ?? []) as Array<Record<string, unknown>>) {
    const name = String(row.exercise_name ?? '')
    if (!name) continue
    let sets = byExercise.get(name)
    if (!sets) { sets = []; byExercise.set(name, sets) }
    if (row.weight != null || row.reps != null) {
      sets.push({ weight: row.weight, reps: row.reps, completed: row.completed })
    }
  }

  const start = w.time_start ? new Date(String(w.time_start)) : null
  const end = w.time_end ? new Date(String(w.time_end)) : null
  const duration =
    start && end && end.getTime() > start.getTime()
      ? Math.round((end.getTime() - start.getTime()) / 60000)
      : null
  const rpeRaw = w.session_rpe == null ? null : Number(w.session_rpe)

  return buildGymWorkoutPayload({
    dateKey: start ? localDateKey(start) : localDateKey(),
    startedAt: String(w.time_start ?? ''),
    endedAt: String(w.time_end ?? ''),
    name: w.name ? String(w.name) : null,
    durationMinutes: duration,
    sessionRpe: rpeRaw != null && Number.isFinite(rpeRaw) ? rpeRaw : null,
    exercises: [...byExercise.entries()].map(([name, sets]) => ({ name, sets })),
  })
}
