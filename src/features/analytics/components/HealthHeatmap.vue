<template>
  <div class="card heat-card">
    <div class="card-header">
      <p class="nt-kicker">Health heatmap</p>
      <div class="seg-pill">
        <ion-segment v-model="layer" mode="ios" class="heat-seg">
          <ion-segment-button value="workouts"><ion-label>Workouts</ion-label></ion-segment-button>
          <ion-segment-button value="sick"><ion-label>Sick</ion-label></ion-segment-button>
          <ion-segment-button value="readiness"><ion-label>Readiness</ion-label></ion-segment-button>
        </ion-segment>
      </div>
    </div>

    <div class="heat-scroll">
      <div class="heat-grid" :style="{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }">
        <button
          v-for="cell in cells"
          :key="cell.date"
          class="heat-cell"
          :class="{ 'heat-cell--future': cell.future, 'heat-cell--selected': selectedDate === cell.date }"
          :style="cell.future ? {} : { background: cellColor(cell) }"
          :aria-label="`${cell.date}`"
          @click="selectDay(cell.date)"
        />
      </div>
    </div>

    <div class="heat-legend">
      <span class="heat-legend__label">Less</span>
      <i class="heat-cell heat-cell--legend" :style="{ background: shadeFor(0) }" />
      <i class="heat-cell heat-cell--legend" :style="{ background: shadeFor(0.5) }" />
      <i class="heat-cell heat-cell--legend" :style="{ background: shadeFor(1) }" />
      <span class="heat-legend__label">More</span>
    </div>

    <!-- Tap-a-day detail card -->
    <div v-if="selectedDate" class="detail">
      <div class="detail__head">
        <strong>{{ selectedDate }}</strong>
        <button class="detail__close nt-press" @click="selectedDate = null">Close</button>
      </div>
      <template v-if="detail">
        <span>Workouts: <strong>{{ detail.workoutCount }}</strong></span>
        <span>Tonnage: <strong>{{ Math.round(detail.tonnage) }} kg</strong></span>
        <span>Readiness: <strong>{{ detail.readiness ?? '—' }}</strong></span>
        <span v-if="detail.events.length > 0">
          Events:
          <strong v-for="ev in detail.events" :key="ev" class="detail__event">{{ ev }}</strong>
        </span>
      </template>
      <p v-else class="nt-empty">No data this day</p>
    </div>
  </div>
</template>

<!--
  Layered health heatmap (locked design): GitHub-style grid, 52 weekly columns by
  default, horizontally scrollable back through the years as data accumulates.
  Layers: Workouts (density) / Sick (red intensity from life_event + pauses) /
  Readiness (daily score shade). Tap a day for the compare-sickness-vs-training
  detail card. Supersedes the inline 10-week grid on AnalyticsGymPage.
-->
<script setup lang="ts">
import {
  IonSegment, IonSegmentButton, IonLabel,
} from '@ionic/vue';
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import {
  queryWorkoutFrequency, queryReadinessHistory, queryDailyVolume, getLifeEvents,
  getPlans, getPausesForPlan,
  type LifeEvent,
} from '@/shared/db/app_db';
import { localDateISO } from '@/shared/utils/timeFormat';
import { hapticSelect } from '@/shared/utils/haptics';

const props = withDefaults(defineProps<{
  /** Weekly columns (52 = one year, 104 = two). */
  weeks?: number;
}>(), { weeks: 52 });

type Layer = 'workouts' | 'sick' | 'readiness';
const layer = ref<Layer>('workouts');
const selectedDate = ref<string | null>(null);

const workoutCounts = ref<Map<string, number>>(new Map());
const readiness = ref<Map<string, number>>(new Map());
const events = ref<LifeEvent[]>([]);
const sickDays = ref<Map<string, number>>(new Map()); // day → intensity 0.5 | 1

const todayKey = localDateISO();

// Grid: columns of 7 days, Sunday-anchored like the old inline grid.
const cells = computed(() => {
  const out: Array<{ date: string; future: boolean }> = [];
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - start.getDay() - (props.weeks - 1) * 7);
  for (let i = 0; i < props.weeks * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = localDateISO(d);
    out.push({ date: key, future: key > todayKey });
  }
  return out;
});

function shadeFor(t: number): string {
  if (t <= 0) return 'rgba(var(--nt-ink), 0.06)';
  if (layer.value === 'sick') {
    // Red is the ONE accent — intensity encodes severity.
    return t >= 1
      ? 'var(--ion-color-accent-red)'
      : 'color-mix(in srgb, var(--ion-color-accent-red) 45%, transparent)';
  }
  return `color-mix(in srgb, var(--ion-color-accent-red) ${Math.round(15 + t * 85)}%, transparent)`;
}

function cellColor(cell: { date: string }): string {
  if (layer.value === 'workouts') {
    const c = workoutCounts.value.get(cell.date) ?? 0;
    return shadeFor(c === 0 ? 0 : c === 1 ? 0.55 : 1);
  }
  if (layer.value === 'sick') {
    return shadeFor(sickDays.value.get(cell.date) ?? 0);
  }
  const score = readiness.value.get(cell.date);
  if (score == null) return 'rgba(var(--nt-ink), 0.06)';
  return shadeFor(Math.max(0, Math.min(1, score / 100)));
}

