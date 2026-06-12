<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <finance-section-tabs />
    </ion-header>
    <ion-content :fullscreen="true" class="finance-content">
      <div class="finance-shell">
        <ion-card class="finance-card">
          <div class="card-topline">
            <p class="section-kicker">Add subscription</p>
          </div>
          <div class="form-fields">
            <div class="field-group">
              <label class="field-label">Name</label>
              <ion-input v-model="subscriptionName" class="styled-input"></ion-input>
            </div>
            <div class="field-group">
              <label class="field-label">Amount</label>
              <ion-input v-model="subscriptionAmount" type="number" inputmode="decimal" class="styled-input"></ion-input>
            </div>
            <div class="field-group">
              <label class="field-label">Cadence</label>
              <ion-select v-model="subscriptionCadence" class="styled-select">
                <ion-select-option value="monthly">Monthly</ion-select-option>
                <ion-select-option value="yearly">Yearly</ion-select-option>
                <ion-select-option value="weekly">Weekly</ion-select-option>
              </ion-select>
            </div>
            <div class="field-group">
              <label class="field-label">Next due date</label>
              <ion-input v-model="subscriptionNextDue" type="date" class="styled-input"></ion-input>
            </div>
          </div>
          <ion-button expand="block" class="add-btn" @click="saveSubscription">Add subscription</ion-button>
        </ion-card>

        <ion-card class="finance-card">
          <div class="card-topline">
            <p class="section-kicker">Subscriptions</p>
            <span class="card-count">{{ subscriptions.length }} active</span>
          </div>
          <div v-if="subscriptions.length" class="item-list">
            <div v-for="subscription in subscriptions" :key="subscription.id" class="list-item">
              <div class="list-item__info">
                <strong class="list-item__name">{{ subscription.name }}</strong>
                <span class="list-item__meta">{{ subscription.cadence }} · due {{ subscription.next_due_date || 'TBD' }}</span>
              </div>
              <span class="list-item__value">{{ formatCurrency(Number(subscription.amount) || 0) }}</span>
            </div>
          </div>
          <p v-else class="empty-state">No subscriptions yet.</p>
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
  IonInput,
  IonSelect,
  IonSelectOption,
  IonButton,
  onIonViewWillEnter,
  toastController,
} from '@ionic/vue';
import { ref } from 'vue';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import FinanceSectionTabs from '@/features/finance/components/FinanceSectionTabs.vue';
import { addFinanceSubscription, getFinanceSubscriptions } from '@/shared/db/app_db';

const subscriptionName = ref('');
const subscriptionAmount = ref('');
const subscriptionCadence = ref('monthly');
const subscriptionNextDue = ref('');
const subscriptions = ref<Array<Record<string, any>>>([]);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

const loadSubscriptions = async () => {
  subscriptions.value = await getFinanceSubscriptions();
};

const saveSubscription = async () => {
  if (!subscriptionName.value.trim()) {
    const toast = await toastController.create({
      message: 'Subscription name is required.',
      duration: 2000,
      color: 'warning',
    });
    await toast.present();
    return;
  }

  const amount = Number(subscriptionAmount.value);
  if (!Number.isFinite(amount)) {
    const toast = await toastController.create({
      message: 'Amount must be a valid number.',
      duration: 2000,
      color: 'warning',
    });
    await toast.present();
    return;
  }

  await addFinanceSubscription(
    subscriptionName.value.trim(),
    amount,
    subscriptionCadence.value,
    subscriptionNextDue.value || undefined
  );
  subscriptionName.value = '';
  subscriptionAmount.value = '';
  subscriptionNextDue.value = '';
  await loadSubscriptions();

  const toast = await toastController.create({
    message: 'Subscription added.',
    duration: 1800,
    color: 'success',
  });
  await toast.present();
};

onIonViewWillEnter(async () => {
  await loadSubscriptions();
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

.finance-card {
  margin: 0;
  border-radius: var(--nt-radius-md);
  background: var(--ion-color-primary);
  padding: 18px;
  display: grid;
  gap: 16px;
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

.card-count {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.5);
}

.form-fields {
  display: grid;
  gap: 10px;
}

.field-group {
  display: grid;
  gap: 6px;
}

.field-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.5);
}

.styled-input,
.styled-select {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #fff;
  --color: #fff;
  --placeholder-color: rgba(255, 255, 255, 0.35);
  --padding-start: 12px;
  --padding-end: 12px;
  --padding-top: 10px;
  --padding-bottom: 10px;
  min-height: 44px;
}

.styled-input:focus-within,
.styled-select:focus-within {
  border-color: rgb(215, 26, 33);
}

.add-btn {
  --background: var(--ion-color-accent-red);
  --background-activated: rgb(178, 19, 25);
  --border-radius: 8px;
  --box-shadow: none;
  font-weight: 600;
  margin: 0;
}

.item-list {
  display: grid;
  gap: 10px;
}

.list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  border-radius: 10px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.05);
}

.list-item__info {
  display: grid;
  gap: 6px;
}

.list-item__name {
  font-size: 0.95rem;
  font-weight: 600;
  color: #fff;
}

.list-item__meta {
  font-size: 0.72rem;
  text-transform: capitalize;
  color: rgba(255, 255, 255, 0.5);
}

.list-item__value {
  font-size: 0.95rem;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
}

.empty-state {
  margin: 0;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.9rem;
}
</style>
