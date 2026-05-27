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
            <ion-card-title>Add investment</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list>
              <ion-item>
                <ion-label position="stacked">Name</ion-label>
                <ion-input v-model="investmentName"></ion-input>
              </ion-item>
              <ion-item>
                <ion-label position="stacked">Type</ion-label>
                <ion-select v-model="investmentType">
                  <ion-select-option value="stock">Stock</ion-select-option>
                  <ion-select-option value="crypto">Crypto</ion-select-option>
                  <ion-select-option value="fund">Fund</ion-select-option>
                  <ion-select-option value="other">Other</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-item>
                <ion-label position="stacked">Quantity</ion-label>
                <ion-input v-model="investmentQuantity" type="number" inputmode="decimal"></ion-input>
              </ion-item>
              <ion-item>
                <ion-label position="stacked">Current value</ion-label>
                <ion-input v-model="investmentValue" type="number" inputmode="decimal"></ion-input>
              </ion-item>
            </ion-list>
            <ion-button expand="block" @click="saveInvestment">Add investment</ion-button>
          </ion-card-content>
        </ion-card>

        <ion-card class="finance-card">
          <ion-card-header>
            <ion-card-title>Investments</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list v-if="investments.length">
              <ion-item v-for="investment in investments" :key="investment.id">
                <ion-label>
                  <h3>{{ investment.name }}</h3>
                  <p>{{ investment.type }} · {{ investment.quantity }} units</p>
                </ion-label>
                <strong slot="end">{{ formatCurrency(Number(investment.value) || 0) }}</strong>
              </ion-item>
            </ion-list>
            <p v-else class="empty-state">No investments yet.</p>
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
import { addFinanceInvestment, getFinanceInvestments } from '@/shared/db/app_db';

const investmentName = ref('');
const investmentType = ref('stock');
const investmentQuantity = ref('');
const investmentValue = ref('');
const investments = ref<Array<Record<string, any>>>([]);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

const loadInvestments = async () => {
  investments.value = await getFinanceInvestments();
};

const saveInvestment = async () => {
  if (!investmentName.value.trim()) {
    const toast = await toastController.create({
      message: 'Investment name is required.',
      duration: 2000,
      color: 'warning',
    });
    await toast.present();
    return;
  }

  const quantity = Number(investmentQuantity.value);
  const value = Number(investmentValue.value);
  if (!Number.isFinite(quantity) || !Number.isFinite(value)) {
    const toast = await toastController.create({
      message: 'Quantity and value must be valid numbers.',
      duration: 2000,
      color: 'warning',
    });
    await toast.present();
    return;
  }

  await addFinanceInvestment(investmentName.value.trim(), investmentType.value, quantity, value);
  investmentName.value = '';
  investmentQuantity.value = '';
  investmentValue.value = '';
  await loadInvestments();

  const toast = await toastController.create({
    message: 'Investment added.',
    duration: 1800,
    color: 'success',
  });
  await toast.present();
};

onIonViewWillEnter(async () => {
  await loadInvestments();
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
