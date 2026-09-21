import { describe, it, expect, beforeEach, vi } from 'vitest'

// jsdom has no localStorage — stub it (same pattern as the other specs).
const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => void store.clear(),
})

// Capacitor mock: isNativePlatform false by default; individual tests flip it
// and capture what sync() was called with.
const h = vi.hoisted(() => {
  const syncCalls: string[] = []
  const state = { native: false }
  return {
    state,
    // Matches real Capacitor's method-style call if anything touches it.
    Capacitor: {
      isNativePlatform: () => state.native,
    },
    registerPlugin: () => ({
      sync: async (opts: { data: string }) => {
        syncCalls.push(opts.data)
      },
    }),
    syncCalls,
  }
})
vi.mock('@capacitor/core', () => ({
  Capacitor: h.Capacitor,
  registerPlugin: h.registerPlugin,
}))

import { updateSleepWidget, updateWidgetFields } from '@/shared/widget/widgetBridge'
const syncCalls = h.syncCalls

const sleepState = {
  date: '2026-09-21',
  sleepScore: 88,
  sleepHours: 7.6,
  delta7d: 2,
  bedtime: '23:10',
  waketime: '06:55',
  deepMinutes: 90,
  remMinutes: 60,
  stageSegments: null,
}

beforeEach(() => {
  store.clear()
  syncCalls.length = 0
  h.state.native = true
})

describe('widget snapshot merge (regression: producers blanking each other)', () => {
  it('health sync writes sleep fields', async () => {
    await updateSleepWidget(sleepState)
    const blob = JSON.parse(syncCalls[0])
    expect(blob.sleepScore).toBe(88)
    expect(blob.date).toBe('2026-09-21')
  })

  it('briefing push does NOT blank sleep fields (the regression)', async () => {
    await updateSleepWidget(sleepState)
    await updateWidgetFields({
      briefingTitle: 'Daily briefing — PUSH',
      briefingBody: 'Verdict: PUSH',
      briefingDate: '2026-09-21',
    })
    const blob = JSON.parse(syncCalls[syncCalls.length - 1])
    // sleep fields survive…
    expect(blob.sleepScore).toBe(88)
    expect(blob.stageSegments).toBeUndefined() // was null → dropped, fine
    // …and briefing fields landed
    expect(blob.briefingTitle).toBe('Daily briefing — PUSH')
  })

  it('sleep re-push does not wipe briefing fields either', async () => {
    await updateWidgetFields({
      briefingTitle: 'B1',
      briefingBody: 'body',
      briefingDate: '2026-09-21',
    })
    await updateSleepWidget(sleepState)
    const blob = JSON.parse(syncCalls[syncCalls.length - 1])
    expect(blob.briefingTitle).toBe('B1')
    expect(blob.sleepScore).toBe(88)
  })

  it('newer sleep data overwrites older sleep data', async () => {
    await updateSleepWidget(sleepState)
    await updateSleepWidget({ ...sleepState, sleepScore: 91 })
    const blob = JSON.parse(syncCalls[syncCalls.length - 1])
    expect(blob.sleepScore).toBe(91)
  })

  it('no-ops on web', async () => {
    h.state.native = false
    await updateSleepWidget(sleepState)
    expect(syncCalls).toHaveLength(0)
  })
})
