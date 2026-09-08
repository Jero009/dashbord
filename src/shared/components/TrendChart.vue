<template>
  <div ref="wrapEl" class="trend" :style="{ height: totalH + 'px' }">
    <!-- Readout: defaults to the latest point, follows the scrub finger -->
    <div v-if="!bare" class="trend__readout">
      <strong class="trend__value">{{ display }}</strong>
      <span v-if="unit" class="trend__unit">{{ unit }}</span>
      <span class="trend__meta">{{ active?.label ?? '' }}</span>
    </div>

    <svg
      class="trend__svg"
      :class="{ 'trend__svg--bare': bare }"
      :viewBox="`0 0 ${Math.max(w, 1)} ${Math.max(svgH, 1)}`"
      role="img"
      :aria-label="ariaLabel"
      @pointerdown.prevent="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
    >
      <defs>
        <linearGradient :id="uid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="bare ? 'rgba(215, 26, 33, 0.16)' : 'rgba(215, 26, 33, 0.20)'" />
          <stop offset="100%" stop-color="rgba(215, 26, 33, 0)" />
        </linearGradient>
      </defs>

      <path v-if="areaD" class="trend__area" :d="areaD" :fill="`url(#${uid})`" />
      <line v-if="goalY !== null" class="trend__goal" x1="0" :y1="goalY" :x2="w" :y2="goalY" />
      <line v-if="avgY !== null" class="trend__avg" x1="0" :y1="avgY" :x2="w" :y2="avgY" />
      <path v-if="lineD" class="trend__line" :d="lineD" />
      <line v-if="scrubIdx !== null && xs[scrubIdx] !== undefined" class="trend__hairline"
            :x1="xs[scrubIdx]" y1="0" :x2="xs[scrubIdx]" :y2="svgH" />
      <circle v-if="scrubIdx !== null" class="trend__dot trend__dot--bg" :cx="xs[scrubIdx]" :cy="ys[scrubIdx]" r="6" />
      <circle v-if="scrubIdx !== null" class="trend__dot" :cx="xs[scrubIdx]" :cy="ys[scrubIdx]" r="3.5" />
      <circle v-else-if="!bare && xs.length" class="trend__dot" :cx="xs[xs.length - 1]" :cy="ys[ys.length - 1]" r="3.5" />
    </svg>

    <div v-if="!bare" class="trend__axis">
      <span>{{ pts[0]?.label }}</span>
      <span>{{ pts[pts.length - 1]?.label }}</span>
    </div>
  </div>
</template>

<!--
  The app's standard line/area chart. Replaces every hand-rolled SVG trend:
  scrub anywhere on the plot (whole surface is the touch target), readout row
  defaults to the latest point. Sizes: xs = bare sparkline, sm/md framed.

  pts:    ordered oldest → newest. pos (0..1) optional for irregular spacing
          (e.g. overnight HR timeline); default = index spread.
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { padExtent, smoothPath, nearestXIndex } from '@/shared/utils/chartGeom';
import { hapticLight } from '@/shared/utils/haptics';

const props = withDefaults(defineProps<{
  pts: { label: string; value: number; pos?: number }[];
  unit?: string;
  size?: 'xs' | 'sm' | 'md';
  goal?: number | null;
  showAvg?: boolean;
  format?: (v: number) => string;
  ariaLabel?: string;
}>(), {
  unit: '',
  size: 'sm',
  goal: null,
  showAvg: false,
  ariaLabel: 'Trend chart',
});

const bare = computed(() => props.size === 'xs');
const TOTAL_H = { xs: 48, sm: 118, md: 156 } as const;
const READOUT_H = 24;
const AXIS_H = 16;
const totalH = TOTAL_H[props.size];
const svgH = bare.value ? totalH : totalH - READOUT_H - AXIS_H;

// Unique per-instance gradient id (multiple charts can share a page).
const uid = `trendFill${Math.random().toString(36).slice(2, 8)}`;

// ---- geometry -------------------------------------------------------------
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

const PAD_X = 2;
const PAD_Y = bare.value ? 3 : 7;

const xs = computed(() => {
  const n = props.pts.length;
  if (!n) return [];
  const usable = Math.max(w.value - 2 * PAD_X, 1);
  return props.pts.map((p, i) =>
    PAD_X + (p.pos ?? (n <= 1 ? 0.5 : i / (n - 1))) * usable);
});

