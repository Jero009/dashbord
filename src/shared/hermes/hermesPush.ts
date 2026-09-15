// Hermes → phone push channel (minimal, app-side only).
//
// Hermes (the user's agent) drops notifications into the existing
// health-receiver service on the docker VM — the same collector the phone's
// health data flows through — and the app polls them down:
//
//   Hermes  →  POST {receiver}/webhook  body: {"hermes": [{ title, body }]}
//              (the receiver keys rows off the top-level JSON key — a bare
//              array body lands as type "data" and never reaches the app)
//   Phone   →  GET  {receiver}/latest?type=hermes&limit=N
//              → [{ received_at: unix-s, data: [{ title, body }] }, …]
//
// The receiver already stores arbitrary type/data pairs, so no server work is
// needed; the only contract is the `hermes` type with `{ title, body }` rows
// (documented in docs/HERMES_PUSH.md). Delivery reuses the Capacitor Local
// Notifications pipeline (same infra as reminders + the rest-timer ding), so a
// polled message becomes a real OS notification. No new dependencies: native
// HTTP goes through CapacitorHttp (WebView CORS-free, same pattern as
// finance/prices.ts); on web dev it degrades to a failed fetch, silently.
import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

// Base URL lives here, not in settings — it is infrastructure, not a user
// preference. Override via localStorage('hermesReceiverBase') for testing.
// Must be HTTPS: Android 9+ blocks cleartext HTTP from the WebView/native
// HTTP stack, so the receiver's plain-HTTP :8901 listener is unreachable from
// the app — the Tailscale HTTPS sidecar proxies the same service.
const DEFAULT_RECEIVER_BASE = 'https://docker.tail85cdcd.ts.net:9443'
const SEEN_KEY = 'hermesPush.seenAt'
const ID_HERMES_BASE = 100 // below ID range collisions: rest timer=20, weight=1, sleep=3

export function hermesReceiverBase(): string {
  return localStorage.getItem('hermesReceiverBase') || DEFAULT_RECEIVER_BASE
}

export interface HermesMessage {
  /** Receiver arrival time, unix seconds — used for dedupe + ordering. */
  receivedAt: number
  title: string
  body: string
}

interface LatestRow {
  received_at: number
  data: Array<{ title?: unknown; body?: unknown }> | { title?: unknown; body?: unknown } | null
}

/** Fetch recent Hermes messages, newest first. Never throws — [] on failure. */
export async function fetchHermesMessages(limit = 10): Promise<HermesMessage[]> {
  try {
    const res = await CapacitorHttp.get({
      url: `${hermesReceiverBase()}/latest?type=hermes&limit=${Math.max(1, limit)}`,
      readTimeout: 8000,
      connectTimeout: 8000,
    })
    const rows = (Array.isArray(res.data) ? res.data : []) as LatestRow[]
    const messages: HermesMessage[] = []
    for (const row of rows) {
      const items = Array.isArray(row?.data) ? row.data : row?.data ? [row.data] : []
      for (const item of items) {
        const title = typeof item?.title === 'string' ? item.title : ''
        const body = typeof item?.body === 'string' ? item.body : ''
        if (!title && !body) continue
        messages.push({ receivedAt: Number(row.received_at) || 0, title, body })
      }
    }
    return messages.sort((a, b) => b.receivedAt - a.receivedAt)
  } catch {
    return []
  }
}

const lastSeenAt = (): number => Number(localStorage.getItem(SEEN_KEY)) || 0

const markSeenAt = (t: number) => localStorage.setItem(SEEN_KEY, String(t))

/** Post one message as an OS notification (immediate, no schedule). */
async function deliverNotification(msg: HermesMessage, seq: number): Promise<void> {
  const { display } = await LocalNotifications.checkPermissions()
  if (display !== 'granted') return
  await LocalNotifications.schedule({
    notifications: [{
      // Stable per-message id: arrival second + seq keeps distinct messages from
      // overwriting each other while staying in the Hermes id range.
      id: ID_HERMES_BASE + ((msg.receivedAt % 1000) + seq) % 900,
      title: msg.title || 'Hermes',
      body: msg.body,
      smallIcon: 'ic_stat_icon_config_sample',
    }],
  })
}

/**
 * One poll cycle: pull the latest messages, deliver any newer than the last
 * seen stamp as OS notifications, advance the stamp. Returns delivered count.
 */
export async function pollAndDeliverHermes(): Promise<number> {
  if (!Capacitor.isNativePlatform()) return 0
  const messages = await fetchHermesMessages(5)
  const seen = lastSeenAt()
  // Oldest → newest so the stamp only moves forward; only strictly-newer
  // messages deliver (same-second arrivals use the ordering the receiver gave).
  const fresh = messages.filter((m) => m.receivedAt > seen).sort((a, b) => a.receivedAt - b.receivedAt)
  let delivered = 0
  for (const msg of fresh) {
    try {
      await deliverNotification(msg, delivered)
      delivered += 1
    } catch { /* keep polling even if one delivery fails */ }
  }
  const newest = messages.reduce((max, m) => Math.max(max, m.receivedAt), seen)
  if (newest > seen) markSeenAt(newest)
  return delivered
}

let pollTimer: ReturnType<typeof setInterval> | null = null

/** Start background polling (native only; default every 10 minutes). */
export function startHermesPolling(intervalMs = 10 * 60 * 1000): void {
  if (!Capacitor.isNativePlatform() || pollTimer) return
  void pollAndDeliverHermes()
  pollTimer = setInterval(() => { void pollAndDeliverHermes() }, intervalMs)
}

export function stopHermesPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}
