// Shared Chart.js styling — single source of truth so every graph in the
// app looks identical. Raw rgb/rgba values are required here: CSS custom
// properties (var(--nt-*)) do NOT resolve inside canvas rendering.
//
// To support the light theme, the foreground-derived colours (axis ticks,
// gridlines, dim series) are resolved from the active theme at access time via
// getters — Chart configs spread these objects when a chart (re)renders, so a
// chart picks up the right ink the next time it is built. `chartInk()` exposes
// the same value for ad-hoc canvas colours (e.g. doughnut slice palettes).

/** Foreground "ink" rgb triplet for the active theme — mirrors `--nt-ink`. */
function inkRGB(): string {
  const light =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('theme-light')
  return light ? '10, 10, 10' : '255, 255, 255'
}

/** rgba() ink string for canvas use where CSS var() can't resolve. */
export const chartInk = (alpha: number) => `rgba(${inkRGB()}, ${alpha})`

export const chartColors = {
  red: 'rgb(215, 26, 33)',
  redFill: 'rgba(215, 26, 33, 0.15)',
  goal: 'rgba(255, 215, 0, 0.6)',
  get dimLine() { return chartInk(0.25) },
  get tick() { return chartInk(0.4) },
  get grid() { return chartInk(0.1) },
}

// Standard red line-series look: spread first, then override per chart.
export const chartLineDataset = {
  borderColor: chartColors.red,
  backgroundColor: chartColors.redFill,
  borderWidth: 2,
  tension: 0.3,
  fill: true,
  pointRadius: 3,
  pointBackgroundColor: chartColors.red,
  pointBorderColor: 'transparent',
  pointHoverRadius: 5,
}

// Secondary series (forecasts, comparison lines): dim dashed ink.
export const chartDimDataset = {
  get borderColor() { return chartColors.dimLine },
  backgroundColor: 'transparent',
  borderWidth: 1.5,
  borderDash: [5, 4],
  tension: 0.3,
  fill: false,
  pointRadius: 0,
}

// Tooltip is always a dark floating overlay in both themes, so its text
// stays light regardless of the active theme.
export const chartTooltip = {
  backgroundColor: 'rgba(0, 0, 0, 0.85)',
  titleColor: 'rgba(255, 255, 255, 0.5)',
  bodyColor: '#fff',
  padding: 10,
}

export const chartTicks = {
  get color() { return chartColors.tick },
  font: { size: 10 },
}

export const chartGrid = {
  get color() { return chartColors.grid },
}