const extent = computed(() => {
  const vals = props.pts.map((p) => p.value);
  if (props.goal !== null && props.goal !== undefined) vals.push(props.goal);
  return padExtent(vals);
});

const ys = computed(() => {
  const [min, max] = extent.value;
  const usableH = Math.max(svgH - 2 * PAD_Y, 1);
  return props.pts.map((p) =>
    PAD_Y + (1 - (p.value - min) / (max - min)) * usableH);
});

const yFor = (v: number) => {
  const [min, max] = extent.value;
  const usableH = Math.max(svgH - 2 * PAD_Y, 1);
  return PAD_Y + (1 - (v - min) / (max - min)) * usableH;
};

const lineD = computed(() =>
  props.pts.length >= 2 ? smoothPath(xs.value, ys.value) : '');
const areaD = computed(() => {
  const n = props.pts.length;
  if (n < 2) return '';
  const last = props.pts[n - 1];
  const xLast = PAD_X + (last.pos ?? 1) * Math.max(w.value - 2 * PAD_X, 1);
  return `${lineD.value} L ${xLast.toFixed(2)} ${svgH} L ${xs.value[0].toFixed(2)} ${svgH} Z`;
});

const avg = computed(() => {
  if (!props.showAvg || props.pts.length < 2) return null;
  return props.pts.reduce((s, p) => s + p.value, 0) / props.pts.length;
});
const avgY = computed(() => (avg.value === null ? null : yFor(avg.value)));
const goalY = computed(() =>
  (props.goal === null || props.goal === undefined) ? null : yFor(props.goal));

// ---- scrub ----------------------------------------------------------------
const scrubIdx = ref<number | null>(null);
const readout = computed(() =>
  scrubIdx.value ?? Math.max(props.pts.length - 1, 0));
const active = computed(() => props.pts[readout.value] ?? null);
const display = computed(() => {
  const v = active.value?.value;
  if (v === undefined) return '—';
  return props.format ? props.format(v) : String(Math.round(v * 10) / 10);
});

let scrubbing = false;
const pointerX = (e: PointerEvent) => {
  const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
  return e.clientX - rect.left;
};
const select = (e: PointerEvent) => {
  if (!props.pts.length) return;
  const i = nearestXIndex(xs.value, pointerX(e));
  if (i !== scrubIdx.value) {
    scrubIdx.value = i;
    hapticLight();
  }
};
const onDown = (e: PointerEvent) => {
  if (bare.value) return;
  scrubbing = true;
  (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
  select(e);
};
const onMove = (e: PointerEvent) => { if (scrubbing) select(e); };
const onUp = () => { scrubbing = false; };
</script>

<style scoped>
.trend {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  user-select: none;
  -webkit-user-select: none;
}

.trend__readout {
  display: flex;
  align-items: baseline;
  gap: 6px;
  height: 24px;
  padding: 0 2px 4px;
}

.trend__value {
  font-family: var(--nt-font-display);
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--ion-color-accent-red);
  font-variant-numeric: tabular-nums;
}

.trend__unit {
  font-family: var(--nt-font-head);
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--nt-text-dim);
}

.trend__meta {
  margin-left: auto;
  font-size: 0.72rem;
  color: rgba(var(--nt-ink), 0.45);
  font-variant-numeric: tabular-nums;
}

.trend__svg {
  width: 100%;
  height: auto;
  display: block;
  touch-action: pan-y; /* horizontal drag scrubs, vertical still scrolls the page */
  cursor: crosshair;
  overflow: visible;
}

.trend__svg--bare {
  pointer-events: none;
  cursor: default;
}

.trend__line {
  fill: none;
  stroke: var(--ion-color-accent-red);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.trend__area { stroke: none; }

.trend__goal {
  stroke: var(--nt-data-goal);
  stroke-width: 1.5;
  stroke-dasharray: 5 4;
}

.trend__avg {
  stroke: rgba(var(--nt-ink), 0.35);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}

.trend__hairline {
  stroke: rgba(var(--nt-ink), 0.3);
  stroke-width: 1;
}

.trend__dot {
  fill: var(--ion-color-accent-red);
}

.trend__dot--bg {
  fill: var(--nt-surface);
}

.trend__axis {
  display: flex;
  justify-content: space-between;
  height: 16px;
  padding-top: 4px;
  font-size: 0.68rem;
  color: rgba(var(--nt-ink), 0.4);
  font-variant-numeric: tabular-nums;
}
</style>
