<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <finance-section-tabs />
    </ion-header>

    <ion-content :fullscreen="true">
      <div class="finance-shell">
        <!-- Month nav -->
        <div class="month-nav">
          <button class="month-nav__btn" aria-label="Previous month" @click="changeMonth(-1)">
            <ion-icon :icon="chevronBackOutline" />
          </button>
          <span class="month-nav__label">{{ monthLabel }}</span>
          <button class="month-nav__btn" :disabled="isCurrentMonth" aria-label="Next month" @click="changeMonth(1)">
            <ion-icon :icon="chevronForwardOutline" />
          </button>
        </div>

        <!-- Category breakdown -->
        <ion-card class="finance-card">
          <div class="card-topline">
            <p class="nt-kicker">Spending by category</p>
            <span v-if="failed['categories']" class="card-error">Couldn't load</span>
          </div>
          <template v-if="categories.length > 0">
            <div class="donut-wrap">
              <canvas ref="donutRef"></canvas>
              <div class="donut-center">
                <span class="donut-center__label">Spent</span>
                <strong class="donut-center__val">{{ formatCurrency(categoryTotal) }}</strong>
              </div>
            </div>
            <div class="cat-legend">
              <div v-for="(c, i) in categories" :key="c.category" class="cat-legend__row">
                <i class="cat-legend__dot" :style="{ background: palette()[i % palette().length] }"></i>
                <span class="cat-legend__name">{{ categoryLabel(c.category) }}</span>
                <span class="cat-legend__amt">{{ formatCurrency(c.amount) }}</span>
              </div>
            </div>
          </template>
          <p v-else-if="failed['categories']" class="nt-empty card-error">Couldn't load spending</p>
          <p v-else class="nt-empty">No expenses</p>
        </ion-card>

        <!-- Monthly trend -->
        <ion-card class="finance-card">
          <div class="card-topline">
            <p class="nt-kicker">Income vs spending</p>
            <span v-if="failed['monthly']" class="card-error">Couldn't load</span>
          </div>
          <template v-if="monthly.length > 1">
            <div class="chart-readout">
              <span class="chart-readout__date">{{ trendReadoutLabel }}</span>
              <span class="chart-readout__value">
                spending <strong>{{ trendReadoutExpense }}</strong>
                · income <strong>{{ trendReadoutIncome }}</strong>
              </span>
            </div>
            <div class="chart-frame">
              <canvas
                ref="trendRef"
                class="scrub-canvas"
                @pointerdown.prevent="trendScrub.onDown"
                @pointermove="trendScrub.onMove"
                @pointerup="trendScrub.onUp"
                @pointercancel="trendScrub.onUp"
              ></canvas>
            </div>
            <div class="chart-legend">
              <span class="chart-legend__item"><i class="chart-legend__swatch chart-legend__swatch--red"></i>Spending</span>
              <span class="chart-legend__item"><i class="chart-legend__swatch chart-legend__swatch--dim"></i>Income</span>
            </div>
          </template>
          <p v-else-if="failed['monthly']" class="nt-empty card-error">Couldn't load history</p>
          <p v-else class="nt-empty">Not enough history</p>
        </ion-card>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonContent, IonCard, IonIcon, onIonViewWillEnter } from '@ionic/vue';
import { chevronBackOutline, chevronForwardOutline } from 'ionicons/icons';
import { ref, computed, nextTick, onUnmounted } from 'vue';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import FinanceSectionTabs from '@/features/finance/components/FinanceSectionTabs.vue';
import { formatCurrency } from '@/shared/utils/currency';
import { formatLocalMonth } from '@/shared/utils/timeFormat';
import {
  queryCategorySpending,
  queryMonthlySpending,
  type CategorySpending,
  type MonthlySpending,
} from '@/shared/db/app_db';
import { categoryLabel } from '@/features/finance/finance';
import {
  Chart,
  LineController, LineElement, PointElement,
  DoughnutController, ArcElement,
  LinearScale, CategoryScale, Filler, Tooltip,
} from 'chart.js';
import { chartLineDataset, chartDimDataset, chartDonutPalette, chartTooltip, chartTicks, chartGrid } from '@/shared/utils/chartStyle';
import { useChartScrub } from '@/shared/composables/useChartScrub';
import { hapticLight } from '@/shared/utils/haptics';
import { localMonthISO } from '@/shared/utils/timeFormat';

Chart.register(LineController, LineElement, PointElement, DoughnutController, ArcElement, LinearScale, CategoryScale, Filler, Tooltip);

const palette = chartDonutPalette;

const localMonthKey = localMonthISO;

const viewedMonth = ref(localMonthKey(new Date()));
const categories = ref<CategorySpending[]>([]);
const monthly = ref<MonthlySpending[]>([]);

const donutRef = ref<HTMLCanvasElement>();
const trendRef = ref<HTMLCanvasElement>();
let donutChart: Chart | null = null;
let trendChart: Chart | null = null;

// Per-card failure flags: a DB error must not look like "no data".
const failed = ref<Record<string, boolean>>({});

const settled = async <T,>(key: string, p: Promise<T>, fallback: T): Promise<T> => {
  try {
    const v = await p;
    failed.value[key] = false;
    return v;
  } catch {
    failed.value[key] = true;
    return fallback;
  }
};

