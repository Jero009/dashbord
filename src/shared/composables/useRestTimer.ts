// Shared rest-timer state (FIXPLAN Batch 1 #2). WorkoutPage owns the timer —
// it starts/stops/edits it, schedules the OS ding and the countdown
// notification, and plays the in-app ding on foreground expiry. GymHomePage and
// HomePage only need to READ the countdown and CLEAR the timer; they used to
// re-implement that (three copies drifting), so it lives here.
//
// Canonical state is the wall-clock `endTime` in localStorage under `restTimer`
// (survives a full process kill). `cancel()` clears storage, the pending OS
// ding and the ongoing countdown notification, so every clearer gets the
// cancel-the-alarm path for free.
import { ref } from 'vue'
import { cancelRestTimerDing } from '@/shared/utils/notifications'
import { clearRestNotification } from '@/shared/utils/restTimerAudio'

export const REST_TIMER_KEY = 'restTimer'

export interface RestTimerState {
  isActive: boolean
  remaining: number
  total: number
}

export const restTimerState = ref<RestTimerState>({ isActive: false, remaining: 0, total: 0 })

let interval: ReturnType<typeof setInterval> | null = null

const stopInterval = () => {
  if (interval) {
    clearInterval(interval)
    interval = null
  }
}

/** Stop the shared countdown interval without touching state (teardown path). */
export function stopRestInterval(): void {
  stopInterval()
}

export interface ParsedRestTimer {
  endTime: number
  total: number
  exerciseName: string
}

/** Parse the canonical localStorage record; null when absent/corrupt. */
export function readRestTimerRecord(): ParsedRestTimer | null {
  const saved = localStorage.getItem(REST_TIMER_KEY)
  if (!saved) return null
  try {
    const parsed = JSON.parse(saved)
    const endTime = Number(parsed.endTime)
    if (!Number.isFinite(endTime)) return null
    return {
      endTime,
      total: Math.max(1, Number(parsed.total) || 0),
      exerciseName: typeof parsed.exerciseName === 'string' ? parsed.exerciseName : '',
    }
  } catch {
    return null
  }
}

/** Seconds left right now, derived from the canonical endTime (never drifts). */
export function restTimerRemaining(record: ParsedRestTimer): number {
  return Math.max(0, Math.ceil((record.endTime - Date.now()) / 1000))
}

// Clear the timer everywhere: stop the shared interval, wipe canonical state,
// and cancel the OS-level ding + countdown notification. Every path that ends
// the rest early goes through this — the scheduled ding must never outlive a
// rest the user already finished on-screen.
export function cancelRestTimer(): void {
  stopInterval()
  restTimerState.value = { isActive: false, remaining: 0, total: 0 }
  localStorage.removeItem(REST_TIMER_KEY)
  void cancelRestTimerDing()
  void clearRestNotification()
}

export interface StartRestTimerOptions {
  seconds: number
  exerciseName?: string
  /** Called every tick with the seconds left; return false to end the timer. */
  onTick?: (remaining: number) => boolean | void
  /** Called once when the countdown reaches zero while the app is alive. */
  onExpire?: () => void
}

// Drive the countdown for a page that hosts the timer (WorkoutPage). Starts a
// fresh timer at `seconds` and owns the ding/notification scheduling contract:
// the caller schedules the OS ding itself (it also adjusts `endTime` on +30s,
// which re-schedules), expiry here just finalises state.
export function startRestTimer(
  { seconds, exerciseName = '', onTick, onExpire }: StartRestTimerOptions,
): void {
  stopInterval()
  const total = Math.max(1, Math.floor(Number(seconds) || 60))
  const endTime = Date.now() + total * 1000
  localStorage.setItem(REST_TIMER_KEY, JSON.stringify({ endTime, exerciseName, total }))
  restTimerState.value = { isActive: true, remaining: total, total }

  const tick = () => {
    const remaining = restTimerRemaining({ endTime, total, exerciseName })
    restTimerState.value.remaining = remaining
    const keepGoing = onTick?.(remaining)
    if (remaining <= 0 || keepGoing === false) {
      stopInterval()
      restTimerState.value = { isActive: false, remaining: 0, total: 0 }
      localStorage.removeItem(REST_TIMER_KEY)
      if (remaining <= 0) onExpire?.()
    }
  }
  tick()
  interval = setInterval(tick, 1000)
}

// Resume the countdown for a page that only displays the timer (GymHomePage /
// HomePage chips, or WorkoutPage's restore path). Reads canonical storage; a
// stale/absent record finalises the shared state. `onExpire` fires when the
// countdown hits zero on-screen — the page passes its own expiry handling.
export function resumeRestTimer(
  onTick?: (remaining: number) => void,
  onExpire?: () => void,
): RestTimerState {
  stopInterval()
  const record = readRestTimerRecord()
  if (!record) {
    restTimerState.value = { isActive: false, remaining: 0, total: 0 }
    return restTimerState.value
  }
  const remaining = restTimerRemaining(record)
  if (remaining <= 0) {
    restTimerState.value = { isActive: false, remaining: 0, total: record.total }
    return restTimerState.value
  }
  restTimerState.value = { isActive: true, remaining, total: record.total }
  const tick = () => {
    const left = restTimerRemaining(record)
    restTimerState.value.remaining = left
    onTick?.(left)
    if (left <= 0) {
      stopInterval()
      restTimerState.value = { isActive: false, remaining: 0, total: record.total }
      onExpire?.()
    }
  }
  tick()
  interval = setInterval(tick, 1000)
  return restTimerState.value
}
