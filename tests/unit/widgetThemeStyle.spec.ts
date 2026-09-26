import { describe, it, expect, beforeEach, vi } from 'vitest'

// jsdom has no localStorage — stub it (same pattern as the other specs).
const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => void store.clear(),
})

// widgetBridge pushes only on native platforms — stub the Capacitor check so
// the merge/push path runs in tests (same factory-function pattern as
// widgetSnapshotMerge.spec.ts).
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
  registerPlugin: () => ({ sync: async () => undefined }),
}))

import { updateWidgetFields } from '@/shared/widget/widgetBridge'

describe('widgetBridge themeStyle', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('rides the pushed snapshot with the persisted style', async () => {
    localStorage.setItem('app_theme_style', 'os5')
    await updateWidgetFields({ sleepScore: 82 })
    const pushed = JSON.parse(localStorage.getItem('widgetBridge.snapshot') || '{}')
    expect(pushed.themeStyle).toBe('os5')
    expect(pushed.sleepScore).toBe(82)
  })

  it('defaults to classic when nothing was persisted', async () => {
    await updateWidgetFields({ sleepScore: 82 })
    const pushed = JSON.parse(localStorage.getItem('widgetBridge.snapshot') || '{}')
    expect(pushed.themeStyle).toBe('classic')
  })

  it('survives a subsequent producer push that omits it (merge keeps style)', async () => {
    localStorage.setItem('app_theme_style', 'os5')
    await updateWidgetFields({ sleepScore: 82 })
    await updateWidgetFields({ briefingTitle: 'Morning' })
    const pushed = JSON.parse(localStorage.getItem('widgetBridge.snapshot') || '{}')
    expect(pushed.themeStyle).toBe('os5')
    expect(pushed.sleepScore).toBe(82)
    expect(pushed.briefingTitle).toBe('Morning')
  })

  it('a style-only push (theme switch) re-renders widgets without touching data', async () => {
    localStorage.setItem('app_theme_style', 'classic')
    await updateWidgetFields({ sleepScore: 82 })
    localStorage.setItem('app_theme_style', 'os5')
    await updateWidgetFields({ themeStyle: 'os5' })
    const pushed = JSON.parse(localStorage.getItem('widgetBridge.snapshot') || '{}')
    expect(pushed.themeStyle).toBe('os5')
    expect(pushed.sleepScore).toBe(82)
  })
})
