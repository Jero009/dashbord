<template>
  <div class="card tlo">
    <div class="card-header">
      <p class="section-kicker">Load vs recovery</p>
      <ion-select
        v-model="windowDays"
        interface="action-sheet"
        :interface-options="{ cssClass: 'app-action-sheet' }"
        class="app-select time-select"
      >
        <ion-select-option :value="28">28 days</ion-select-option>
        <ion-select-option :value="56">56 days</ion-select-option>
        <ion-select-option :value="90">90 days</ion-select-option>
      </ion-select>
    </div>

    <template v-if="hasData">
      <!-- Status banner -->
      <div class="status" :class="`status--${displayStatus}`">
        <ion-icon :icon="statusIcon" class="status__icon" />
        <div class="status__body">
          <span class="status__label">{{ statusLabel }}</span>
          <span class="status__reason">{{ statusReason }}</span>
        </div>
      </div>

      <!-- Recovery recommendations -->
      <div v-if="recommendations.length" class="recs">
        <p class="section-kicker">Recommendations</p>
        <ul class="rec-list">
          <li v-for="(r, i) in recommendations" :key="i" class="rec-item">{{ r }}</li>
        </ul>
      </div>

      <!-- Metric tiles -->
      <div class="tile-grid">
        <div class="tile">
          <span class="tile__label">ACWR</span>
          <strong class="tile__value" :style="{ color: acwrColor }">{{ acwrDisplay }}</strong>
          <small class="tile__detail">{{ acwrZone }}</small>
        </div>
        <div class="tile">
          <span class="tile__label">Acute 7d</span>
          <strong class="tile__value">{{ formatLoad(latest?.acute ?? 0) }}</strong>
        </div>
        <div class="tile">
          <span class="tile__label">Chronic 28d</span>
          <strong class="tile__value">{{ formatLoad(latest?.chronic ?? 0) }}</strong>
        </div>
        <div class="tile">
          <span class="tile__label">{{ signalLabel }} z</span>
          <strong class="tile__value" :style="{ color: recoveryColor }">{{ recoveryDisplay }}</strong>
          <small class="tile__detail">vs 28d base</small>
        </div>
        <div v-if="recoveryTime" class="tile tile--wide">
          <span class="tile__label">Recovery time</span>
          <strong class="tile__value" :style="{ color: recoveryTimeColor }">{{ recoveryTime.label }}</strong>
          <small class="tile__detail">{{ recoveryReadyLabel }}</small>
        </div>
      </div>

      <!-- Dual-axis chart -->
      <div class="chart-wrap">
        <div class="axis-label axis-label--left">Load · {{ loadMetricLabel }}</div>
        <div class="axis-label axis-label--right">{{ signalLabel }} z</div>
        <div class="chart-scroll">
          <svg
            :width="innerW"
            :height="svgH"
            :viewBox="`0 0 ${innerW} ${svgH}`"
            class="chart-svg"
            role="img"
            :aria-label="`Daily training load bars with overlaid ${signalLabel} recovery deviation`"
          >
            <!-- recovery z gridlines -->
            <line :x1="0" :x2="innerW" :y1="zToY(0)" :y2="zToY(0)"
                  :style="{ stroke: 'rgba(var(--nt-ink), 0.18)' }" stroke-width="1" />
            <line :x1="0" :x2="innerW" :y1="zToY(-1)" :y2="zToY(-1)"
                  stroke="rgba(215,26,33,0.5)" stroke-width="1" stroke-dasharray="3 4" />

            <!-- load bars (color-coded by ACWR zone) -->
            <rect
              v-for="(d, i) in axis"
              :key="`bar-${d.date}`"
              :x="i * SLOT + 2"
              :y="baseY - barH(d.load)"
              :width="SLOT - 4"
              :height="barH(d.load)"
              :style="{ fill: zoneColor(d.flag) }"
              rx="1.5"
            />

            <!-- recovery line — point for day N+1 sits at the left edge of its bar,
                 i.e. adjacent to bar N, to make the load→recovery lag visible -->
            <polyline
              v-if="recoveryPath.length > 1"
              :points="recoveryPolyline"
              fill="none"
              :style="{ stroke: 'rgba(var(--nt-ink), 0.65)' }"
              stroke-width="1.5"
            />
            <circle
              v-for="p in recoveryPath"
              :key="`pt-${p.date}`"
              :cx="p.x"
              :cy="p.y"
              r="2.6"
              :style="{ fill: p.low ? 'var(--ion-color-accent-red)' : 'var(--nt-fg)' }"
            />

            <!-- now / today date ticks -->
            <text
              v-for="t in dateTicks"
              :key="`tk-${t.date}`"
              :x="t.x"
              :y="svgH - 6"
              class="tick-text"
              text-anchor="middle"
            >{{ t.label }}</text>
          </svg>
        </div>
      </div>

      <!-- Legend -->
      <div class="legend">
        <span class="legend__item"><i class="legend__swatch" :style="{ background: zoneColor('detraining') }"></i>Detraining</span>
        <span class="legend__item"><i class="legend__swatch" :style="{ background: zoneColor('optimal') }"></i>Optimal</span>
        <span class="legend__item"><i class="legend__swatch" :style="{ background: zoneColor('caution') }"></i>Caution</span>
        <span class="legend__item"><i class="legend__swatch" :style="{ background: zoneColor('high_risk') }"></i>High risk</span>
        <span class="legend__item"><i class="legend__line"></i>{{ signalLabel }} deviation</span>
      </div>
    </template>

    <p v-else class="empty-copy">
      Log workouts to build the overlay
    </p>
  </div>
