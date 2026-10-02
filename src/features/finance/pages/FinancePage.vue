<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <finance-section-tabs />
    </ion-header>
    <ion-content :fullscreen="true" class="finance-content">
      <div class="finance-shell">
        <div v-if="loading" class="page-loading"><span class="nt-loading-dot"></span><span class="nt-loading-dot"></span><span class="nt-loading-dot"></span></div>
        <!-- Net worth hero + trend -->
        <ion-card class="finance-card hero-card">
          <div class="card-topline">
            <p class="nt-kicker">Net worth</p>
            <span v-if="failed['accounts'] || failed['investments']" class="card-error">Couldn't load</span>
            <span v-if="netDelta !== null" class="delta-chip" :class="netDelta >= 0 ? 'delta-chip--up' : 'delta-chip--down'">
              <ion-icon :icon="netDelta >= 0 ? trendingUpOutline : trendingDownOutline" />
              {{ netDelta >= 0 ? '+' : '−' }}{{ formatCurrency(Math.abs(netDelta)) }}
              <span class="delta-chip__win">{{ deltaDays }}d</span>
            </span>
          </div>
          <div class="hero-value">{{ formatCurrency(netWorth) }}</div>

          <TrendChart
            v-if="history.length >= 2"
            :pts="history.map((p) => ({ label: formatLocalDay(p.date), value: p.net }))"
            unit=""
            size="xs"
          />
          <!-- Failed history fetch must stay visible even when a previous range
               succeeded and the chart still shows that stale series. -->
          <p v-if="failed['history']" class="hero-hint card-error-inline">Couldn't load</p>
          <p v-else-if="history.length < 2" class="hero-hint">Net worth trend builds as you use the app daily.</p>

          <!-- Trend window: screen-local preference, no persistence. -->
          <div class="range-switch" role="group" aria-label="Trend range">
            <button
              v-for="r in rangeOptions"
              :key="r"
              type="button"
              class="range-switch__btn"
              :class="{ 'is-active': historyRange === r }"
              :aria-pressed="historyRange === r"
              @click="selectHistoryRange(r)"
            >{{ r }}d</button>
          </div>
        </ion-card>

        <!-- This month cash flow -->
        <ion-card class="finance-card tappable" button @click="go('/finance/budget')">
          <div class="card-topline">
            <p class="nt-kicker">This month</p>
            <span v-if="failed['month']" class="card-error">Couldn't load</span>
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
            <p class="nt-kicker">Upcoming bills · {{ rangeBillsDays }}d</p>
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
          <p v-else class="nt-empty">No bills in the next {{ rangeBillsDays }} days</p>
        </ion-card>

        <!-- Top spending categories -->
        <ion-card class="finance-card tappable" button @click="go('/finance/analytics')">
          <div class="card-topline">
            <p class="nt-kicker">Top categories</p>
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
          <p v-else class="nt-empty">No spending this month</p>
        </ion-card>

        <!-- Recent activity -->
        <ion-card class="finance-card tappable" button @click="go('/finance/budget')">
          <div class="card-topline">
            <p class="nt-kicker">Recent activity</p>
            <ion-icon class="chev" :icon="chevronForwardOutline" />
          </div>
          <div v-if="recent.length" class="mini-list">
            <div v-for="tx in recent" :key="tx.id" class="mini-row">
              <div class="mini-row__info">
                <strong class="mini-row__name">{{ tx.name }}</strong>
                <span class="mini-row__meta">
                  {{ tx.type === 'income' ? 'Income' : categoryLabel(tx.category) }} · {{ formatLocalDay(tx.date) }}<template v-if="tx.account_name"> · {{ tx.account_name }}</template>
                </span>
              </div>
              <span class="mini-row__val" :class="{ 'metric-positive': tx.type === 'income' }">
                {{ tx.type === 'income' ? '+' : '−' }}{{ formatCurrency(Number(tx.amount) || 0) }}
              </span>
            </div>
          </div>
          <p v-else-if="failed['recent']" class="empty-state card-error">Couldn't load transactions</p>
          <p v-else class="nt-empty">No transactions yet</p>
        </ion-card>

        <!-- Danger zone: wipe all finance data (gym/health untouched) -->
        <ion-button expand="block" class="reset-btn" :disabled="resetting" @click="confirmReset">
          {{ resetting ? 'Resetting…' : 'Reset finance data' }}
        </ion-button>
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
  IonButton,
  IonIcon,
  alertController,
  onIonViewWillEnter,
} from '@ionic/vue';
import { chevronForwardOutline, trendingUpOutline, trendingDownOutline } from 'ionicons/icons';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import TrendChart from '@/shared/components/TrendChart.vue';
import FinanceSectionTabs from '@/features/finance/components/FinanceSectionTabs.vue';
import {
  getFinanceAccounts,
  getFinanceInvestments,
  getFinanceSubscriptions,
  getFinanceMonthTotals,
  getRecentFinanceTransactions,
  getNetWorthHistory,
  queryCategorySpending,
  recordNetWorthSnapshot,
  postDueSubscriptions,
  resetFinanceData,
  type NetWorthPoint,
  type CategorySpending,
} from '@/shared/db/app_db';
import { formatCurrency } from '@/shared/utils/currency';
import { hapticLight, hapticHeavy, hapticSuccess } from '@/shared/utils/haptics';
import { showToast } from '@/shared/utils/toast';
import { localMonthISO, formatLocalDay, parseLocalDate } from '@/shared/utils/timeFormat';
import {
  computeNetWorth,
  upcomingBills,
  savingsRate,
  categoryLabel,
  dueLabel,
  type SubscriptionRow,
} from '@/features/finance/finance';

