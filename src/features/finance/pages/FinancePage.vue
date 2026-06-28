<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <finance-section-tabs />
    </ion-header>
    <ion-content :fullscreen="true" class="finance-content">
      <div class="finance-shell">
        <!-- Net worth hero + trend -->
        <ion-card class="finance-card hero-card">
          <div class="card-topline">
            <p class="section-kicker">Net worth</p>
            <span v-if="netDelta !== null" class="delta-chip" :class="netDelta >= 0 ? 'delta-chip--up' : 'delta-chip--down'">
              <ion-icon :icon="netDelta >= 0 ? trendingUpOutline : trendingDownOutline" />
              {{ netDelta >= 0 ? '+' : '−' }}{{ formatCurrency(Math.abs(netDelta)) }}
              <span class="delta-chip__win">{{ deltaDays }}d</span>
            </span>
          </div>
          <div class="hero-value">{{ formatCurrency(netWorth) }}</div>

          <div v-if="trendPath" class="trend">
            <svg class="trend__svg" :viewBox="`0 0 ${CHART_W} ${CHART_H}`" preserveAspectRatio="none">
              <defs>
                <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="rgba(215, 26, 33, 0.22)" />
                  <stop offset="100%" stop-color="rgba(215, 26, 33, 0)" />
                </linearGradient>
              </defs>
              <path :d="areaPath" fill="url(#nwFill)" />
              <path :d="trendPath" fill="none" stroke="rgb(215, 26, 33)" stroke-width="2"
                    stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
            </svg>
            <div class="trend__axis">
              <span>{{ trendStartLabel }}</span>
              <span>Today</span>
            </div>
          </div>
          <p v-else class="hero-hint">Net worth trend builds as you use the app daily.</p>

          <!-- Assets vs liabilities split -->
          <div class="split">
            <div class="split__bar">
              <div class="split__seg split__seg--asset" :style="{ width: `${assetPct}%` }"></div>
              <div class="split__seg split__seg--liab" :style="{ width: `${100 - assetPct}%` }"></div>
            </div>
            <div class="split__legend">
              <div class="split__item">
                <span class="split__label"><i class="dot dot--asset"></i>Assets</span>
                <strong>{{ formatCurrency(totalAssets) }}</strong>
              </div>
              <div class="split__item split__item--end">
                <span class="split__label"><i class="dot dot--liab"></i>Liabilities</span>
                <strong>{{ formatCurrency(liabilities) }}</strong>
              </div>
            </div>
          </div>
        </ion-card>

        <!-- This month cash flow -->
        <ion-card class="finance-card tappable" button @click="go('/finance/budget')">
          <div class="card-topline">
            <p class="section-kicker">This month</p>
            <ion-icon class="chev" :icon="chevronForwardOutline" />
          </div>
          <div class="flow-grid">
            <div class="flow-cell">
              <span class="flow-cell__label">Income</span>
              <strong class="flow-cell__val metric-positive">{{ formatCurrency(monthIncome) }}</strong>
            </div>
            <div class="flow-cell">
              <span class="flow-cell__label">Spent</span>
              <strong class="flow-cell__val">{{ formatCurrency(monthExpense) }}</strong>
            </div>
            <div class="flow-cell">
              <span class="flow-cell__label">Saved</span>
              <strong class="flow-cell__val" :class="{ 'metric-negative': monthNet < 0, 'metric-positive': monthNet > 0 }">
                {{ formatCurrency(monthNet) }}
              </strong>
            </div>
          </div>
          <div v-if="savingsPct !== null" class="savings">
            <div class="savings__head">
              <span class="flow-cell__label">Savings rate</span>
              <strong>{{ Math.round(savingsPct * 100) }}%</strong>
            </div>
            <div class="savings__bar">
              <div class="savings__fill" :class="{ 'savings__fill--neg': savingsPct < 0 }"
                   :style="{ width: `${Math.min(100, Math.abs(savingsPct) * 100)}%` }"></div>
            </div>
          </div>
        </ion-card>

        <!-- Upcoming bills -->
        <ion-card class="finance-card tappable" button @click="go('/finance/subscriptions')">
          <div class="card-topline">
            <p class="section-kicker">Upcoming bills · {{ rangeBillsDays }}d</p>
            <span class="card-count">{{ formatCurrency(billsTotal) }}</span>
          </div>
          <div v-if="bills.length" class="mini-list">
            <div v-for="bill in bills" :key="bill.id" class="mini-row">
              <div class="mini-row__info">
                <strong class="mini-row__name">{{ bill.name }}</strong>
                <span class="mini-row__meta">{{ dueLabel(bill.next_due_date) }}</span>
              </div>
              <span class="mini-row__val">{{ formatCurrency(Number(bill.amount) || 0) }}</span>
            </div>
          </div>
          <p v-else class="empty-state">No bills in the next {{ rangeBillsDays }} days</p>
        </ion-card>

        <!-- Top spending categories -->
        <ion-card class="finance-card tappable" button @click="go('/finance/analytics')">
          <div class="card-topline">
            <p class="section-kicker">Top categories</p>
            <ion-icon class="chev" :icon="chevronForwardOutline" />
          </div>
          <div v-if="topCategories.length" class="cat-list">
            <div v-for="cat in topCategories" :key="cat.category" class="cat-row">
              <div class="cat-row__head">
                <span class="cat-row__name">{{ categoryLabel(cat.category) }}</span>
                <span class="cat-row__amt">{{ formatCurrency(cat.amount) }}</span>
              </div>
              <div class="cat-bar">
                <div class="cat-bar__fill" :style="{ width: `${(cat.amount / topCategoryMax) * 100}%` }"></div>
              </div>
            </div>
          </div>
          <p v-else class="empty-state">No spending this month</p>
        </ion-card>

        <!-- Recent activity -->
        <ion-card class="finance-card tappable" button @click="go('/finance/budget')">
          <div class="card-topline">
            <p class="section-kicker">Recent activity</p>
            <ion-icon class="chev" :icon="chevronForwardOutline" />
          </div>
          <div v-if="recent.length" class="mini-list">
            <div v-for="tx in recent" :key="tx.id" class="mini-row">
              <div class="mini-row__info">
                <strong class="mini-row__name">{{ tx.name }}</strong>
                <span class="mini-row__meta">
                  {{ tx.type === 'income' ? 'Income' : categoryLabel(tx.category) }} · {{ formatDay(tx.date) }}
                </span>
              </div>
              <span class="mini-row__val" :class="{ 'metric-positive': tx.type === 'income' }">
                {{ tx.type === 'income' ? '+' : '−' }}{{ formatCurrency(Number(tx.amount) || 0) }}
              </span>
            </div>
          </div>
          <p v-else class="empty-state">No transactions yet</p>
        </ion-card>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonHeader,
  IonContent,
  IonCard,
  IonIcon,
  onIonViewWillEnter,
} from '@ionic/vue';
import { chevronForwardOutline, trendingUpOutline, trendingDownOutline } from 'ionicons/icons';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import FinanceSectionTabs from '@/features/finance/components/FinanceSectionTabs.vue';
import {
  getFinanceAccounts,
  getFinanceInvestments,
  getFinanceSubscriptions,
  getFinanceTransactionsForMonth,
  getRecentFinanceTransactions,
  getNetWorthHistory,
  queryCategorySpending,
  recordNetWorthSnapshot,
  type NetWorthPoint,
  type CategorySpending,
} from '@/shared/db/app_db';
import { formatCurrency } from '@/shared/utils/currency';
import { hapticLight } from '@/shared/utils/haptics';
import {
  computeNetWorth,
  computeTotalAssets,
  accountLiabilitiesTotal,
  upcomingBills,
  savingsRate,
  categoryLabel,
  dueLabel,
  type SubscriptionRow,
} from '@/features/finance/finance';