</template>

<script setup lang="ts">
import { IonIcon, IonSelect, IonSelectOption, onIonViewWillEnter } from '@ionic/vue';
import { ref, computed, watch, onMounted } from 'vue';
import {
  checkmarkCircleOutline,
  warningOutline,
  alertCircleOutline,
  ellipsisHorizontalCircleOutline,
} from 'ionicons/icons';
import { getSessionLoads, getHealthMetricDailySeries } from '@/shared/db/app_db';
import type { SessionLoadRow } from '@/shared/db/app_db';
import {
  computeDailyLoads,
  computeAcwrSeries,
  addDays,
  enumerateDates,
} from '@/shared/health/trainingLoad';
import type { AcwrFlag, AcwrPoint } from '@/shared/health/trainingLoad';
import { computeRecoverySeries } from '@/shared/health/recoveryBaseline';
import type { RecoveryMetric } from '@/shared/health/recoveryBaseline';
import { evaluateOvertraining, acwrZoneLabel } from '@/shared/health/overtraining';
import { recoveryTimeStatus, aggregateLatestTrainingDay } from '@/shared/health/recoveryTime';
import { hapticSelect } from '@/shared/utils/haptics';

const SLOT = 16;       // px per day column
const PAD_TOP = 14;
const PLOT_H = 150;
const Z_MIN = -3;
const Z_MAX = 3;
const baseY = PAD_TOP + PLOT_H;
const svgH = baseY + 22;
// Only let HRV take over from RHR once there's enough of it for a stable
// baseline (z-scores need a populated 28-reading window), so a handful of early
// HRV samples don't blank out the established RHR line.
const HRV_TAKEOVER_MIN = 14;

const windowDays = ref(28);
const sessions = ref<SessionLoadRow[]>([]);
const rhr = ref<{ date: string; value: number }[]>([]);
const hrv = ref<{ date: string; value: number }[]>([]);
const sleepScores = ref<{ date: string; value: number }[]>([]);

const todayKey = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

// ── derived series ───────────────────────────────────────────────────────────

// endDate: todayKey extends the series across rest days so the acute load decays
// (detraining shows up instead of the ACWR freezing at the last workout).
const acwrSeries = computed<AcwrPoint[]>(() =>
  computeAcwrSeries(
    computeDailyLoads(
      sessions.value.map((s) => ({
        date: s.date,
        volumeLoad: s.volume,
        durationMinutes: s.duration_minutes,
        sessionRpe: s.session_rpe,
      }))
    ),
    { endDate: todayKey }
  )
);

// Prefer HRV once there's enough of it (HRV-ready); fall back to RHR.
const signalMetric = computed<RecoveryMetric>(() =>
  hrv.value.length >= HRV_TAKEOVER_MIN ? 'hrv' : 'rhr'
);
const signalLabel = computed(() => (signalMetric.value === 'hrv' ? 'HRV' : 'RHR'));

const recoverySeries = computed(() =>
  computeRecoverySeries(
    signalMetric.value === 'hrv' ? hrv.value : rhr.value,
    signalMetric.value
  )
);

const recoveryZByDate = computed(() => {
  const m = new Map<string, number | null>();
  for (const p of recoverySeries.value) m.set(p.date, p.recoveryZ);
  return m;
});

const acwrByDate = computed(() => {
  const m = new Map<string, AcwrPoint>();
  for (const p of acwrSeries.value) m.set(p.date, p);
  return m;
});

