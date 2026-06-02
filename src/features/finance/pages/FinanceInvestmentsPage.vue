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
            <p class="section-kicker">Add investment</p>
          </div>
          <div class="form-fields">
            <div class="field-group">
              <label class="field-label">Name</label>
              <ion-input v-model="investmentName" class="styled-input"></ion-input>
            </div>
            <div class="field-group">
              <label class="field-label">Type</label>
              <ion-select v-model="investmentType" class="styled-select">
                <ion-select-option value="stock">Stock</ion-select-option>
                <ion-select-option value="crypto">Crypto</ion-select-option>
                <ion-select-option value="fund">Fund</ion-select-option>
                <ion-select-option value="other">Other</ion-select-option>
              </ion-select>
            </div>
            <div class="field-group">
              <label class="field-label">Quantity</label>
              <ion-input v-model="investmentQuantity" type="number" inputmode="decimal" class="styled-input"></ion-input>
            </div>
            <div class="field-group">
              <label class="field-label">Current value</label>
              <ion-input v-model="investmentValue" type="number" inputmode="decimal" class="styled-input"></ion-input>
            </div>
          </div>
          <ion-button expand="block" class="add-btn" @click="saveInvestment">Add investment</ion-button>
        </ion-card>

        <ion-card class="finance-card">
          <div class="card-topline">
            <p class="section-kicker">Investments</p>
            <span class="card-count">{{ investments.length }} holdings</span>
          </div>
          <div v-if="investments.length" class="item-list">
            <div v-for="investment in investments" :key="investment.id" class="list-item">
              <div class="list-item__info">
                <strong class="list-item__name">{{ investment.name }}</strong>
                <span class="list-item__meta">{{ investment.type }} · {{ investment.quantity }} units</span>
              </div>
              <span class="list-item__value">{{ formatCurrency(Number(investment.value) || 0) }}</span>
            </div>
          </div>
          <p v-else class="empty-state">No investments yet.</p>
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
  max-width: 760px;
  margin: 0 auto;
  padding: 16px;
  display: grid;
  gap: 16px;
}

.finance-card {
  margin: 0;
  border-radius: 12px;
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
  color: rgba(255, 255, 255, 0.45);
}

.card-count {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.45);
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
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
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

.add-btn {
  --background: rgb(239, 68, 68);
  --background-activated: rgb(220, 50, 50);
  --border-radius: 8px;
  --box-shadow: none;
  margin: 0;
}

.item-list {
  display: grid;
  gap: 8px;
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
  gap: 4px;
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
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
}

.empty-state {
  margin: 0;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.9rem;
}
</style>
