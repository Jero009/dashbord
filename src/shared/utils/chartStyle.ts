// Shared Chart.js styling — single source of truth so every graph in the
// app looks identical. Raw rgb/rgba values are required here: CSS custom
// properties (var(--nt-*)) do NOT resolve inside canvas rendering.

export const chartColors = {
  red: 'rgb(215, 26, 33)',
  redFill: 'rgba(215, 26, 33, 0.15)',
  dimLine: 'rgba(255, 255, 255, 0.25)',
  tick: 'rgba(255, 255, 255, 0.4)',
  grid: 'rgba(255, 255, 255, 0.1)',
  goal: 'rgba(255, 215, 0, 0.6)',
};

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
};

// Secondary series (forecasts, comparison lines): dim dashed white.
export const chartDimDataset = {
  borderColor: chartColors.dimLine,
  backgroundColor: 'transparent',
  borderWidth: 1.5,
  borderDash: [5, 4],
  tension: 0.3,
  fill: false,
  pointRadius: 0,
};

export const chartTooltip = {
  backgroundColor: 'rgba(0, 0, 0, 0.85)',
  titleColor: 'rgba(255, 255, 255, 0.5)',
  bodyColor: '#fff',
  padding: 10,
};

export const chartTicks = {
  color: chartColors.tick,
  font: { size: 10 },
};

export const chartGrid = {
  color: chartColors.grid,
};
