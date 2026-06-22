import { computed, ref } from 'vue'

/**
 * Global light/dark theme state for the Nothing design system.
 *
 * The whole skin lives in CSS tokens (`src/theme/variables.css`): the light
 * theme is just the `theme-light` class on <html>, which re-points the surface
 * and "ink" tokens. So flipping the class re-skins every page automatically.
 *
 * Three user modes:
 *   - 'system' (default) — follow the OS `prefers-color-scheme`, live.
 *   - 'light' / 'dark'   — pin a theme regardless of the OS.
 *
 * The exception to the token approach is colour that CSS variables can't reach:
 * <canvas> (Chart.js) and SVG presentation attributes (`fill="…"`). For those,
 * use the reactive `ink(alpha)` helper, which returns a concrete rgba() string
 * for the *effective* theme so chart/SVG colours track the choice too.
 */
export type ThemeMode = 'dark' | 'light' | 'system'

const THEME_KEY = 'app_theme'

// Module-level singletons so every importer shares one reactive source.
const mode = ref<ThemeMode>('system')        // the user's chosen mode
const systemDark = ref(true)                  // current OS preference

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : true
}

/** The concrete theme in effect once 'system' is resolved. */
function resolve(m: ThemeMode): 'dark' | 'light' {
  if (m === 'system') return systemDark.value ? 'dark' : 'light'
  return m
}

function applyClass(): void {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('theme-light', resolve(mode.value) === 'light')
  }
}

export function getStoredTheme(): ThemeMode {
  const v = localStorage.getItem(THEME_KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

export function setThemeMode(m: ThemeMode): void {
  mode.value = m
  localStorage.setItem(THEME_KEY, m)
  applyClass()
}

/**
 * Apply the persisted theme and start following the OS when in 'system' mode.
 * Call once, before mount, to avoid a flash.
 */
export function initTheme(): void {
  mode.value = getStoredTheme()
  systemDark.value = systemPrefersDark()
  applyClass()

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => {
      systemDark.value = e.matches
      if (mode.value === 'system') applyClass()
    }
    // addEventListener is the modern API; fall back for older WebViews.
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange)
    else if (typeof mq.addListener === 'function') mq.addListener(onChange)
  }
}

export function useTheme() {
  const effective = computed<'dark' | 'light'>(() =>
    mode.value === 'system' ? (systemDark.value ? 'dark' : 'light') : mode.value,
  )
  const isLight = computed(() => effective.value === 'light')

  // Foreground "ink" as a raw rgb triplet for the effective theme — mirrors the
  // `--nt-ink` CSS token but as a literal so it works in canvas / SVG attrs.
  const inkRGB = computed(() => (isLight.value ? '10, 10, 10' : '255, 255, 255'))
  const ink = (alpha: number) => `rgba(${inkRGB.value}, ${alpha})`

  return { mode, effective, isLight, inkRGB, ink, setThemeMode }
}
