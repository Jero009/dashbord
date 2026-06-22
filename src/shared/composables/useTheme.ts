import { computed, ref } from 'vue'

/**
 * Global light/dark theme state for the Nothing design system.
 *
 * The whole skin lives in CSS tokens (`src/theme/variables.css`): the light
 * theme is just the `theme-light` class on <html>, which re-points the surface
 * and "ink" tokens. So flipping the class re-skins every page automatically.
 *
 * The exception is colour that CSS variables can't reach: <canvas> (Chart.js)
 * and SVG presentation attributes (`fill="…"`, `stroke="…"`). For those, use
 * the reactive `ink(alpha)` helper, which returns a concrete rgba() string for
 * the active theme so chart/SVG colours track the toggle too.
 */
export type ThemeMode = 'dark' | 'light'

const THEME_KEY = 'app_theme'

// Module-level singleton so every importer shares one reactive source.
const theme = ref<ThemeMode>('dark')

export function getStoredTheme(): ThemeMode {
  return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
}

export function applyTheme(mode: ThemeMode): void {
  theme.value = mode
  // Guard for non-DOM contexts (SSR/tests) — harmless no-op there.
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('theme-light', mode === 'light')
  }
  localStorage.setItem(THEME_KEY, mode)
}

/** Apply the persisted theme. Call once, before mount, to avoid a flash. */
export function initTheme(): void {
  // Set the ref + class without re-writing localStorage to the same value.
  theme.value = getStoredTheme()
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('theme-light', theme.value === 'light')
  }
}

export function useTheme() {
  const isLight = computed(() => theme.value === 'light')

  // Foreground "ink" as a raw rgb triplet for the active theme — mirrors the
  // `--nt-ink` CSS token but as a literal so it works in canvas / SVG attrs.
  const inkRGB = computed(() => (isLight.value ? '10, 10, 10' : '255, 255, 255'))
  const ink = (alpha: number) => `rgba(${inkRGB.value}, ${alpha})`

  const setTheme = (mode: ThemeMode) => applyTheme(mode)
  const toggleTheme = () => applyTheme(theme.value === 'light' ? 'dark' : 'light')

  return { theme, isLight, inkRGB, ink, setTheme, toggleTheme }
}