// Overtraining: evaluate on recovery dates with carry-forward ACWR so a thin
// trailing day doesn't drop the latest ratio.
const overtraining = computed(() => {
  let carry: number | null = null;
  const acwrMap = acwrByDate.value;
  const points = recoverySeries.value.map((p) => {
    const a = acwrMap.get(p.date);
    if (a?.acwr != null) carry = a.acwr;
    return { date: p.date, acwr: carry, recoveryZ: p.recoveryZ };
  });
  return evaluateOvertraining(points);
});

const hasData = computed(() => acwrSeries.value.length > 0);
const latest = computed<AcwrPoint | null>(() => {
  for (let i = acwrSeries.value.length - 1; i >= 0; i--) {
    if (acwrSeries.value[i].acwr != null) return acwrSeries.value[i];
  }
  return acwrSeries.value[acwrSeries.value.length - 1] ?? null;
});

// ── chart geometry ───────────────────────────────────────────────────────────

const axis = computed(() => {
  const start = addDays(todayKey, -(windowDays.value - 1));
  return enumerateDates(start, todayKey).map((date) => {
    const a = acwrByDate.value.get(date);
    return {
      date,
      load: a?.load ?? 0,
      flag: (a?.flag ?? null) as AcwrFlag | null,
    };
  });
});

const innerW = computed(() => Math.max(axis.value.length * SLOT, 1));
const maxLoad = computed(() => Math.max(1, ...axis.value.map((d) => d.load)));

const barH = (load: number) => (load <= 0 ? 0 : Math.max(2, (load / maxLoad.value) * PLOT_H));

const zToY = (z: number) => {
  const clamped = Math.min(Z_MAX, Math.max(Z_MIN, z));
  return PAD_TOP + (1 - (clamped - Z_MIN) / (Z_MAX - Z_MIN)) * PLOT_H;
};

// Recovery points: day i drawn at the left edge of bar i (= right edge of bar
// i-1), so day N+1's recovery sits adjacent to day N's load bar.
const recoveryPath = computed(() => {
  const out: { date: string; x: number; y: number; low: boolean }[] = [];
  axis.value.forEach((d, i) => {
    const z = recoveryZByDate.value.get(d.date);
    if (z == null || z === undefined) return;
    out.push({ date: d.date, x: i * SLOT, y: zToY(z), low: z <= -1 });
  });
  return out;
});

const recoveryPolyline = computed(() =>
  recoveryPath.value.map((p) => `${p.x},${p.y}`).join(' ')
);

const dateTicks = computed(() => {
  const n = axis.value.length;
  const step = Math.max(1, Math.round(n / 5));
  const ticks: { date: string; x: number; label: string }[] = [];
  for (let i = 0; i < n; i += step) {
    const [, m, d] = axis.value[i].date.split('-');
    ticks.push({ date: axis.value[i].date, x: i * SLOT + SLOT / 2, label: `${Number(m)}/${Number(d)}` });
  }
  return ticks;
});

// ── display helpers ──────────────────────────────────────────────────────────

const ZONE_COLORS: Record<AcwrFlag, string> = {
  detraining: 'rgba(var(--nt-ink), 0.28)',
  optimal: 'rgb(34, 197, 94)',
  caution: 'rgb(255, 215, 0)',
  high_risk: 'rgb(215, 26, 33)',
};
const zoneColor = (flag: AcwrFlag | null) =>
  flag ? ZONE_COLORS[flag] : 'rgba(var(--nt-ink), 0.14)';

const acwrDisplay = computed(() => (latest.value?.acwr != null ? latest.value.acwr.toFixed(2) : '—'));
const acwrZone = computed(() => acwrZoneLabel(latest.value?.acwr ?? null));
const acwrColor = computed(() => zoneColor(latest.value?.flag ?? null));

const latestRecovery = computed(() => {
  for (let i = recoverySeries.value.length - 1; i >= 0; i--) {
    if (recoverySeries.value[i].recoveryZ != null) return recoverySeries.value[i].recoveryZ;
  }
  return null;
});
const recoveryDisplay = computed(() =>
  latestRecovery.value != null ? latestRecovery.value.toFixed(2) : '—'
);
const recoveryColor = computed(() => {
  const z = latestRecovery.value;
  if (z == null) return 'var(--nt-fg)';
  if (z <= -1) return 'rgb(215, 26, 33)';
  if (z >= 0.5) return 'rgb(34, 197, 94)';
  return 'var(--nt-fg)';
});

