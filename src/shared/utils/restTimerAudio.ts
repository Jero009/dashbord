import { registerPlugin, Capacitor } from '@capacitor/core'

// Native bridge to RestTimerAudio (android/app/.../RestTimerAudio.java).
// - duckAndDing: ducks other audio (the user's music), plays the rest-timer
//   ding, then restores the original volume.
// - showRestNotification/clearRestNotification: ongoing notification with a live
//   countdown (system chronometer) and the current exercise name. Keeps ticking
//   while backgrounded/killed; self-clears at zero.
interface RestTimerAudioPlugin {
  duckAndDing(): Promise<void>
  showRestNotification(options: { exerciseName: string; durationMs: number }): Promise<void>
  clearRestNotification(): Promise<void>
}

const RestTimerAudio = registerPlugin<RestTimerAudioPlugin>('RestTimerAudio')

// Returns true when the native ding actually played, false when it isn't
// available (web, or the plugin call failed) so the caller can fall back to a
// Web Audio beep.
export async function duckAndDing(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    await RestTimerAudio.duckAndDing()
    return true
  } catch (e) {
    console.warn('RestTimerAudio.duckAndDing failed:', e)
    return false
  }
}

// Show/update the ongoing rest-timer countdown notification. `durationMs` is the
// time remaining from now; the native side renders a live countdown to that point.
export async function showRestNotification(exerciseName: string, durationMs: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await RestTimerAudio.showRestNotification({ exerciseName, durationMs })
  } catch (e) {
    console.warn('RestTimerAudio.showRestNotification failed:', e)
  }
}

export async function clearRestNotification(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await RestTimerAudio.clearRestNotification()
  } catch (e) {
    console.warn('RestTimerAudio.clearRestNotification failed:', e)
  }
}
