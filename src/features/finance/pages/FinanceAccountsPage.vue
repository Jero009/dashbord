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
            <p class="section-kicker">Add account</p>
          </div>
          <div class="form-fields">
            <div class="field-group">
              <label class="field-label">Account name</label>
              <ion-input v-model="accountName" class="styled-input"></ion-input>
            </div>
            <div class="field-group">
              <label class="field-label">Type</label>
              <ion-select v-model="accountType" class="styled-select">
                <ion-select-option value="cash">Cash</ion-select-option>
                <ion-select-option value="bank">Bank</ion-select-option>
                <ion-select-option value="credit">Credit</ion-select-option>
                <ion-select-option value="loan">Loan</ion-select-option>
              </ion-select>
            </div>
            <div class="field-group">
              <label class="field-label">Institution</label>
              <ion-input v-model="accountInstitution" class="styled-input"></ion-input>
            </div>
            <div class="field-group">
              <label class="field-label">Balance</label>
              <ion-input v-model="accountBalance" type="number" inputmode="decimal" class="styled-input"></ion-input>
            </div>
          </div>
          <ion-button expand="block" class="add-btn" @click="saveAccount">Add account</ion-button>
        </ion-card>

        <ion-card class="finance-card">
          <div class="card-topline">
            <p class="section-kicker">Accounts</p>
            <span class="card-count">{{ accounts.length }} total</span>
          </div>
          <div v-if="accounts.length" class="account-list">
            <div v-for="account in accounts" :key="account.id" class="account-item">
              <div class="account-item__info">
                <strong class="account-item__name">{{ account.name }}</strong>
                <span class="account-item__meta">{{ account.type }} · {{ account.institution || 'No institution' }}</span>
              </div>
              <span class="account-item__balance">{{ formatCurrency(Number(account.balance) || 0) }}</span>
            </div>
          </div>
          <p v-else class="empty-state">No accounts yet.</p>
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
import { addFinanceAccount, getFinanceAccounts } from '@/shared/db/app_db';
import { formatCurrency } from '@/shared/utils/currency';

const accountName = ref('');
const accountType = ref('cash');
const accountInstitution = ref('');
const accountBalance = ref('');
const accounts = ref<Array<Record<string, any>>>([]);

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

  try {
    await addFinanceAccount(accountName.value.trim(), accountType.value, accountInstitution.value.trim() || null, balance);
  } catch {
    const toast = await toastController.create({
      message: 'Could not save account. Please try again.',
      duration: 2000,
      color: 'warning',
    });
    await toast.present();
    return;
  }
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

.account-list {
  display: grid;
  gap: 10px;
}

.account-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  border-radius: 10px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.05);
}

.account-item__info {
  display: grid;
  gap: 6px;
}

.account-item__name {
  font-size: 0.95rem;
  font-weight: 600;
  color: #fff;
}

.account-item__meta {
  font-size: 0.72rem;
  text-transform: capitalize;
  color: rgba(255, 255, 255, 0.5);
}

.account-item__balance {
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