// ── recovery time (Garmin-style countdown from the last session) ───────────────
// Driven by the most recent training day's load, lengthened/shortened by the
// recovery signal (RHR/HRV vs baseline) and last night's sleep score.
const latestSleepScore = computed(() =>
  sleepScores.value.length ? sleepScores.value[sleepScores.value.length - 1].value : null
);
const recoveryTime = computed(() => {
  const day = aggregateLatestTrainingDay(sessions.value);
  if (!day) return null;
  return recoveryTimeStatus(
    {
      rpeLoad: day.rpeLoad,
      volumeLoad: day.volumeLoad,
      recoveryZ: latestRecovery.value,
      sleepScore: latestSleepScore.value,
    },
    day.sessionEndIso
  );
});
const recoveryTimeColor = computed(() => {
  const rt = recoveryTime.value;
  if (!rt || rt.recovered) return 'rgb(34, 197, 94)';
  if (rt.remainingHours >= 48) return 'rgb(215, 26, 33)';
  if (rt.remainingHours >= 24) return 'rgb(255, 215, 0)';
  return 'var(--nt-fg)';
});
const recoveryReadyLabel = computed(() => {
  const rt = recoveryTime.value;
  if (!rt || rt.recovered || !rt.readyAt) return rt?.recovered ? 'Ready to train' : 'from last session';
  const d = new Date(rt.readyAt);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now.getTime() + 86400000).toDateString() === d.toDateString();
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (sameDay) return `ready ~${hhmm}`;
  if (tomorrow) return `ready tomorrow ~${hhmm}`;
  return `ready ${d.getMonth() + 1}/${d.getDate()}`;
});

// Overreaching can only be judged with a recovery signal. Without one, show a
// neutral "unknown" state rather than a falsely confident green.
const hasRecoverySignal = computed(() =>
  recoverySeries.value.some((p) => p.recoveryZ != null)
);
const displayStatus = computed<'green' | 'yellow' | 'red' | 'unknown'>(() =>
  hasRecoverySignal.value ? overtraining.value.status : 'unknown'
);

const statusLabel = computed(
  () =>
    ({
      green: 'In balance',
      yellow: 'Monitor',
      red: 'Potential overreaching',
      unknown: 'Load tracked',
    }[displayStatus.value])
);
const statusIcon = computed(
  () =>
    ({
      green: checkmarkCircleOutline,
      yellow: warningOutline,
      red: alertCircleOutline,
      unknown: ellipsisHorizontalCircleOutline,
    }[displayStatus.value])
);
const statusReason = computed(() => {
  if (!hasRecoverySignal.value) {
    const zoneNote =
      latest.value?.flag === 'caution' || latest.value?.flag === 'high_risk'
        ? ` ${acwrZone.value} load.`
        : '';
    return `No recovery data — add RHR/HRV.${zoneNote}`;
  }
  return overtraining.value.reasons[0];
});

const recommendations = computed((): string[] => {
  if (!hasData.value) return [];

  // Detraining: low acute load even without a recovery signal
  if (latest.value?.flag === 'detraining') {
    return [
      'Ramp up gradually — add one extra session this week.',
      'Aim for ACWR between 0.8 and 1.3 to stay in the optimal zone.',
    ];
  }

  if (!hasRecoverySignal.value) return [];

  const result = overtraining.value;
  const acwr = result.acwr;

  if (result.status === 'red') {
    const targetPct = acwr != null ? Math.max(50, Math.round((1.1 / acwr) * 100)) : 60;
    return [
      'Take 2–3 complete rest days before your next session.',
      `When you return, target ~${targetPct}% of your recent load.`,
      'Prioritise sleep and nutrition — recovery is training.',
    ];
  }

  if (result.status === 'yellow') {
    const recs: string[] = [];
    if (acwr != null && acwr > 1.3) {
      recs.push('Cap this week at or below your chronic load level.');
      recs.push('Add one extra rest day between sessions.');
    }
    if (result.consecutiveLowRecovery >= 1) {
      recs.push('Keep today\'s session short and low-intensity.');
      recs.push('Check sleep quality — RHR elevation often follows poor sleep.');
    }
    return recs;
  }

  return [];
});

const loadMetricLabel = computed(() =>
  acwrSeries.value[0]?.metric === 'rpe' ? 'sRPE' : 'volume'
);

const formatLoad = (v: number) => (v >= 10000 ? `${Math.round(v / 100) / 10}k` : `${Math.round(v)}`);

// ── data loading ─────────────────────────────────────────────────────────────

