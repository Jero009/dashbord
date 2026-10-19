// Hermes proposes plans; the phone validates and owns the actual DB write.
export interface PlanImport {
  id: string
  name: string
  goal: string | null
  start_date: string
  end_date: string
  deload_every_weeks: number
  deload_factor: number
  templates: Array<{ name: string; exercises: Array<{ name: string; sets: number; reps: number; rpe?: number | null }> }>
}

const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const nonempty = (x: unknown): x is string => typeof x === 'string' && !!x.trim() && x.length <= 160
const count = (x: unknown) => Number.isInteger(x) && Number(x) >= 1 && Number(x) <= 50
const validDate = (x: unknown): x is string => {
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false
  const d = new Date(`${x}T12:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === x
}

export function parsePlanImport(raw: unknown): PlanImport | null {
  if (!object(raw)) return null
  if (typeof raw.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw.id)) return null
  if (!nonempty(raw.name) || (raw.goal !== null && typeof raw.goal !== 'string')) return null
  if (!validDate(raw.start_date) || !validDate(raw.end_date) || raw.end_date < raw.start_date) return null
  if (!Number.isInteger(raw.deload_every_weeks) || Number(raw.deload_every_weeks) < 0 || Number(raw.deload_every_weeks) > 6) return null
  if (typeof raw.deload_factor !== 'number' || !Number.isFinite(raw.deload_factor) || raw.deload_factor < 0.5 || raw.deload_factor > 0.9) return null
  if (!Array.isArray(raw.templates) || raw.templates.length < 1 || raw.templates.length > 20) return null
  const names = new Set<string>()
  for (const template of raw.templates) {
    if (!object(template) || !nonempty(template.name) || !Array.isArray(template.exercises) || !template.exercises.length || template.exercises.length > 30) return null
    const key = template.name.trim().toLowerCase()
    if (names.has(key)) return null
    names.add(key)
    const exercises = new Set<string>()
    for (const exercise of template.exercises) {
      if (!object(exercise) || !nonempty(exercise.name) || !count(exercise.sets) || !count(exercise.reps)) return null
      if (exercise.rpe != null && (typeof exercise.rpe !== 'number' || !Number.isFinite(exercise.rpe) || exercise.rpe < 1 || exercise.rpe > 10)) return null
      const exKey = exercise.name.trim().toLowerCase()
      if (exercises.has(exKey)) return null
      exercises.add(exKey)
    }
  }
  return raw as unknown as PlanImport
}

export function latestPendingPlan(rows: unknown, handled: Set<string>): PlanImport | null {
  if (!Array.isArray(rows)) return null
  for (const row of [...rows].sort((a, b) => Number(b?.received_at) - Number(a?.received_at))) {
    if (!object(row)) continue
    const data = Array.isArray(row.data) ? row.data : []
    for (const item of [...data].reverse()) {
      const plan = parsePlanImport(item)
      if (plan && !handled.has(plan.id)) return plan
    }
  }
  return null
}