const isCurrentMonth = computed(() => viewedMonth.value === localMonthKey(new Date()));

const monthLabel = computed(() => formatLocalMonth(viewedMonth.value));

const categoryTotal = computed(() => categories.value.reduce((a, c) => a + c.amount, 0));

const changeMonth = (delta: number) => {
  const [year, month] = viewedMonth.value.split('-').map(Number);
  const next = new Date(year, month - 1 + delta, 1);
  if (next > new Date()) return;
  hapticLight();
  viewedMonth.value = localMonthKey(next);
  loadMonth();
};

const loadMonth = async () => {
  const cats = await settled('categories', queryCategorySpending(viewedMonth.value), []);
  categories.value = cats;
  await nextTick();
  renderDonut();
};

const loadAll = async () => {
  monthly.value = await settled('monthly', queryMonthlySpending(6), []);
  await loadMonth();
  await nextTick();
  renderTrend();
};

const renderDonut = () => {
  if (donutChart) { donutChart.destroy(); donutChart = null; }
  if (!donutRef.value || categories.value.length === 0) return;
  const ctx = donutRef.value.getContext('2d');
  if (!ctx) return;

  donutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: categories.value.map((c) => categoryLabel(c.category)),
      datasets: [
        {
          data: categories.value.map((c) => c.amount),
          backgroundColor: categories.value.map((_, i) => { const p = palette(); return p[i % p.length]; }),
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      animation: false,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          ...chartTooltip,
          callbacks: { label: (c) => ` ${c.label}: ${formatCurrency(Number(c.parsed) || 0)}` },
        },
      },
    },
  });
};

// Scrub contract (v3.x): whole-surface pointer scrub + readout row, haptics
// fire inside the composable only when the selected index changes.
const trendScrub = useChartScrub({
  chart: () => trendChart,
  count: () => monthly.value.length,
});

const renderTrend = () => {
  if (trendChart) { trendChart.destroy(); trendChart = null; }
  if (!trendRef.value || monthly.value.length < 2) return;
  const ctx = trendRef.value.getContext('2d');
  if (!ctx) return;

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: monthly.value.map((m) => formatLocalMonth(m.month, 'short')),
      datasets: [
        { ...chartLineDataset, label: 'Spending', data: monthly.value.map((m) => m.expense) },
        { ...chartDimDataset, label: 'Income', data: monthly.value.map((m) => m.income) },
      ],
    },
    plugins: [trendScrub.scrubPlugin],
    options: {
      responsive: true,
      animation: false,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }, // readout row replaces the floating tooltip
      },
      scales: {
        y: { beginAtZero: true, ticks: chartTicks, grid: chartGrid },
        x: { ticks: chartTicks, grid: { display: false } },
      },
    },
  });
};

const trendActiveIdx = computed(() =>
  trendScrub.selectedIdx.value ?? Math.max(monthly.value.length - 1, 0));
const trendReadoutLabel = computed(() => {
  const m = monthly.value[trendActiveIdx.value];
  if (!m) return '';
  return formatLocalMonth(m.month);
});
const trendReadoutExpense = computed(() =>
  formatCurrency(monthly.value[trendActiveIdx.value]?.expense ?? 0));
const trendReadoutIncome = computed(() =>
  formatCurrency(monthly.value[trendActiveIdx.value]?.income ?? 0));

onIonViewWillEnter(() => {
  // Recompute on entry — kept-alive page must follow month rollovers.
  viewedMonth.value = localMonthKey(new Date());
  loadAll();
});

onUnmounted(() => {
  if (donutChart) { donutChart.destroy(); donutChart = null; }
  if (trendChart) { trendChart.destroy(); trendChart = null; }
});
</script>

<style scoped>

/* Month nav */
.month-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
}

.month-nav__label {
  font-family: var(--nt-font-head);
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--nt-fg);
}

.month-nav__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: var(--nt-tile);
  color: rgba(var(--nt-ink), 0.8);
  cursor: pointer;
}

.month-nav__btn:disabled {
  opacity: 0.3;
}

/* Donut */
.donut-wrap {
  position: relative;
  height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.donut-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.donut-center__label {
  font-family: var(--nt-font-head);
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--nt-text-dim);
}

.donut-center__val {
  font-family: var(--nt-font-display);
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--nt-fg);
}

.cat-legend {
  display: grid;
  gap: 8px;
}

.cat-legend__row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cat-legend__dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}

.cat-legend__name {
  flex: 1;
  font-size: 0.85rem;
  color: rgba(var(--nt-ink), 0.8);
}

.cat-legend__amt {
  font-family: var(--nt-font-mono);
  font-size: 0.85rem;
  color: var(--nt-fg);
}

.card-error {
  margin-left: auto;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--ion-color-accent-red);
}

.chart-readout {
  display: flex;
  align-items: baseline;
  gap: 12px;
  font-family: var(--nt-font-head);
  font-size: 0.72rem;
  color: var(--nt-text-dim);
}

.chart-readout__date {
  min-width: 3.5em;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.chart-readout__value strong {
  color: var(--nt-fg);
  font-weight: 600;
}

.scrub-canvas {
  touch-action: pan-y; /* horizontal drag scrubs, vertical still scrolls */
  cursor: crosshair;
}
</style>