let loadToken = 0;
const load = async () => {
  // mount, view-enter and the window-switch watcher can all fire load() concurrently;
  // a monotonic token drops any resolved-but-stale result so a slower earlier request
  // can't overwrite a newer window's data.
  const token = ++loadToken;
  const span = Math.max(120, windowDays.value + 28);
  const [s, r, h, sl] = await Promise.all([
    getSessionLoads(span).catch(() => []),
    getHealthMetricDailySeries('resting_heart_rate', span).catch(() => []),
    getHealthMetricDailySeries('hrv', span).catch(() => []),
    getHealthMetricDailySeries('sleep_score', span).catch(() => []),
  ]);
  if (token !== loadToken) return;
  sessions.value = s;
  rhr.value = r;
  hrv.value = h;
  sleepScores.value = sl;
};

watch(windowDays, () => {
  hapticSelect();
  load();
});

// onIonViewWillEnter covers tab re-entry; onMounted guarantees the first load
// even if the Ionic view hook doesn't reach this child component.
onMounted(load);
onIonViewWillEnter(load);
</script>

<style scoped>
.card {
  background: var(--ion-color-primary);
  border-radius: var(--nt-radius-md);
  padding: 18px;
  display: grid;
  /* single shrinkable column — without minmax(0,…) the wide chart SVG
     forces the card (and page) past the viewport on the WebView */
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.section-kicker {
  margin: 0;
  font-family: var(--nt-font-head);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--nt-text-dim);
}

.time-select {
  max-width: 130px;
  --padding-start: 8px;
  --padding-end: 8px;
  min-height: auto;
  font-size: 12px;
}

/* Status banner */
.status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(var(--nt-ink), 0.05);
  border: 1px solid transparent;
}
.status--yellow { border-color: rgba(255, 215, 0, 0.4); }
.status--red { border-color: var(--ion-color-accent-red); }
.status__icon { font-size: 1.5rem; flex-shrink: 0; }
.status--green .status__icon { color: rgb(34, 197, 94); }
.status--yellow .status__icon { color: rgb(255, 215, 0); }
.status--red .status__icon { color: var(--ion-color-accent-red); }
.status--unknown .status__icon { color: rgba(var(--nt-ink), 0.5); }
.status__body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.status__label {
  font-family: var(--nt-font-head);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--nt-fg);
}
.status__reason { font-size: 0.78rem; color: var(--nt-text-dim); }

/* Tiles */
.tile-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 12px 14px;
  background: rgba(var(--nt-ink), 0.05);
  border-radius: 10px;
  text-align: center;
}
.tile__label {
  font-family: var(--nt-font-head);
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--nt-text-dim);
}
.tile__value {
  font-family: var(--nt-font-display);
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--nt-fg);
  line-height: 1;
}
.tile__detail { font-size: 0.62rem; color: rgba(var(--nt-ink), 0.4); }
/* Recovery-time tile spans the full row so it reads as the headline metric. */
.tile--wide { grid-column: 1 / -1; }

/* Chart */
.chart-wrap {
  position: relative;
  min-width: 0;
  background: rgba(var(--nt-ink), 0.03);
  border-radius: 8px;
  padding: 6px 4px 2px;
}
.axis-label {
  position: absolute;
  top: 6px;
  font-family: var(--nt-font-head);
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--nt-text-dim);
  z-index: 1;
  pointer-events: none;
}
.axis-label--left { left: 8px; }
.axis-label--right { right: 8px; }
.chart-scroll {
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
}
.chart-svg { display: block; }
.tick-text {
  fill: rgba(var(--nt-ink), 0.4);
  font-family: var(--nt-font-mono);
  font-size: 9px;
}

/* Legend */
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.legend__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--nt-font-head);
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--nt-text-dim);
}
.legend__swatch { width: 11px; height: 11px; border-radius: 3px; }
.legend__line {
  width: 16px;
  height: 0;
  border-top: 2px solid rgba(var(--nt-ink), 0.65);
}
.recs {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
}
.rec-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 6px;
}
.rec-item {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.4;
  padding-left: 12px;
  position: relative;
}
.rec-item::before {
  content: '—';
  position: absolute;
  left: 0;
  color: var(--nt-text-dim);
}
.lag-note {
  margin: 0;
  font-size: 0.74rem;
  line-height: 1.4;
  color: rgba(var(--nt-ink), 0.5);
}
.empty-copy { margin: 0; color: rgba(var(--nt-ink), 0.6); font-size: 0.9rem; }

@media (min-width: 600px) {
  .tile-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
</style>
