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
          <button class="month-nav__btn" @click="changeMonth(-1)">
            <ion-icon :icon="chevronBackOutline" />
          </button>
          <span class="month-nav__label">{{ monthLabel }}</span>
          <button class="month-nav__btn" :disabled="isCurrentMonth" @click="changeMonth(1)">
            <ion-icon :icon="chevronForwardOutline" />
          </button>
        </div>

        <!-- Category breakdown -->
        <div class="card">
          <p class="section-kicker">Spending by category</p>
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
                <i class="cat-legend__dot" :style="{ background: palette[i % palette.length] }"></i>
                <span class="cat-legend__name">{{ c.category }}</span>
                <span class="cat-legend__amt">{{ formatCurrency(c.amount) }}</span>
              </div>
            </div>
          </template>
          <p v-else class="empty-copy">No expenses recorded this month.</p>
        </div>

        <!-- Budget vs actual -->
        <div class="card">
          <p class="section-kicker">Budget vs actual</p>
          <template v-if="budgetRows.length > 0">
            <div class="budget-list">
              <div v-for="row in budgetRows" :key="row.category" class="budget-row">
                <div class="budget-row__head">
                  <span class="budget-row__name">{{ row.category }}</span>
                  <span class="budget-row__nums">
                    <span :class="{ 'over-text': row.over }">{{ formatCurrency(row.spent) }}</span>
                    <span class="budget-row__limit"> / {{ formatCurrency(row.limit) }}</span>
                  </span>
                </div>
                <div class="prog-bar">
                  <div
                    class="prog-bar__fill"
                    :class="{ 'prog-bar__fill--over': row.over, 'prog-bar__fill--warn': !row.over && row.ratio >= 0.85 }"
                    :style="{ width: Math.min(100, row.ratio * 100) + '%' }"
                  ></div>
                </div>
              </div>
            </div>
          </template>
          <p v-else class="empty-copy">Set monthly budgets to track them here.</p>
        </div>

        <!-- Monthly trend -->
        <div class="card">
          <p class="section-kicker">Income vs spending</p>
          <template v-if="monthly.length > 1">
            <div class="chart-frame">
              <canvas ref="trendRef"></canvas>
            </div>
            <div class="chart-legend">
              <span class="chart-legend__item"><i class="chart-legend__swatch chart-legend__swatch--red"></i>Spending</span>
              <span class="chart-legend__item"><i class="chart-legend__swatch chart-legend__swatch--dim"></i>Income</span>
            </div>
          </template>
          <p v-else class="empty-copy">Not enough history for a trend yet.</p>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonContent, IonIcon, onIonViewWillEnter } from '@ionic/vue';
import { chevronBackOutline, chevronForwardOutline } from 'ionicons/icons';
import { ref, computed, nextTick, onUnmounted } from 'vue';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import FinanceSectionTabs from '@/features/finance/components/FinanceSectionTabs.vue';
import { formatCurrency } from '@/shared/utils/currency';
import {
  queryCategorySpending,
  queryMonthlySpending,
  getFinanceBudgets,
  type CategorySpending,
  type MonthlySpending,
} from '@/shared/db/app_db';
import {
  Chart,
  LineController, LineElement, PointElement,
  DoughnutController, ArcElement,
  LinearScale, CategoryScale, Filler, Tooltip,
} from 'chart.js';
import { chartLineDataset, chartDimDataset, chartTooltip, chartTicks, chartGrid } from '@/shared/utils/chartStyle';
import { hapticLight } from '@/shared/utils/haptics';

Chart.register(LineController, LineElement, PointElement, DoughnutController, ArcElement, LinearScale, CategoryScale, Filler, Tooltip);

// Data-encoding palette: red shades fading into neutral greys (design system
// allows shades for data, the single red accent stays the lead).
const palette = [
  'rgb(215, 26, 33)',
  'rgba(215, 26, 33, 0.72)',
  'rgba(215, 26, 33, 0.48)',
  'rgba(255, 255, 255, 0.5)',
  'rgba(255, 255, 255, 0.35)',
  'rgba(255, 255, 255, 0.22)',
  'rgba(255, 255, 255, 0.14)',
];

const localMonthKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const viewedMonth = ref(localMonthKey(new Date()));
const categories = ref<CategorySpending[]>([]);
const monthly = ref<MonthlySpending[]>([]);
const budgets = ref<{ category: string; monthly_limit: number }[]>([]);

const donutRef = ref<HTMLCanvasElement>();
const trendRef = ref<HTMLCanvasElement>();
let donutChart: Chart | null = null;
let trendChart: Chart | null = null;

const isCurrentMonth = computed(() => viewedMonth.value === localMonthKey(new Date()));

const monthLabel = computed(() => {
  const [year, month] = viewedMonth.value.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
});

const categoryTotal = computed(() => categories.value.reduce((a, c) => a + c.amount, 0));

