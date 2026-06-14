import { LocalNotifications } from '@capacitor/local-notifications'
import { Capacitor } from '@capacitor/core'
import { formatCurrency } from '@/shared/utils/currency'
import { localDateISO } from '@/shared/utils/timeFormat'

// Notification ID ranges — must be stable integers
const ID_WEIGHT        = 1
const ID_HABIT         = 2
const ID_SLEEP         = 3
const ID_CIRC_MORNING  = 8
const ID_CIRC_NOON     = 9
const ID_CIRC_EVENING  = 10
const ID_MORNING       = 11
const ID_WEEKLY        = 12
const ID_CAL_BASE      = 4000   // 4000 + event id
const ID_SUB_BASE      = 5000   // 5000 + sub id

// Parse 'HH:MM', falling back to 09:00 if the stored value is malformed so we
// never hand setHours(NaN) to the scheduler (which yields an Invalid Date).
function parseHhmm(hhmm: string): [number, number] {
  const [h, m] = (hhmm ?? '').split(':').map(Number)
  return [Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0]
}

function nextOccurrence(hhmm: string): Date {
  const [h, m] = parseHhmm(hhmm)
  const now = new Date()
  const next = new Date(now)
  next.setHours(h, m, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
  return next
}

// Next time the given weekday (0=Sun..6=Sat) occurs at hh:mm, strictly in the future.
function nextWeekdayOccurrence(weekday: number, hhmm: string): Date {
  const [h, m] = parseHhmm(hhmm)
  const now = new Date()
  const next = new Date(now)
  next.setHours(h, m, 0, 0)
  let delta = (weekday - next.getDay() + 7) % 7
  if (delta === 0 && next <= now) delta = 7
  next.setDate(next.getDate() + delta)
  return next
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  const { display } = await LocalNotifications.requestPermissions()
  return display === 'granted'
}

export async function scheduleWeightReminder(time: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  await LocalNotifications.cancel({ notifications: [{ id: ID_WEIGHT }] })
  await LocalNotifications.schedule({
    notifications: [{
      id: ID_WEIGHT,
      title: 'Log your weight',
      body: 'Tap to record today\'s weight.',
      schedule: { at: nextOccurrence(time), repeats: true, every: 'day' },
      smallIcon: 'ic_stat_icon_config_sample',
    }]
  })
}

export async function dismissWeightReminder(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  await LocalNotifications.removeDeliveredNotifications({ notifications: [{ id: ID_WEIGHT, title: '', body: '' }] })
}

export async function scheduleHabitReminder(time: string, habitNames: string[]): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  await LocalNotifications.cancel({ notifications: [{ id: ID_HABIT }] })
  const body = habitNames.length > 0
    ? `${habitNames.slice(0, 3).join(', ')}${habitNames.length > 3 ? ' and more' : ''}`
    : 'Check your habits for today.'
  await LocalNotifications.schedule({
    notifications: [{
      id: ID_HABIT,
      title: 'Habit reminder',
      body,
      schedule: { at: nextOccurrence(time), repeats: true, every: 'day' },
      smallIcon: 'ic_stat_icon_config_sample',
    }]
  })
}

export async function scheduleSleepReminder(time: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  await LocalNotifications.cancel({ notifications: [{ id: ID_SLEEP }] })
  await LocalNotifications.schedule({
    notifications: [{
      id: ID_SLEEP,
      title: 'Time to wind down',
      body: 'Get ready for bed to hit your sleep goal.',
      schedule: { at: nextOccurrence(time), repeats: true, every: 'day' },
      smallIcon: 'ic_stat_icon_config_sample',
    }]
  })
}

export interface CircadianNudgeSlot {
  time: string   // 'HH:MM'
  title: string
  body: string
}

// Schedule wake-relative circadian nudges. Each slot is optional — pass null to skip
// it (e.g. when that slot is already logged today). Times are personalized by the
// caller from wake time, not hardcoded. Returns false if notifications aren't
// permitted (so callers can surface that instead of failing silently).
export async function scheduleCircadianNudges(slots: {
  morning?: CircadianNudgeSlot | null
  noon?: CircadianNudgeSlot | null
  evening?: CircadianNudgeSlot | null
}): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false

  // Always clear all three first so a now-skipped slot doesn't keep firing.
  await LocalNotifications.cancel({
    notifications: [{ id: ID_CIRC_MORNING }, { id: ID_CIRC_NOON }, { id: ID_CIRC_EVENING }],
  })

  // Don't schedule into a void — checkPermissions avoids silent no-ops on Android 13+.
  const granted = (await LocalNotifications.checkPermissions()).display === 'granted'
  if (!granted) return false

  const byId: Record<'morning' | 'noon' | 'evening', number> = {
    morning: ID_CIRC_MORNING, noon: ID_CIRC_NOON, evening: ID_CIRC_EVENING,
  }
  const toSchedule = (['morning', 'noon', 'evening'] as const)
    .map((key) => ({ key, slot: slots[key] }))
    .filter((x): x is { key: 'morning' | 'noon' | 'evening'; slot: CircadianNudgeSlot } => !!x.slot)
    .map(({ key, slot }) => ({
      id: byId[key],
      title: slot.title,
      body: slot.body,
      schedule: { at: nextOccurrence(slot.time), repeats: true, every: 'day' as const },
      smallIcon: 'ic_stat_icon_config_sample',
    }))

  if (toSchedule.length) await LocalNotifications.schedule({ notifications: toSchedule })
  return true
}

