// Daily briefing — Hermes writes one `briefing` row per day; the Home card
// renders the latest. Cached in localStorage so the card shows something the
// moment the app opens (offline-safe), refreshed by an incremental pull.
import { pullIncremental, parseBriefing } from '@/shared/sync/receiverSync'

const CACHE_KEY = 'briefing.latest'

export interface Briefing {
  receivedAt: number
  title: string
  body: string
}

function readCache(): Briefing | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const b = JSON.parse(raw) as Briefing
    return b && typeof b.receivedAt === 'number' ? b : null
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
  const pulled = await pullIncremental<{ title: string; body: string }>('briefing', parseBriefing)
  if (pulled.length === 0) return null

  const current = readCache()
  const newest = pulled[0]
  if (current && newest.receivedAt <= current.receivedAt) return null

  const next: Briefing = {
    receivedAt: newest.receivedAt,
    title: newest.item.title,
    body: newest.item.body,
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
