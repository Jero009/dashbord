// Daily briefing — Hermes writes one `briefing` row per day; the Home card
// renders the latest. Cached in localStorage so the card shows something the
// moment the app opens (offline-safe), refreshed by an incremental pull.
//
// `level` is the machine-readable VU-glyph state pushed by daily_briefing.py:
//   push    = all three bar segments lit (hard session green-lit)
//   normal  = red+yellow lit
//   recover = red only
//   sick    = all three solid red (override)
//   deload  = all three solid yellow (override)
// Legacy rows (pre-level) parse with level=null → the UI falls back to the
// plain title, no glyph.
import { pullIncremental, parseBriefing } from '@/shared/sync/receiverSync'

const CACHE_KEY = 'briefing.latest'

export type BriefingLevel = 'push' | 'normal' | 'recover' | 'sick' | 'deload'

export interface Briefing {
  receivedAt: number
  title: string
  body: string
  verdict: string | null
  level: BriefingLevel | null
}

const LEVEL_SET: ReadonlySet<string> = new Set(['push', 'normal', 'recover', 'sick', 'deload'])

function readCache(): Briefing | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const b = JSON.parse(raw) as Briefing
    if (!b || typeof b.receivedAt !== 'number') return null
    // Normalize legacy cache entries (no level field yet).
    return {
      ...b,
      verdict: b.verdict ?? null,
      level: b.level != null && LEVEL_SET.has(b.level) ? (b.level as BriefingLevel) : null,
    }
  } catch {
    return null
  }
}

/** Latest cached briefing — instant, offline-safe. */
export function getCachedBriefing(): Briefing | null {
  return readCache()
}

/**
 * Pull briefings newer than the cached one. Returns the new latest, or null
 * when nothing newer arrived.
 */
export async function syncBriefing(): Promise<Briefing | null> {
  const pulled = await pullIncremental<{ title: string; body: string; verdict: string | null; level: string | null }>('briefing', parseBriefing)
  if (pulled.length === 0) return null

  const current = readCache()
  const newest = pulled[0]
  if (current && newest.receivedAt <= current.receivedAt) return null

  const next: Briefing = {
    receivedAt: newest.receivedAt,
    title: newest.item.title,
    body: newest.item.body,
    verdict: newest.item.verdict,
    level: newest.item.level != null && LEVEL_SET.has(newest.item.level) ? (newest.item.level as BriefingLevel) : null,
  }
  localStorage.setItem(CACHE_KEY, JSON.stringify(next))
  return next
}

/** Day key (local) for a unix-seconds arrival — is this briefing from today? */
export function briefingIsToday(b: Briefing, now = new Date()): boolean {
  const d = new Date(b.receivedAt * 1000)
  const key = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  return key(d) === key(now)
}
