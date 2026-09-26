import { describe, it, expect, beforeEach, vi } from 'vitest'

// jsdom in this setup exposes no localStorage — stub it (pattern shared with
// the other storage-touching specs).
const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => void store.clear(),
})

import { initTheme, useTheme, setThemeStyle, getStoredStyle } from '@/shared/composables/useTheme'

// jsdom-free environment guard: these tests exercise the persistence + class
// toggling logic that runs in any environment with document/localStorage.

describe('theme style axis (classic / os5)', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('theme-os5', 'theme-light')
  })

  it('defaults to classic and applies no os5 class', () => {
    initTheme()
    expect(getStoredStyle()).toBe('classic')
    expect(document.documentElement.classList.contains('theme-os5')).toBe(false)
  })

  it('persists and applies the os5 skin', () => {
    setThemeStyle('os5')
    expect(getStoredStyle()).toBe('os5')
    expect(localStorage.getItem('app_theme_style')).toBe('os5')
    expect(document.documentElement.classList.contains('theme-os5')).toBe(true)
  })

  it('reverts to classic cleanly', () => {
    setThemeStyle('os5')
    setThemeStyle('classic')
    expect(getStoredStyle()).toBe('classic')
    expect(document.documentElement.classList.contains('theme-os5')).toBe(false)
  })

  it('style is independent of the light/dark mode class', () => {
    setThemeStyle('os5')
    const { setThemeMode } = useTheme()
    setThemeMode('light')
    expect(document.documentElement.classList.contains('theme-os5')).toBe(true)
    expect(document.documentElement.classList.contains('theme-light')).toBe(true)
    setThemeMode('dark')
    expect(document.documentElement.classList.contains('theme-os5')).toBe(true)
    expect(document.documentElement.classList.contains('theme-light')).toBe(false)
  })

  it('useTheme exposes the style ref reactively', () => {
    setThemeStyle('classic')
    const { style } = useTheme()
    expect(style.value).toBe('classic')
    setThemeStyle('os5')
    expect(style.value).toBe('os5')
  })
})

// Keep the matchMedia listener path from throwing when window APIs are stubbed.
vi.stubGlobal('matchMedia', () => ({
  matches: true,
  addEventListener: () => {},
  removeEventListener: () => {},
}))
