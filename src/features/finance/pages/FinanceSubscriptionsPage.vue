<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <finance-section-tabs />
    </ion-header>
    <ion-content :fullscreen="true" class="finance-content">
      <div class="finance-shell">
        <ion-card class="finance-card">
          <ion-card-header>
            <ion-card-title>Add subscription</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list>
              <ion-item>
                <ion-label position="stacked">Name</ion-label>
                <ion-input v-model="subscriptionName"></ion-input>
              </ion-item>
              <ion-item>
                <ion-label position="stacked">Amount</ion-label>
                <ion-input v-model="subscriptionAmount" type="number" inputmode="decimal"></ion-input>
              </ion-item>
              <ion-item>
                <ion-label position="stacked">Cadence</ion-label>
                <ion-select v-model="subscriptionCadence">
                  <ion-select-option value="monthly">Monthly</ion-select-option>
                  <ion-select-option value="yearly">Yearly</ion-select-option>
                  <ion-select-option value="weekly">Weekly</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-item>
                <ion-label position="stacked">Next due date</ion-label>
                <ion-input v-model="subscriptionNextDue" type="date"></ion-input>
              </ion-item>
            </ion-list>
            <ion-button expand="block" @click="saveSubscription">Add subscription</ion-button>
          </ion-card-content>
        </ion-card>

        <ion-card class="finance-card">
          <ion-card-header>
            <ion-card-title>Subscriptions</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list v-if="subscriptions.length">
              <ion-item v-for="subscription in subscriptions" :key="subscription.id">
                <ion-label>
                  <h3>{{ subscription.name }}</h3>
                  <p>{{ subscription.cadence }} · due {{ subscription.next_due_date || 'TBD' }}</p>
                </ion-label>
                <strong slot="end">{{ formatCurrency(Number(subscription.amount) || 0) }}</strong>
              </ion-item>
            </ion-list>
            <p v-else class="empty-state">No subscriptions yet.</p>
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
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
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
  padding: 16px;
  display: grid;
  gap: 16px;
}

.finance-card {
  margin: 0;
  border-radius: 12px;
  background: var(--ion-color-primary);
}

.empty-state {
  margin: 0;
  color: rgba(255, 255, 255, 0.6);
}
</style>