const router = useRouter();

const CHART_W = 320;
const CHART_H = 64;
const rangeDays = 30;
const rangeBillsDays = 14;

const accounts = ref<Array<Record<string, any>>>([]);
const investments = ref<Array<Record<string, any>>>([]);
const subscriptions = ref<SubscriptionRow[]>([]);
const monthTransactions = ref<Array<Record<string, any>>>([]);
const history = ref<NetWorthPoint[]>([]);
const recent = ref<Array<Record<string, any>>>([]);
const topCategories = ref<CategorySpending[]>([]);

const netWorth = computed(() => computeNetWorth(accounts.value, investments.value));
const totalAssets = computed(() => computeTotalAssets(accounts.value, investments.value));
const liabilities = computed(() => accountLiabilitiesTotal(accounts.value));
const assetPct = computed(() => {
  const denom = totalAssets.value + liabilities.value;
  return denom > 0 ? (totalAssets.value / denom) * 100 : 100;
});

// Delta vs the first snapshot in the trend window.
const netDelta = computed(() => {
  if (history.value.length < 2) return null;
  return netWorth.value - history.value[0].net;
});

// Actual age of the comparison snapshot (≤ rangeDays), so the chip shows "5d"
// when the app only has 5 days of history rather than a misleading "30d".
const deltaDays = computed(() => {
  if (history.value.length < 2) return rangeDays;
  const first = new Date(history.value[0].date).getTime();
  const days = Math.round((Date.now() - first) / 86400000);
  return Math.max(1, Math.min(rangeDays, days));
});

