<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <finance-section-tabs />
    </ion-header>
    <ion-content :fullscreen="true" class="finance-content">
      <div class="finance-shell">
        <section class="summary-grid">
          <ion-card class="summary-card">
            <ion-card-header>
              <ion-card-title>Net worth</ion-card-title>
              <ion-card-subtitle>Accounts + investments</ion-card-subtitle>
            </ion-card-header>
            <ion-card-content>
              <div class="metric-value">{{ netWorthDisplay }}</div>
            </ion-card-content>
          </ion-card>

          <ion-card class="summary-card">
            <ion-card-header>
              <ion-card-title>Accounts</ion-card-title>
              <ion-card-subtitle>{{ accounts.length }} total</ion-card-subtitle>
            </ion-card-header>
            <ion-card-content>
              <div class="metric-value">{{ accountsTotalDisplay }}</div>
            </ion-card-content>
          </ion-card>

          <ion-card class="summary-card">
            <ion-card-header>
              <ion-card-title>Subscriptions</ion-card-title>
              <ion-card-subtitle>Monthly spend</ion-card-subtitle>
            </ion-card-header>
            <ion-card-content>
              <div class="metric-value">{{ subscriptionsTotalDisplay }}</div>
            </ion-card-content>
          </ion-card>
        </section>

        <ion-card class="summary-card">
          <ion-card-header>
            <ion-card-title>Investments</ion-card-title>
            <ion-card-subtitle>{{ investments.length }} holdings</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <div class="metric-value">{{ investmentsTotalDisplay }}</div>
          </ion-card-content>
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
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
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
  padding: 16px;
  display: grid;
  gap: 16px;
}

.summary-grid {
  display: grid;
  gap: 12px;
}

.summary-card {
  margin: 0;
  border-radius: 12px;
  background: var(--ion-color-primary);
}

.metric-value {
  font-size: 1.6rem;
  font-weight: 600;
}

@media (min-width: 760px) {
  .summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
