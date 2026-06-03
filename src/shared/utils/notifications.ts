import { LocalNotifications } from '@capacitor/local-notifications'
import { Capacitor } from '@capacitor/core'

// Notification ID ranges — must be stable integers
const ID_WEIGHT   = 1
const ID_HABIT    = 2
const ID_SLEEP    = 3
const ID_CAL_BASE = 4000   // 4000 + event id
const ID_SUB_BASE = 5000   // 5000 + sub id

function nextOccurrence(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number)
  const now = new Date()
  const next = new Date(now)
  next.setHours(h, m, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
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

export async function scheduleCalendarReminders(
  events: { id: number; title: string; date: string; time_start?: string | null }[],
  minsBefore: number
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  // Cancel previous calendar notifications
  const prevIds = events.map(e => ({ id: ID_CAL_BASE + e.id }))
  if (prevIds.length) await LocalNotifications.cancel({ notifications: prevIds })

  const toSchedule = []
  for (const ev of events) {
    if (!ev.time_start) continue
    const fireAt = new Date(`${ev.date}T${ev.time_start}:00`)
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
        ? `${sub.name} renews today — $${sub.amount}`
        : `Renews in ${daysBefore} day${daysBefore !== 1 ? 's' : ''} — $${sub.amount}`,
      schedule: { at: fireAt },
      smallIcon: 'ic_stat_icon_config_sample',
    })
  }
  if (toSchedule.length) await LocalNotifications.schedule({ notifications: toSchedule })
}

export async function cancelAllNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  const pending = await LocalNotifications.getPending()
  if (pending.notifications.length) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) })
  }
}