const monthIncome = computed(() =>
  monthTransactions.value.filter((t) => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0)
);
const monthExpense = computed(() =>
  monthTransactions.value.filter((t) => t.type !== 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0)
);
const monthNet = computed(() => monthIncome.value - monthExpense.value);
const savingsPct = computed(() => savingsRate(monthIncome.value, monthExpense.value));

const allBills = computed(() => upcomingBills(subscriptions.value, rangeBillsDays));
const bills = computed(() => allBills.value.slice(0, 4));
const billsTotal = computed(() => allBills.value.reduce((s, b) => s + (Number(b.amount) || 0), 0));

const topCategoryMax = computed(() => topCategories.value[0]?.amount || 1);

// --- Net-worth trend SVG path ---
const trendPoints = computed(() => {
  const pts = history.value;
  if (pts.length < 2) return [];
  const nets = pts.map((p) => p.net);
  const min = Math.min(...nets);
  const max = Math.max(...nets);
  const range = max - min;
  const stepX = CHART_W / (pts.length - 1);
  const pad = 6;
  return pts.map((p, i) => ({
    x: i * stepX,
    // Centre the line vertically when net worth is flat (range 0) instead of
    // pinning it to the bottom edge.
    y: pad + (1 - (range > 0 ? (p.net - min) / range : 0.5)) * (CHART_H - pad * 2),
  }));
});

const trendPath = computed(() => {
  const pts = trendPoints.value;
  if (!pts.length) return '';
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
});

const areaPath = computed(() => {
  const pts = trendPoints.value;
  if (!pts.length) return '';
  const line = pts.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  return `M ${pts[0].x.toFixed(1)} ${CHART_H} ${line} L ${pts[pts.length - 1].x.toFixed(1)} ${CHART_H} Z`;
});

const trendStartLabel = computed(() => {
  if (history.value.length < 2) return '';
  return formatDay(history.value[0].date);
});

const formatDay = (date: string) => {
  const [year, month, day] = String(date).split('-').map(Number);
  if (!year || !month || !day) return date;
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const go = (path: string) => {
  hapticLight();
  router.push(path);
};

const loadFinance = async () => {
  // Persist today's snapshot first so the trend includes the latest point.
  await recordNetWorthSnapshot().catch(() => {});
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [acc, inv, subs, txns, hist, rec, cats] = await Promise.all([
    getFinanceAccounts().catch(() => []),
    getFinanceInvestments().catch(() => []),
    getFinanceSubscriptions().catch(() => []),
    getFinanceTransactionsForMonth(monthKey).catch(() => []),
    getNetWorthHistory(rangeDays).catch(() => []),
    getRecentFinanceTransactions(5).catch(() => []),
    queryCategorySpending(monthKey).catch(() => []),
  ]);
  accounts.value = acc;
  investments.value = inv;
  subscriptions.value = subs;
  monthTransactions.value = txns;
  history.value = hist;
  recent.value = rec;
  topCategories.value = cats.slice(0, 4);
};

onIonViewWillEnter(loadFinance);
</script>

<style scoped>
.finance-content {
  --padding-top: 16px;
  --padding-bottom: 24px;
}

.finance-shell {
  max-width: 760px;
  margin: 0 auto;
  padding: 16px;
  display: grid;
  gap: 16px;
}

.finance-card {
  margin: 0;
  border-radius: var(--nt-radius-md);
  background: var(--ion-color-primary);
  padding: 18px;
  display: grid;
  gap: 16px;
}

.tappable {
  cursor: pointer;
}

.card-topline {
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
  color: rgba(var(--nt-ink), 0.5);
}

.card-count {
  font-family: var(--nt-font-mono);
  font-size: 0.82rem;
  color: rgba(var(--nt-ink), 0.85);
}

.chev {
  color: rgba(var(--nt-ink), 0.35);
  font-size: 1rem;
}

/* Hero */
.hero-card {
  gap: 14px;
}

.hero-value {
  font-family: var(--nt-font-display);
  font-size: 3rem;
  font-weight: 700;
  color: var(--nt-fg);
  line-height: 1;
}

.delta-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--nt-font-mono);
  font-size: 0.78rem;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: var(--nt-radius-pill);
}

