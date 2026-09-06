import { LocalNotifications } from '@capacitor/local-notifications'
import { Capacitor } from '@capacitor/core'

// Notification ID ranges — must be stable integers
const ID_WEIGHT        = 1
const ID_SLEEP         = 3
const ID_REST_TIMER    = 20

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

// Rest timer ding. Scheduled at the timer's end time when the set is completed,
// so the OS fires the alert even if the app is backgrounded or fully closed (a
// JS interval/Web Audio beep can't run then). When the app is alive at the end
// it plays an in-app ducked ding instead and cancels this so there's no double
// ding. The default notification sound ducks other media via its notification
// audio usage, matching the in-app duck-then-ding behaviour.
export async function scheduleRestTimerDing(at: Date): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  await LocalNotifications.cancel({ notifications: [{ id: ID_REST_TIMER }] })
  if (at.getTime() <= Date.now()) return
  const granted = (await LocalNotifications.checkPermissions()).display === 'granted'
  if (!granted) return
  await LocalNotifications.schedule({
    notifications: [{
      id: ID_REST_TIMER,
      title: 'Rest complete',
      body: 'Time for your next set.',
      schedule: { at },
      smallIcon: 'ic_stat_icon_config_sample',
    }]
  })
}

export async function cancelRestTimerDing(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  await LocalNotifications.cancel({ notifications: [{ id: ID_REST_TIMER }] })
}

export async function cancelWeightReminder(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  await LocalNotifications.cancel({ notifications: [{ id: ID_WEIGHT }] })
}

export async function cancelSleepReminder(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  await LocalNotifications.cancel({ notifications: [{ id: ID_SLEEP }] })
}

export async function cancelAllNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  const pending = await LocalNotifications.getPending()
  if (pending.notifications.length) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) })
  }
}