const router = useRouter();

// Net-worth trend window: 30/90/365 days, screen-local preference.
const rangeOptions = [30, 90, 365] as const;
type HistoryRange = (typeof rangeOptions)[number];
const historyRange = ref<HistoryRange>(30);
const rangeBillsDays = 14;

const accounts = ref<Array<Record<string, any>>>([]);
const investments = ref<Array<Record<string, any>>>([]);
const subscriptions = ref<SubscriptionRow[]>([]);
const monthTotals = ref<{ income: number; expense: number }>({ income: 0, expense: 0 });
const history = ref<NetWorthPoint[]>([]);
const recent = ref<Array<Record<string, any>>>([]);
const topCategories = ref<CategorySpending[]>([]);
const loading = ref(true);
// Per-card failure flags: a DB error must not look like "no data".
const failed = ref<Record<string, boolean>>({});

const netWorth = computed(() => computeNetWorth(accounts.value, investments.value));

// Delta vs the first snapshot in the trend window.
const netDelta = computed(() => {
  if (history.value.length < 2) return null;
  return netWorth.value - history.value[0].net;
});

// Actual age of the comparison snapshot (≤ selected range), so the chip shows
// "5d" when the app only has 5 days of history rather than a misleading "30d".
// Parsed with parseLocalDate — `new Date('YYYY-MM-DD')` is UTC midnight and
// shifts a day in UTC+ timezones.
const deltaDays = computed(() => {
  if (history.value.length < 2) return historyRange.value;
  const first = parseLocalDate(history.value[0].date).getTime();
  const days = Math.round((Date.now() - first) / 86400000);
  return Math.max(1, Math.min(historyRange.value, days));
});

const monthIncome = computed(() => monthTotals.value.income);
const monthExpense = computed(() => monthTotals.value.expense);
const monthNet = computed(() => monthIncome.value - monthExpense.value);
const savingsPct = computed(() => savingsRate(monthIncome.value, monthExpense.value));

const allBills = computed(() => upcomingBills(subscriptions.value, rangeBillsDays));
const bills = computed(() => allBills.value.slice(0, 4));
const billsTotal = computed(() => allBills.value.reduce((s, b) => s + (Number(b.amount) || 0), 0));

const topCategoryMax = computed(() => topCategories.value[0]?.amount || 1);

const go = (path: string) => {
  hapticLight();
  router.push(path);
};

const resetting = ref(false);

const confirmReset = async () => {
  const alert = await alertController.create({
    header: 'Reset finance data',
    message: 'Delete ALL finance data? Accounts, investments, subscriptions, transactions, budgets and net-worth history are removed. Gym and health data is untouched. This cannot be undone.',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Delete all',
        role: 'destructive',
        handler: async () => {
          hapticHeavy();
          resetting.value = true;
          try {
            await resetFinanceData();
          } catch {
            resetting.value = false;
            await showToast('reset failed', 'warning');
            return;
          }
          resetting.value = false;
          await loadFinance();
          hapticSuccess();
          await showToast('finance data reset', 'success');
        },
      },
    ],
  });
  await alert.present();
};

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

