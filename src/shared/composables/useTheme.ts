import { computed, ref } from 'vue'

/**
 * Global theme state for the Nothing design system.
 *
 * The whole skin lives in CSS tokens (`src/theme/variables.css`):
 *  - dark/light is the `theme-light` class on <html> re-pointing the
 *    surface/ink tokens,
 *  - the STYLE axis (classic vs the Nothing OS 5 look) is the
 *    `theme-os5` class re-pointing fonts/radii/surface-material tokens.
 * Flipping the classes re-skins every page automatically.
 *
 * Three colour modes:
 *   - 'system' (default) — follow the OS `prefers-color-scheme`, live.
 *   - 'light' / 'dark'   — pin a theme regardless of the OS.
 *
 * Two styles (what Nothing OS 5.0 itself ships as — an additional theme
 * alongside the classic one):
 *   - 'classic' (default) — dot-matrix numerics, flat surfaces.
 *   - 'os5'               — Geist type, frosted translucent panels,
 *                           bigger radii; Doto demoted to accent duty.
 *
 * The exception to the token approach is colour that CSS variables can't reach:
 * <canvas> (Chart.js) and SVG presentation attributes (`fill="…"`). For those,
 * use the reactive `ink(alpha)` helper, which returns a concrete rgba() string
 * for the *effective* theme so chart/SVG colours track the choice too.
 */
export type ThemeMode = 'dark' | 'light' | 'system'
export type ThemeStyle = 'classic' | 'os5'

const THEME_KEY = 'app_theme'
const STYLE_KEY = 'app_theme_style'

// Module-level singletons so every importer shares one reactive source.
const mode = ref<ThemeMode>('system')        // the user's chosen colour mode
const style = ref<ThemeStyle>('classic')     // the user's chosen style skin
const systemDark = ref(true)                 // current OS preference

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

function applyClasses(): void {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('theme-light', resolve(mode.value) === 'light')
    document.documentElement.classList.toggle('theme-os5', style.value === 'os5')
  }
}

export function getStoredTheme(): ThemeMode {
  const v = localStorage.getItem(THEME_KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

export function getStoredStyle(): ThemeStyle {
  const v = localStorage.getItem(STYLE_KEY)
  return v === 'os5' ? 'os5' : 'classic'
}

export function setThemeMode(m: ThemeMode): void {
  mode.value = m
  localStorage.setItem(THEME_KEY, m)
  applyClasses()
}

export function setThemeStyle(s: ThemeStyle): void {
  style.value = s
  localStorage.setItem(STYLE_KEY, s)
  applyClasses()
}

/**
 * Apply the persisted theme + style and start following the OS when in
 * 'system' mode. Call once, before mount, to avoid a flash.
 */
export function initTheme(): void {
  mode.value = getStoredTheme()
  style.value = getStoredStyle()
  systemDark.value = systemPrefersDark()
  applyClasses()

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => {
      systemDark.value = e.matches
      if (mode.value === 'system') applyClasses()
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

  return { mode, style, effective, isLight, inkRGB, ink, setThemeMode, setThemeStyle }
}