.delta-chip ion-icon {
  font-size: 0.9rem;
}

.delta-chip__win {
  opacity: 0.6;
  font-size: 0.66rem;
  margin-left: 2px;
}

.delta-chip--up {
  color: var(--nt-data-positive);
  background: rgba(34, 197, 94, 0.12);
}

.delta-chip--down {
  color: var(--ion-color-accent-red);
  background: rgba(215, 26, 33, 0.12);
}

.trend {
  display: grid;
  gap: 4px;
}

.trend__svg {
  width: 100%;
  height: 64px;
  display: block;
}

.trend__axis {
  display: flex;
  justify-content: space-between;
  font-family: var(--nt-font-head);
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(var(--nt-ink), 0.4);
}

.hero-hint {
  margin: 0;
  font-size: 0.8rem;
  color: rgba(var(--nt-ink), 0.45);
}

/* Assets / liabilities split */
.split {
  display: grid;
  gap: 10px;
}

.split__bar {
  display: flex;
  height: 8px;
  border-radius: var(--nt-radius-pill);
  overflow: hidden;
  background: rgba(var(--nt-ink), 0.06);
}

.split__seg {
  height: 100%;
}

.split__seg--asset {
  background: rgba(var(--nt-ink), 0.85);
}

.split__seg--liab {
  background: var(--ion-color-accent-red);
}

.split__legend {
  display: flex;
  justify-content: space-between;
}

.split__item {
  display: grid;
  gap: 3px;
}

.split__item--end {
  text-align: right;
  justify-items: end;
}

.split__label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(var(--nt-ink), 0.5);
}

.split__item strong {
  font-family: var(--nt-font-mono);
  font-size: 0.95rem;
  color: var(--nt-fg);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.dot--asset {
  background: rgba(var(--nt-ink), 0.85);
}

.dot--liab {
  background: var(--ion-color-accent-red);
}

/* This month flow */
.flow-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.flow-cell {
  border-radius: 10px;
  padding: 12px 14px;
  background: rgba(var(--nt-ink), 0.05);
  display: grid;
  gap: 6px;
}

.flow-cell__label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(var(--nt-ink), 0.5);
}

.flow-cell__val {
  font-family: var(--nt-font-mono);
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--nt-fg);
}

.metric-positive {
  color: var(--nt-data-positive);
}

.metric-negative {
  color: var(--ion-color-accent-red);
}

.savings {
  display: grid;
  gap: 8px;
}

.savings__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.savings__head strong {
  font-family: var(--nt-font-mono);
  font-size: 0.9rem;
  color: var(--nt-fg);
}

.savings__bar {
  height: 6px;
  border-radius: var(--nt-radius-pill);
  background: rgba(var(--nt-ink), 0.06);
  overflow: hidden;
}

.savings__fill {
  height: 100%;
  border-radius: var(--nt-radius-pill);
  background: var(--nt-data-positive);
  transition: width var(--nt-dur-std) var(--nt-ease-std);
}

.savings__fill--neg {
  background: var(--ion-color-accent-red);
}

/* Mini lists (bills, recent) */
.mini-list {
  display: grid;
  gap: 10px;
}

.mini-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.mini-row__info {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.mini-row__name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--nt-fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mini-row__meta {
  font-size: 0.7rem;
  color: rgba(var(--nt-ink), 0.5);
}

.mini-row__val {
  font-family: var(--nt-font-mono);
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--nt-fg);
  white-space: nowrap;
}

/* Category bars */
.cat-list {
  display: grid;
  gap: 12px;
}

.cat-row {
  display: grid;
  gap: 6px;
}

.cat-row__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.cat-row__name {
  font-size: 0.85rem;
  color: rgba(var(--nt-ink), 0.8);
}

.cat-row__amt {
  font-family: var(--nt-font-mono);
  font-size: 0.82rem;
  color: var(--nt-fg);
}

.cat-bar {
  height: 6px;
  border-radius: var(--nt-radius-pill);
  background: rgba(var(--nt-ink), 0.06);
  overflow: hidden;
}

.cat-bar__fill {
  height: 100%;
  border-radius: var(--nt-radius-pill);
  background: var(--ion-color-accent-red);
}

.empty-state {
  margin: 0;
  color: rgba(var(--nt-ink), 0.5);
  font-size: 0.88rem;
}
</style>