// Monotonic token so a slow 30d response can never overwrite a later 365d one.
let historyRequestToken = 0;

const loadHistory = async () => {
  const token = ++historyRequestToken;
  const range = historyRange.value;
  const hist = await settled('history', getNetWorthHistory(range), []);
  if (token !== historyRequestToken) return; // stale response — drop it
  history.value = hist;
};

const selectHistoryRange = (range: HistoryRange) => {
  if (historyRange.value === range) return;
  hapticLight();
  historyRange.value = range;
  loadHistory();
};

const loadFinance = async () => {
  loading.value = true;
  // Persist today's snapshot first so the trend includes the latest point.
  await recordNetWorthSnapshot().catch(() => {});
  // Auto-post due subscription periods (idempotent) before reading totals.
  await postDueSubscriptions().catch(() => {});
  const monthKey = localMonthISO();
  const [acc, inv, subs, totals, , rec, cats] = await Promise.all([
    settled('accounts', getFinanceAccounts(), []),
    settled('investments', getFinanceInvestments(), []),
    settled('subscriptions', getFinanceSubscriptions(), []),
    settled('month', getFinanceMonthTotals(monthKey), { income: 0, expense: 0 }),
    loadHistory(),
    settled('recent', getRecentFinanceTransactions(5), []),
    settled('categories', queryCategorySpending(monthKey), []),
  ]);
  accounts.value = acc;
  investments.value = inv;
  subscriptions.value = subs;
  monthTotals.value = totals;
  recent.value = rec;
  topCategories.value = cats.slice(0, 4);
  loading.value = false;
};

onIonViewWillEnter(loadFinance);
</script>

<style scoped>
/* Shared finance primitives (.finance-content, .metric-*) live in theme/finance.css
   — do not re-declare them here; a scoped copy silently shadows the global. */

.page-loading {
  display: flex;
  gap: 8px;
  justify-content: center;
  padding: 8px 0;
}

.card-error {
  margin-left: auto;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--ion-color-accent-red);
}


.tappable {
  cursor: pointer;
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
  background: color-mix(in srgb, var(--nt-data-positive) 12%, transparent);
}

.delta-chip--down {
  color: var(--ion-color-accent-red);
  background: color-mix(in srgb, var(--ion-color-accent-red) 12%, transparent);
}

.hero-hint {
  margin: 0;
  font-size: 0.8rem;
  color: rgba(var(--nt-ink), 0.45);
}

/* Assets / liabilities split removed — the "This month" card owns cash flow. */
.range-switch {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  background: var(--nt-tile);
  border-radius: var(--nt-radius-pill);
  align-self: flex-start;
}

.range-switch__btn {
  appearance: none;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 5px 12px;
  border-radius: var(--nt-radius-pill);
  font-family: var(--nt-font-head);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 600;
  color: var(--nt-text-dim);
  transition: background var(--nt-dur-micro) var(--nt-ease-decel),
    color var(--nt-dur-micro) var(--nt-ease-decel);
}

.range-switch__btn.is-active {
  background: var(--nt-surface-2);
  color: var(--nt-fg);
}

.range-switch__btn:active {
  opacity: 0.7;
}

.card-error-inline {
  color: var(--ion-color-accent-red);
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
  background: var(--nt-tile);
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
  background: var(--nt-tile);
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
  background: var(--nt-tile);
  overflow: hidden;
}

.cat-bar__fill {
  height: 100%;
  border-radius: var(--nt-radius-pill);
  background: var(--ion-color-accent-red);
}

/* Danger zone: destructive outline button (red text, hairline border). */
.reset-btn {
  --background: transparent;
  --background-activated: var(--nt-surface-2);
  --border-radius: 8px;
  --box-shadow: none;
  --color: var(--ion-color-accent-red);
  --border-color: var(--ion-color-accent-red);
  --border-style: solid;
  --border-width: 1px;
  font-weight: 600;
  margin: 0;
  text-transform: none;
}


</style>
