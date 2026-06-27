<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <finance-section-tabs />
    </ion-header>
    <ion-content :fullscreen="true" class="finance-content">
      <div class="finance-shell">
        <ion-card class="summary-card net-worth-card">
          <div class="card-topline">
            <p class="section-kicker">Net worth</p>
          </div>
          <div class="net-worth-value">{{ netWorthDisplay }}</div>
          <div class="card-metrics">
            <div class="card-metric">
              <span>Accounts</span>
              <strong>{{ accountsTotalDisplay }}</strong>
            </div>
            <div class="card-metric">
              <span>Investments</span>
              <strong>{{ investmentsTotalDisplay }}</strong>
            </div>
            <div class="card-metric">
              <span>Subs/mo</span>
              <strong>{{ subscriptionsTotalDisplay }}</strong>
            </div>
            <div class="card-metric">
              <span>Holdings</span>
              <strong>{{ investments.length }}</strong>
            </div>
            <div class="card-metric">
              <span>Spent</span>
              <strong>{{ monthSpentDisplay }}</strong>
            </div>
            <div class="card-metric">
              <span>Left</span>
              <strong :class="{ 'metric-over': budgetLeft < 0 }">{{ budgetLeftDisplay }}</strong>
            </div>
          </div>
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
  onIonViewWillEnter,
} from '@ionic/vue';
import { computed, ref } from 'vue';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import FinanceSectionTabs from '@/features/finance/components/FinanceSectionTabs.vue';
import {
  getFinanceAccounts,
  getFinanceInvestments,
  getFinanceSubscriptions,
  getFinanceTransactionsForMonth,
  getFinanceBudgets,
  recordNetWorthSnapshot,
} from '@/shared/db/app_db';
import { formatCurrency } from '@/shared/utils/currency';

const accounts = ref<Array<Record<string, any>>>([]);
const investments = ref<Array<Record<string, any>>>([]);
const subscriptions = ref<Array<Record<string, any>>>([]);
const monthTransactions = ref<Array<Record<string, any>>>([]);
const budgets = ref<Array<Record<string, any>>>([]);

const accountsTotal = computed(() =>
  accounts.value.reduce((sum, account) => sum + (Number(account.balance) || 0), 0)
);

const investmentsTotal = computed(() =>
  investments.value.reduce((sum, investment) => sum + (Number(investment.value) || 0), 0)
);

// Normalize each subscription to a monthly cost so the "/ mo" total is accurate
// regardless of billing cadence (yearly ÷ 12, weekly × 52 ÷ 12).
const subscriptionsTotal = computed(() =>
  subscriptions.value.reduce((sum, sub) => {
    // Recurring income is shown separately; the "/ mo" total is outflow only.
    if (sub.direction === 'income') return sum;
    const amount = Number(sub.amount) || 0;
    if (sub.cadence === 'yearly') return sum + amount / 12;
    if (sub.cadence === 'weekly') return sum + (amount * 52) / 12;
    return sum + amount;
  }, 0)
);

const netWorth = computed(() => accountsTotal.value + investmentsTotal.value);

const monthSpent = computed(() =>
  monthTransactions.value
    .filter((t) => t.type !== 'income')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
);

const budgetTotal = computed(() =>
  budgets.value.reduce((sum, b) => sum + (Number(b.monthly_limit) || 0), 0)
);

const budgetLeft = computed(() => budgetTotal.value - monthSpent.value);

const accountsTotalDisplay = computed(() => formatCurrency(accountsTotal.value));
const investmentsTotalDisplay = computed(() => formatCurrency(investmentsTotal.value));
const subscriptionsTotalDisplay = computed(() => formatCurrency(subscriptionsTotal.value));
const netWorthDisplay = computed(() => formatCurrency(netWorth.value));
const monthSpentDisplay = computed(() => formatCurrency(monthSpent.value));
const budgetLeftDisplay = computed(() => formatCurrency(budgetLeft.value));

const loadFinance = async () => {
  accounts.value = await getFinanceAccounts();
  investments.value = await getFinanceInvestments();
  subscriptions.value = await getFinanceSubscriptions();
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  monthTransactions.value = await getFinanceTransactionsForMonth(monthKey);
  budgets.value = await getFinanceBudgets();
  // Persist a daily net-worth snapshot so the review digest can track the delta.
  await recordNetWorthSnapshot();
};

onIonViewWillEnter(async () => {
  await loadFinance();
});
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

.summary-card {
  margin: 0;
  border-radius: var(--nt-radius-md);
  background: var(--ion-color-primary);
  padding: 18px;
}

.net-worth-card {
  display: grid;
  gap: 18px;
}

.card-topline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.section-kicker {
  margin: 0;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: rgba(var(--nt-ink), 0.5);
}

.card-sub {
  font-size: 0.72rem;
  color: rgba(var(--nt-ink), 0.5);
}

.net-worth-value {
  font-size: 3rem;
  font-weight: 700;
  color: var(--nt-fg);
  line-height: 1;
}

.card-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.card-metric {
  border-radius: 10px;
  padding: 12px 14px;
  background: rgba(var(--nt-ink), 0.05);
}

.card-metric span {
  display: block;
  margin-bottom: 6px;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(var(--nt-ink), 0.5);
}

.card-metric strong {
  display: block;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--nt-fg);
}

.metric-over {
  color: var(--ion-color-accent-red);
}

@media (min-width: 600px) {
  .card-metrics {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
