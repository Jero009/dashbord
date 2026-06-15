import { registerPlugin, Capacitor } from '@capacitor/core'

// Native bridge to RestTimerAudio (android/app/.../RestTimerAudio.java). Ducks
// other audio (the user's music), plays the rest-timer ding, then restores the
// original volume. No-op web fallback is handled by the caller.
interface RestTimerAudioPlugin {
  duckAndDing(): Promise<void>
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