const budgetRows = computed(() => {
  const spentByCat = new Map(categories.value.map((c) => [c.category, c.amount]));
  return budgets.value.map((b) => {
    const spent = spentByCat.get(b.category) ?? 0;
    const limit = Number(b.monthly_limit) || 0;
    const ratio = limit > 0 ? spent / limit : 0;
    return { category: b.category, spent, limit, ratio, over: spent > limit };
  });
});

const changeMonth = (delta: number) => {
  const [year, month] = viewedMonth.value.split('-').map(Number);
  const next = new Date(year, month - 1 + delta, 1);
  if (next > new Date()) return;
  hapticLight();
  viewedMonth.value = localMonthKey(next);
  loadMonth();
};

const loadMonth = async () => {
  const [cats, buds] = await Promise.all([
    queryCategorySpending(viewedMonth.value).catch(() => []),
    getFinanceBudgets().catch(() => []),
  ]);
  categories.value = cats;
  budgets.value = buds as { category: string; monthly_limit: number }[];
  await nextTick();
  renderDonut();
};

const loadAll = async () => {
  monthly.value = await queryMonthlySpending(6).catch(() => []);
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
      labels: categories.value.map((c) => c.category),
      datasets: [
        {
          data: categories.value.map((c) => c.amount),
          backgroundColor: categories.value.map((_, i) => palette[i % palette.length]),
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

const renderTrend = () => {
  if (trendChart) { trendChart.destroy(); trendChart = null; }
  if (!trendRef.value || monthly.value.length < 2) return;
  const ctx = trendRef.value.getContext('2d');
  if (!ctx) return;

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: monthly.value.map((m) => monthShort(m.month)),
      datasets: [
        { ...chartLineDataset, label: 'Spending', data: monthly.value.map((m) => m.expense) },
        { ...chartDimDataset, label: 'Income', data: monthly.value.map((m) => m.income) },
      ],
    },
    options: {
      responsive: true,
      animation: false,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...chartTooltip,
          callbacks: { label: (c) => ` ${c.dataset.label}: ${formatCurrency(c.parsed.y ?? 0)}` },
        },
      },
      scales: {
        y: { beginAtZero: true, ticks: chartTicks, grid: chartGrid },
        x: { ticks: chartTicks, grid: { display: false } },
      },
    },
  });
};

// "2026-06" -> "Jun"
const monthShort = (key: string) => {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short' });
};

onIonViewWillEnter(loadAll);

onUnmounted(() => {
  if (donutChart) { donutChart.destroy(); donutChart = null; }
  if (trendChart) { trendChart.destroy(); trendChart = null; }
});
</script>

<style scoped>
.finance-shell {
  padding: 16px;
  display: grid;
  gap: 16px;
  max-width: 760px;
  margin: 0 auto;
  width: min(100%, 760px);
}

.card {
  background: var(--ion-color-primary);
  border-radius: var(--nt-radius-md);
  padding: 18px;
  display: grid;
  gap: 14px;
}

.section-kicker {
  margin: 0;
  font-family: var(--nt-font-head);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--nt-text-dim);
}

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
  color: #fff;
}

.month-nav__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
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
  color: #fff;
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
  color: rgba(255, 255, 255, 0.8);
  text-transform: capitalize;
}

.cat-legend__amt {
  font-family: var(--nt-font-mono);
  font-size: 0.85rem;
  color: #fff;
}

/* Budget rows */
.budget-list {
  display: grid;
  gap: 12px;
}

.budget-row {
  display: grid;
  gap: 6px;
}

.budget-row__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}

.budget-row__name {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.8);
  text-transform: capitalize;
}

.budget-row__nums {
  font-family: var(--nt-font-mono);
  font-size: 0.82rem;
  color: #fff;
}

.budget-row__limit {
  color: rgba(255, 255, 255, 0.5);
}

.over-text {
  color: var(--ion-color-accent-red);
}

.prog-bar {
  height: 8px;
  border-radius: var(--nt-radius-pill);
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.prog-bar__fill {
  height: 100%;
  background: var(--nt-data-positive);
  border-radius: var(--nt-radius-pill);
}

.prog-bar__fill--warn {
  background: var(--nt-data-goal);
}

.prog-bar__fill--over {
  background: var(--ion-color-accent-red);
}

/* Trend chart */
.chart-frame {
  position: relative;
  height: 220px;
  width: 100%;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  padding: 8px 4px 4px;
}

.chart-legend {
  display: flex;
  gap: 16px;
}

.chart-legend__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--nt-font-head);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--nt-text-dim);
}

.chart-legend__swatch {
  width: 14px;
  height: 2px;
  border-radius: 1px;
}

.chart-legend__swatch--red {
  background: var(--ion-color-accent-red);
}

.chart-legend__swatch--dim {
  background: rgba(255, 255, 255, 0.35);
}

.empty-copy {
  margin: 0;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.9rem;
}
</style>