// Day detail: workouts + tonnage, readiness, events.
const detail = computed(() => {
  if (!selectedDate.value) return null;
  const key = selectedDate.value;
  const workoutCount = workoutCounts.value.get(key) ?? 0;
  const tonnage = dayTonnage.value.get(key) ?? 0;
  const score = readiness.value.get(key) ?? null;
  const evs = events.value
    .filter((e) => e.start_date <= key && (e.end_date == null || e.end_date >= key))
    .map((e) => `${e.type}${e.severity ? ` (${e.severity === 'knocked_out' ? 'knocked out' : e.severity})` : ''}`);
  if (workoutCount === 0 && score == null && evs.length === 0) return null;
  return { workoutCount, tonnage, readiness: score, events: evs };
});

const dayTonnage = ref<Map<string, number>>(new Map());

const selectDay = (key: string) => {
  hapticSelect();
  selectedDate.value = key;
};

let cancelled = false;
const load = async () => {
  const weeks = props.weeks;
  const [freq, readinessRows, lifeEvents, volume] = await Promise.all([
    queryWorkoutFrequency(weeks + 4).catch(() => []),
    queryReadinessHistory(weeks * 7 + 30).catch(() => []),
    getLifeEvents(undefined, 500).catch(() => []),
    queryDailyVolume(weeks * 7 + 30).catch(() => []),
  ]);
  if (cancelled) return;

  const tonnage = new Map<string, number>();
  for (const v of volume) tonnage.set(v.date, Number(v.value) || 0);
  dayTonnage.value = tonnage;

  const counts = new Map<string, number>();
  for (const d of freq) counts.set(d.date, Number(d.count) || 0);
  workoutCounts.value = counts;

  const scores = new Map<string, number>();
  for (const r of readinessRows) scores.set(r.date, Number(r.score) || 0);
  readiness.value = scores;

  // Pauses contribute to the sick layer too (linked rows already exist in
  // life_event, but older/archived plans' pauses still render).
  const sick = new Map<string, number>();
  for (const e of lifeEvents) {
    if (e.type !== 'sick' && e.type !== 'recovery') continue;
    const start = new Date(`${e.start_date}T00:00:00`);
    const end = e.end_date ? new Date(`${e.end_date}T00:00:00`) : new Date();
    const cursor = new Date(start);
    const intensity = e.severity === 'knocked_out' ? 1 : 0.5;
    while (cursor <= end && sick.size < 4000) {
      const key = localDateISO(cursor);
      sick.set(key, Math.max(sick.get(key) ?? 0, intensity));
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  try {
    const plans = await getPlans(true);
    for (const p of plans) {
      const pauses = await getPausesForPlan(p.id);
      for (const pause of pauses) {
        if (pause.reason !== 'sick' && pause.reason !== 'recovery') continue;
        const start = new Date(`${pause.start_date}T00:00:00`);
        const end = pause.end_date ? new Date(`${pause.end_date}T00:00:00`) : new Date();
        const cursor = new Date(start);
        while (cursor <= end && sick.size < 4000) {
          const key = localDateISO(cursor);
          sick.set(key, Math.max(sick.get(key) ?? 0, 0.5));
          cursor.setDate(cursor.getDate() + 1);
        }
      }
    }
  } catch { /* plans optional for the sick layer */ }
  sickDays.value = sick;
  events.value = lifeEvents;
};

onMounted(load);
watch(() => props.weeks, load);
onUnmounted(() => { cancelled = true; });
</script>

<style scoped>
.heat-card {
  display: grid;
  gap: 12px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.card-header .nt-kicker {
  margin: 0;
}

.seg-pill {
  overflow: hidden;
  border-radius: 999px;
  --background: transparent;
}

.heat-seg {
  --background: transparent;
  min-height: 30px;
}

.heat-scroll {
  overflow-x: auto;
  padding-bottom: 4px;
}

.heat-grid {
  display: grid;
  grid-auto-flow: column;
  grid-template-rows: repeat(7, 1fr);
  gap: 3px;
  min-width: max-content;
}

.heat-cell {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  border: none;
  padding: 0;
  background: rgba(var(--nt-ink), 0.06);
  cursor: pointer;
}

.heat-cell--future {
  background: transparent !important;
  pointer-events: none;
}

.heat-cell--selected {
  outline: 1px solid var(--ion-color-accent-red);
}

.heat-cell--legend {
  width: 10px;
  height: 10px;
  cursor: default;
}

.heat-legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

.heat-legend__label {
  font-size: 0.65rem;
  color: rgba(var(--nt-ink), 0.35);
  margin: 0 4px;
}

.detail {
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  background: rgba(var(--nt-ink), 0.05);
  border-radius: 10px;
  font-size: 0.82rem;
  color: var(--nt-text-dim);
}

.detail__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail__head strong {
  font-family: var(--nt-font-display);
  color: var(--nt-fg);
}

.detail__close {
  background: transparent;
  border: none;
  color: var(--ion-color-accent-red);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: pointer;
}

.detail__event {
  margin-right: 6px;
  color: var(--ion-color-accent-red);
}
</style>