// Daily morning summary. Body is composed by the caller (App.vue) from the latest
// snapshot and re-scheduled on every app open so it reflects current data.
export async function scheduleMorningSummary(time: string, body: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  await LocalNotifications.cancel({ notifications: [{ id: ID_MORNING }] })
  const granted = (await LocalNotifications.checkPermissions()).display === 'granted'
  if (!granted) return
  await LocalNotifications.schedule({
    notifications: [{
      id: ID_MORNING,
      title: 'Good morning',
      body,
      schedule: { at: nextOccurrence(time), repeats: true, every: 'day' },
      smallIcon: 'ic_stat_icon_config_sample',
    }]
  })
}

export async function cancelMorningSummary(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  await LocalNotifications.cancel({ notifications: [{ id: ID_MORNING }] })
}

// Weekly digest fired once a week on `weekday` (0=Sun..6=Sat) at `time`.
export async function scheduleWeeklyDigest(weekday: number, time: string, body: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  await LocalNotifications.cancel({ notifications: [{ id: ID_WEEKLY }] })
  const granted = (await LocalNotifications.checkPermissions()).display === 'granted'
  if (!granted) return
  await LocalNotifications.schedule({
    notifications: [{
      id: ID_WEEKLY,
      title: 'Your week in review',
      body,
      schedule: { at: nextWeekdayOccurrence(weekday, time), repeats: true, every: 'week' },
      smallIcon: 'ic_stat_icon_config_sample',
    }]
  })
}

export async function cancelWeeklyDigest(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  await LocalNotifications.cancel({ notifications: [{ id: ID_WEEKLY }] })
}

export async function scheduleCalendarReminders(
  events: { id: number; title: string; date: string; time_start?: string | null; recurrence?: string | null }[],
  minsBefore: number
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  // Cancel previous calendar notifications
  const prevIds = events.map(e => ({ id: ID_CAL_BASE + e.id }))
  if (prevIds.length) await LocalNotifications.cancel({ notifications: prevIds })

  const today = localDateISO()
  const toSchedule = []
  for (const ev of events) {
    if (!ev.time_start) continue
    // Recurring events keep their original start date, but this batch is today's
    // occurrences — fire them today, not on the (past) start date.
    const occDate = ev.recurrence && ev.recurrence !== 'none' ? today : ev.date
    const fireAt = new Date(`${occDate}T${ev.time_start}:00`)
    fireAt.setMinutes(fireAt.getMinutes() - minsBefore)
    if (fireAt <= new Date()) continue
    toSchedule.push({
      id: ID_CAL_BASE + ev.id,
      title: ev.title,
      body: minsBefore > 0 ? `Starting in ${minsBefore} min` : 'Starting now',
      schedule: { at: fireAt },
      smallIcon: 'ic_stat_icon_config_sample',
    })
  }
  if (toSchedule.length) await LocalNotifications.schedule({ notifications: toSchedule })
}

export async function scheduleSubscriptionReminders(
  subs: { id: number; name: string; amount: number; next_due_date: string | null }[],
  daysBefore: number
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  const prevIds = subs.map(s => ({ id: ID_SUB_BASE + s.id }))
  if (prevIds.length) await LocalNotifications.cancel({ notifications: prevIds })

  const toSchedule = []
  const today = new Date()
  for (const sub of subs) {
    if (!sub.next_due_date) continue
    const fireAt = new Date(sub.next_due_date + 'T09:00:00')
    fireAt.setDate(fireAt.getDate() - daysBefore)
    fireAt.setHours(9, 0, 0, 0)
    if (fireAt <= today) continue
    toSchedule.push({
      id: ID_SUB_BASE + sub.id,
      title: `${sub.name} renews soon`,
      body: daysBefore === 0
        ? `${sub.name} renews today — ${formatCurrency(sub.amount)}`
        : `Renews in ${daysBefore} day${daysBefore !== 1 ? 's' : ''} — ${formatCurrency(sub.amount)}`,
      schedule: { at: fireAt },
      smallIcon: 'ic_stat_icon_config_sample',
    })
  }
  if (toSchedule.length) await LocalNotifications.schedule({ notifications: toSchedule })
}

export async function cancelWeightReminder(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  await LocalNotifications.cancel({ notifications: [{ id: ID_WEIGHT }] })
}

export async function cancelHabitReminder(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  await LocalNotifications.cancel({ notifications: [{ id: ID_HABIT }] })
}

export async function cancelSleepReminder(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  await LocalNotifications.cancel({ notifications: [{ id: ID_SLEEP }] })
}

export async function cancelCalendarReminders(eventIds: number[]): Promise<void> {
  if (!Capacitor.isNativePlatform() || !eventIds.length) return
  await LocalNotifications.cancel({ notifications: eventIds.map((id) => ({ id: ID_CAL_BASE + id })) })
}

export async function cancelSubscriptionReminders(subIds: number[]): Promise<void> {
  if (!Capacitor.isNativePlatform() || !subIds.length) return
  await LocalNotifications.cancel({ notifications: subIds.map((id) => ({ id: ID_SUB_BASE + id })) })
}

export async function cancelAllNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  const pending = await LocalNotifications.getPending()
  if (pending.notifications.length) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) })
  }
}
