import { describe, expect, test, beforeEach, vi } from 'vitest'
import {
  restTimerState,
  REST_TIMER_KEY,
  startRestTimer,
  cancelRestTimer,
  resumeRestTimer,
  readRestTimerRecord,
  restTimerRemaining,
} from '@/shared/composables/useRestTimer'

// jsdom in this setup doesn't expose localStorage — stub the storage surface the
// composable uses (same get/set/remove semantics).
const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => void store.clear(),
})

// The composable clears the OS ding + countdown notification on every cancel —
// assert those calls so the ghost-ding regression (Batch 1 #2) stays fixed.
vi.mock('@/shared/utils/notifications', () => ({
  cancelRestTimerDing: vi.fn(),
}))
vi.mock('@/shared/utils/restTimerAudio', () => ({
  clearRestNotification: vi.fn(),
}))
import { cancelRestTimerDing } from '@/shared/utils/notifications'
import { clearRestNotification } from '@/shared/utils/restTimerAudio'

describe('useRestTimer', () => {
  beforeEach(() => {
    localStorage.clear()
    restTimerState.value = { isActive: false, remaining: 0, total: 0 }
    vi.clearAllMocks()
  })

  test('startRestTimer persists canonical endTime and arms shared state', () => {
    startRestTimer({ seconds: 90, exerciseName: 'Squat' })
    expect(restTimerState.value.isActive).toBe(true)
    expect(restTimerState.value.remaining).toBe(90)
    expect(restTimerState.value.total).toBe(90)

    const saved = JSON.parse(localStorage.getItem(REST_TIMER_KEY)!)
    expect(saved.exerciseName).toBe('Squat')
    expect(saved.total).toBe(90)
    expect(saved.endTime).toBeGreaterThan(Date.now())
  })

  test('cancelRestTimer clears storage and cancels OS ding + notification', () => {
    startRestTimer({ seconds: 30 })
    cancelRestTimer()
    expect(localStorage.getItem(REST_TIMER_KEY)).toBeNull()
    expect(restTimerState.value.isActive).toBe(false)
    expect(cancelRestTimerDing).toHaveBeenCalled()
    expect(clearRestNotification).toHaveBeenCalled()
  })

  test('expiry fires onExpire once and finalises state', () => {
    vi.useFakeTimers()
    try {
      const onExpire = vi.fn()
      startRestTimer({ seconds: 2, onExpire })
      vi.advanceTimersByTime(2100)
      expect(onExpire).toHaveBeenCalledTimes(1)
      expect(restTimerState.value.isActive).toBe(false)
      expect(localStorage.getItem(REST_TIMER_KEY)).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  test('resumeRestTimer restores remaining from canonical endTime', () => {
    const endTime = Date.now() + 45_000
    localStorage.setItem(REST_TIMER_KEY, JSON.stringify({ endTime, exerciseName: 'Bench', total: 60 }))
    const state = resumeRestTimer()
    expect(state.isActive).toBe(true)
    expect(state.remaining).toBeGreaterThan(40)
    expect(state.remaining).toBeLessThanOrEqual(45)
    expect(state.total).toBe(60)
    cancelRestTimer()
  })

  test('resumeRestTimer with expired record finalises without expiring on-screen', () => {
    localStorage.setItem(REST_TIMER_KEY, JSON.stringify({ endTime: Date.now() - 1000, total: 30 }))
    const onExpire = vi.fn()
    const state = resumeRestTimer(undefined, onExpire)
    expect(state.isActive).toBe(false)
    expect(onExpire).not.toHaveBeenCalled()
  })

  test('readRestTimerRecord returns null for absent/corrupt records', () => {
    expect(readRestTimerRecord()).toBeNull()
    localStorage.setItem(REST_TIMER_KEY, 'not json')
    expect(readRestTimerRecord()).toBeNull()
    localStorage.setItem(REST_TIMER_KEY, JSON.stringify({ total: 30 }))
    expect(readRestTimerRecord()).toBeNull()
  })

  test('restTimerRemaining derives from endTime, never drifts', () => {
    const record = { endTime: Date.now() + 10_000, total: 30, exerciseName: '' }
    expect(restTimerRemaining(record)).toBeLessThanOrEqual(10)
    expect(restTimerRemaining({ ...record, endTime: Date.now() - 5000 })).toBe(0)
  })
})
