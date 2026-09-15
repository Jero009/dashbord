// v3.x scrub interaction for Chart.js canvases — the bar / multi-series
// counterpart to TrendChart. Mirrors TrendChart's contract: whole-surface
// pointer scrub, hairline + marker at the selected index, hapticLight only
// when the selected index changes. The host renders the readout row from the
// reactive `selectedIdx` (defaults to the latest point when null).
//
// Used via two pieces:
//   - `scrubPlugin` → pass in the chart config's `plugins` array; it draws the
//     hairline + marker after datasets render.
//   - `onDown/onMove/onUp` → bind on the canvas; touch-action: pan-y keeps
//     vertical page scroll working.
import { ref } from 'vue';
import { hapticLight } from '@/shared/utils/haptics';
import { chartInk, chartColors } from '@/shared/utils/chartStyle';
import { nearestXIndex } from '@/shared/utils/chartGeom';
import type { Chart } from 'chart.js';

export function useChartScrub(opts: {
  chart: () => Chart | null;
  count: () => number;
  /** indexAxis 'y' charts (horizontal bars) scrub vertically. */
  vertical?: boolean;
}) {
  const selectedIdx = ref<number | null>(null);
  let scrubbing = false;

  const pixelFor = (i: number): number | null => {
    const chart = opts.chart();
    if (!chart) return null;
    const scale = opts.vertical ? chart.scales.y : chart.scales.x;
    if (!scale) return null;
    return scale.getPixelForDecimal((i + 0.5) / Math.max(opts.count(), 1));
  };

  const canvasPos = (e: PointerEvent): number | null => {
    const canvas = opts.chart()?.canvas;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return opts.vertical ? e.clientY - rect.top : e.clientX - rect.left;
  };

  const select = (e: PointerEvent) => {
    const n = opts.count();
    if (!n) return;
    const pos = canvasPos(e);
    if (pos === null) return;
    const pixels = Array.from({ length: n }, (_, i) => pixelFor(i) ?? 0);
    const i = nearestXIndex(pixels, pos);
    if (i !== selectedIdx.value) {
      selectedIdx.value = i;
      hapticLight();
      opts.chart()?.draw(); // re-render so the plugin picks up the new index
    }
  };

  const onDown = (e: PointerEvent) => {
    scrubbing = true;
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    select(e);
  };
  const onMove = (e: PointerEvent) => { if (scrubbing) select(e); };
  const onUp = () => { scrubbing = false; };

  const scrubPlugin = {
    id: 'chartScrub',
    afterDatasetsDraw(chart: Chart) {
      const idx = selectedIdx.value;
      if (idx === null || idx >= opts.count()) return;
      const pix = pixelFor(idx);
      if (pix === null) return;
      const { ctx, chartArea } = chart;
      ctx.save();
      ctx.strokeStyle = chartInk(0.3);
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (opts.vertical) {
        ctx.moveTo(chartArea.left, pix);
        ctx.lineTo(chartArea.right, pix);
      } else {
        ctx.moveTo(pix, chartArea.top);
        ctx.lineTo(pix, chartArea.bottom);
      }
      ctx.stroke();
      // Marker dot on every visible dataset at the selected index (line points,
      // or the top edge of bars).
      chart.data.datasets.forEach((ds, di) => {
        const meta = chart.getDatasetMeta(di);
        if (meta.hidden) return;
        const el = meta.data[idx] as { x: number; y: number } | undefined;
        if (!el) return;
        ctx.beginPath();
        ctx.arc(el.x, el.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = chartColors.red;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)'; // tooltip backdrop — reads on red bars
        ctx.stroke();
      });
      ctx.restore();
    },
  };

  return { selectedIdx, scrubPlugin, onDown, onMove, onUp };
}
