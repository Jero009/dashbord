<template>
  <div ref="wrapEl" class="stagebars">
    <!-- Readout: defaults to the latest night, follows the scrub finger -->
    <div class="stagebars__readout">
      <strong class="stagebars__value">{{ readoutTotal }}</strong>
      <span class="stagebars__meta">{{ readoutMeta }}</span>
    </div>

    <svg
      class="stagebars__svg"
      :viewBox="`0 0 ${Math.max(w, 1)} ${Math.max(svgH, 1)}`"
      role="img"
      aria-label="Sleep stage composition, last 30 nights"
      @pointerdown.prevent="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
    >
      <g
        v-for="bar in bars"
        :key="bar.idx"
        class="stagebars__bar"
        :style="{ animationDelay: `${Math.min(bar.idx * 8, 400)}ms` }"
      >
        <rect
          v-for="(seg, i) in bar.segments"
          :key="i"
          :x="bar.x"
          :y="seg.y"
          :width="barW"
          :height="seg.h"
          rx="2"
          :fill="STAGE_COLORS[seg.stage]"
        />
      </g>
    </svg>

    <div class="stagebars__axis">
      <span>{{ firstLabel }}</span>
      <span>{{ lastLabel }}</span>
    </div>

    <!-- Legend: same four stage-dot pairs as the Stages card -->
    <div class="stagebars__legend">
      <span v-for="stage in LEGEND" :key="stage.key" class="stagebars__legend-item">
        <i class="stage-dot" :class="`stage-dot--${stage.key}`" />{{ stage.label }}
      </span>
    </div>
  </div>
</template>

<!--
  30-night stacked stage-composition chart (deep/light/REM/awake minutes per
  night). Same interaction contract as TrendChart: readout row on top, scrub
  anywhere on the plot with a haptic tick on change, whole surface is the
  touch target, touch-action: pan-y. Bars rise from the x-axis on entrance
  (staggered, capped); prefers-reduced-motion neutralizes it globally.
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { buildStageBars, nearestNightIndex, STAGE_COLORS, type StageNight } from '@/shared/utils/stageBarsGeom';
import { hapticLight } from '@/shared/utils/haptics';

const props = defineProps<{
  nights: StageNight[]; // ordered oldest → newest
}>();

const TOTAL_H = 148;
const READOUT_H = 24;
const AXIS_H = 16;
const LEGEND_H = 20;
const svgH = TOTAL_H - READOUT_H - AXIS_H - LEGEND_H;

const LEGEND = [
  { key: 'deep', label: 'Deep' },
  { key: 'light', label: 'Light' },
  { key: 'rem', label: 'REM' },
  { key: 'awake', label: 'Awake' },
] as const;

const wrapEl = ref<HTMLElement>();
const w = ref(0);
let ro: ResizeObserver | null = null;

onMounted(() => {
  if (!wrapEl.value) return;
  w.value = wrapEl.value.clientWidth;
  ro = new ResizeObserver((es) => { w.value = es[0].contentRect.width; });
  ro.observe(wrapEl.value);
});
onBeforeUnmount(() => ro?.disconnect());

const bars = computed(() => buildStageBars(props.nights, w.value, svgH));
const barW = computed(() => {
  const n = props.nights.length;
  if (!n || !w.value) return 0;
  return Math.max((w.value / n) * 0.6, 1);
});

// ---- scrub ----------------------------------------------------------------
const scrubIdx = ref<number | null>(null);
const active = computed(() => {
  const idx = scrubIdx.value ?? Math.max(props.nights.length - 1, 0);
  return props.nights[idx] ?? null;
});
const totalOf = (n: StageNight | null) =>
  n ? n.deep + n.rem + n.light + n.awake : 0;
const readoutTotal = computed(() => {
  const h = totalOf(active.value) / 60;
  return totalOf(active.value) ? `${h.toFixed(1)} h` : '—';
});
const readoutMeta = computed(() => {
  const n = active.value;
  if (!n || !totalOf(n)) return '';
  const label = (mins: number) => `${(mins / 60).toFixed(1)}h`;
  const parts = [
    `${label(n.deep)} deep`,
    `${label(n.rem)} REM`,
  ];
  const date = new Date(`${n.date}T00:00:00`);
  const dateLabel = Number.isNaN(date.getTime())
    ? n.date
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${parts.join(' · ')} — ${dateLabel}`;
});

const firstLabel = computed(() => {
  const n = props.nights[0];
  if (!n) return '';
  const d = new Date(`${n.date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
});
const lastLabel = computed(() => {
  const n = props.nights[props.nights.length - 1];
  if (!n) return '';
  const d = new Date(`${n.date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
});

let scrubbing = false;
const pointerX = (e: PointerEvent) => {
  const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
  // account for viewBox scaling (svg width is fluid, viewBox is w × svgH)
  const scale = w.value / rect.width;
  return (e.clientX - rect.left) * scale;
};
const select = (e: PointerEvent) => {
  if (!props.nights.length) return;
  const i = nearestNightIndex(pointerX(e), props.nights.length, w.value);
  if (i !== -1 && i !== scrubIdx.value) {
    scrubIdx.value = i;
    hapticLight(); // feedback on change, not on touch
  }
};
const onDown = (e: PointerEvent) => {
  scrubbing = true;
  (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
  select(e);
};
const onMove = (e: PointerEvent) => { if (scrubbing) select(e); };
const onUp = () => {
  scrubbing = false;
  scrubIdx.value = null; // final state = latest night, like TrendChart
};
</script>

<style scoped>
.stagebars {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  height: 148px;
  user-select: none;
  -webkit-user-select: none;
}

.stagebars__readout {
  display: flex;
  align-items: baseline;
  gap: 6px;
  height: 24px;
  padding: 0 2px 4px;
}

.stagebars__value {
  font-family: var(--nt-font-display);
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--ion-color-accent-red);
  font-variant-numeric: tabular-nums;
}

.stagebars__meta {
  margin-left: auto;
  font-size: 0.72rem;
  color: rgba(var(--nt-ink), 0.45);
  font-variant-numeric: tabular-nums;
}

.stagebars__svg {
  width: 100%;
  height: auto;
  display: block;
  touch-action: pan-y; /* horizontal drag scrubs, vertical still scrolls the page */
  cursor: crosshair;
}

.stagebars__bar {
  transform-origin: center bottom;
  animation: stagebars-rise var(--nt-dur-std) var(--nt-ease-decel) both;
}

@keyframes stagebars-rise {
  from { transform: scaleY(0); }
  to   { transform: scaleY(1); }
}

.stagebars__axis {
  display: flex;
  justify-content: space-between;
  height: 16px;
  padding-top: 4px;
  font-size: 0.68rem;
  color: rgba(var(--nt-ink), 0.4);
  font-variant-numeric: tabular-nums;
}

.stagebars__legend {
  display: flex;
  gap: 12px;
  height: 20px;
  align-items: center;
  font-size: 0.68rem;
  color: rgba(var(--nt-ink), 0.5);
}

.stagebars__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
</style>
