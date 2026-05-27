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
            <ion-card-title>Add account</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list>
              <ion-item>
                <ion-label position="stacked">Account name</ion-label>
                <ion-input v-model="accountName"></ion-input>
              </ion-item>
              <ion-item>
                <ion-label position="stacked">Type</ion-label>
                <ion-select v-model="accountType">
                  <ion-select-option value="cash">Cash</ion-select-option>
                  <ion-select-option value="bank">Bank</ion-select-option>
                  <ion-select-option value="credit">Credit</ion-select-option>
                  <ion-select-option value="loan">Loan</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-item>
                <ion-label position="stacked">Institution</ion-label>
                <ion-input v-model="accountInstitution"></ion-input>
              </ion-item>
              <ion-item>
                <ion-label position="stacked">Balance</ion-label>
                <ion-input v-model="accountBalance" type="number" inputmode="decimal"></ion-input>
              </ion-item>
            </ion-list>
            <ion-button expand="block" @click="saveAccount">Add account</ion-button>
          </ion-card-content>
        </ion-card>

        <ion-card class="finance-card">
          <ion-card-header>
            <ion-card-title>Accounts</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list v-if="accounts.length">
              <ion-item v-for="account in accounts" :key="account.id">
                <ion-label>
                  <h3>{{ account.name }}</h3>
                  <p>{{ account.type }} · {{ account.institution || 'No institution' }}</p>
                </ion-label>
                <strong slot="end">{{ formatCurrency(Number(account.balance) || 0) }}</strong>
              </ion-item>
            </ion-list>
            <p v-else class="empty-state">No accounts yet.</p>
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
import { addFinanceAccount, getFinanceAccounts } from '@/shared/db/app_db';

const accountName = ref('');
const accountType = ref('cash');
const accountInstitution = ref('');
const accountBalance = ref('');
const accounts = ref<Array<Record<string, any>>>([]);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

const loadAccounts = async () => {
  accounts.value = await getFinanceAccounts();
};

const saveAccount = async () => {
  if (!accountName.value.trim()) {
    const toast = await toastController.create({
      message: 'Account name is required.',
      duration: 2000,
      color: 'warning',
    });
    await toast.present();
    return;
  }

  const balance = Number(accountBalance.value);
  if (!Number.isFinite(balance)) {
    const toast = await toastController.create({
      message: 'Balance must be a valid number.',
      duration: 2000,
      color: 'warning',
    });
    await toast.present();
    return;
  }

  await addFinanceAccount(accountName.value.trim(), accountType.value, accountInstitution.value.trim() || null, balance);
  accountName.value = '';
  accountInstitution.value = '';
  accountBalance.value = '';
  await loadAccounts();

  const toast = await toastController.create({
    message: 'Account added.',
    duration: 1800,
    color: 'success',
  });
  await toast.present();
};

onIonViewWillEnter(async () => {
  await loadAccounts();
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
