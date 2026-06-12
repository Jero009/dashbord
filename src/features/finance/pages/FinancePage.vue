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
            <span class="card-sub">Accounts + investments</span>
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
              <span>Subscriptions / mo</span>
              <strong>{{ subscriptionsTotalDisplay }}</strong>
            </div>
            <div class="card-metric">
              <span>Holdings</span>
              <strong>{{ investments.length }}</strong>
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
import { getFinanceAccounts, getFinanceInvestments, getFinanceSubscriptions } from '@/shared/db/app_db';

const accounts = ref<Array<Record<string, any>>>([]);
const investments = ref<Array<Record<string, any>>>([]);
const subscriptions = ref<Array<Record<string, any>>>([]);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

const accountsTotal = computed(() =>
  accounts.value.reduce((sum, account) => sum + (Number(account.balance) || 0), 0)
);

const investmentsTotal = computed(() =>
  investments.value.reduce((sum, investment) => sum + (Number(investment.value) || 0), 0)
);

const subscriptionsTotal = computed(() =>
  subscriptions.value.reduce((sum, sub) => sum + (Number(sub.amount) || 0), 0)
);

const netWorth = computed(() => accountsTotal.value + investmentsTotal.value);

const accountsTotalDisplay = computed(() => formatCurrency(accountsTotal.value));
const investmentsTotalDisplay = computed(() => formatCurrency(investmentsTotal.value));
const subscriptionsTotalDisplay = computed(() => formatCurrency(subscriptionsTotal.value));
const netWorthDisplay = computed(() => formatCurrency(netWorth.value));

const loadFinance = async () => {
  accounts.value = await getFinanceAccounts();
  investments.value = await getFinanceInvestments();
  subscriptions.value = await getFinanceSubscriptions();
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
  color: rgba(255, 255, 255, 0.5);
}

.card-sub {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.5);
}

.net-worth-value {
  font-size: 3rem;
  font-weight: 700;
  color: #fff;
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
  background: rgba(255, 255, 255, 0.05);
}

.card-metric span {
  display: block;
  margin-bottom: 6px;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.5);
}

.card-metric strong {
  display: block;
  font-size: 0.95rem;
  font-weight: 600;
  color: #fff;
}

@media (min-width: 600px) {
  .card-metrics {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
