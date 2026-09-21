// Grades store — pull `school_grade` rows from the receiver into a local
// cache (localStorage JSON: grades are tiny, append-only, and a new SQLite
// table would have to join all four SQL export/import lists for no gain).
//
// Dedupe model: the pull re-reads a 2h overlap window every call (clock-skew
// healing), so rows are deduped by their receiver identity — (subject, grade,
// date, term) + receivedAt of first arrival. A re-posted identical grade
// (school corrections) updates in place via that key.
import { pullIncremental, parseSchoolGrade, type SchoolGradePayload } from '@/shared/sync/receiverSync'

const CACHE_KEY = 'grades.cache'
const NEW_SEEN_KEY = 'grades.seenCount'

export interface GradeRow extends SchoolGradePayload {
  /** Receiver arrival second — ordering + "new" detection. */
  receivedAt: number
}

function readCache(): GradeRow[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function writeCache(rows: GradeRow[]): void {
  localStorage.setItem(CACHE_KEY, JSON.stringify(rows))
}

function gradeKey(g: SchoolGradePayload): string {
  return `${g.subject}|${g.grade}|${g.date}|${g.term ?? ''}`
}

/**
 * Pull new grade rows from the receiver, merge into the local cache.
 * Returns how many genuinely-new rows arrived this pull.
 */
export async function syncGrades(): Promise<number> {
  const pulled = await pullIncremental<SchoolGradePayload>('school_grade', parseSchoolGrade)
  if (pulled.length === 0) return 0

  const cache = readCache()
  const known = new Set(cache.map(gradeKey))
  let added = 0
  for (const { receivedAt, item } of pulled) {
    if (known.has(gradeKey(item))) continue
    known.add(gradeKey(item))
    cache.push({ ...item, receivedAt })
    added += 1
  }
  if (added > 0) {
    cache.sort((a, b) => b.receivedAt - a.receivedAt)
    writeCache(cache)
  }
  return added
}

/** Cached grades, newest first. Works offline — safe to render directly. */
export function getCachedGrades(): GradeRow[] {
  return readCache()
}

/**
 * "New" = arrived since the last time the user saw a grades surface.
 * Marks everything seen on read.
 */
export function countNewAndMarkSeen(): number {
  const cache = readCache()
  const seen = Number(localStorage.getItem(NEW_SEEN_KEY)) || 0
  const fresh = cache.filter((g) => g.receivedAt > seen).length
  const newest = cache.reduce((max, g) => Math.max(max, g.receivedAt), seen)
  localStorage.setItem(NEW_SEEN_KEY, String(newest))
  return fresh
}

/** Trailing average over the latest `n` grades (SI scale 1–5). */
export function averageGrade(rows: GradeRow[], n = 10): number | null {
  const values = rows.slice(0, n).map((g) => g.grade).filter((v) => Number.isFinite(v))
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}
