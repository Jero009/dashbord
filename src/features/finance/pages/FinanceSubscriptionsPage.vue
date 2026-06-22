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
            <p class="section-kicker">Add recurring</p>
          </div>
          <div class="form-fields">
            <div class="field-group">
              <label class="field-label">Type</label>
              <ion-select v-model="subscriptionDirection" class="styled-select">
                <ion-select-option value="expense">Payment</ion-select-option>
                <ion-select-option value="income">Income</ion-select-option>
              </ion-select>
            </div>
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
            <div class="field-group">
              <label class="field-label">{{ subscriptionDirection === 'income' ? 'Deposited to' : 'Paid from' }}</label>
              <ion-select v-model="subscriptionAccountId" class="styled-select" placeholder="Select account" :disabled="!accounts.length">
                <ion-select-option :value="null">No account</ion-select-option>
                <ion-select-option v-for="account in accounts" :key="account.id" :value="account.id">
                  {{ account.name }}
                </ion-select-option>
              </ion-select>
            </div>
          </div>
          <ion-button expand="block" class="add-btn" @click="saveSubscription">Add recurring</ion-button>
        </ion-card>

        <ion-card class="finance-card">
          <div class="card-topline">
            <p class="section-kicker">Recurring</p>
            <span class="card-count">{{ subscriptions.length }} active</span>
          </div>
          <div v-if="subscriptions.length" class="item-list">
            <div v-for="subscription in subscriptions" :key="subscription.id" class="list-item" :class="{ 'list-item--due-soon': isDueSoon(subscription.next_due_date), 'list-item--overdue': isOverdue(subscription.next_due_date) }">
              <div class="list-item__info">
                <div class="list-item__name-row">
                  <strong class="list-item__name">{{ subscription.name }}</strong>
                  <span v-if="isOverdue(subscription.next_due_date)" class="due-badge due-badge--overdue">Overdue</span>
                  <span v-else-if="isDueSoon(subscription.next_due_date)" class="due-badge due-badge--soon">Due soon</span>
                </div>
                <span class="list-item__meta">{{ subscription.cadence }} · due {{ subscription.next_due_date || 'TBD' }}<template v-if="subscription.account_name"> · {{ subscription.direction === 'income' ? 'to' : 'from' }} {{ subscription.account_name }}</template></span>
              </div>
              <span class="list-item__value" :class="{ 'list-item__value--income': subscription.direction === 'income' }">
                {{ subscription.direction === 'income' ? '+' : '' }}{{ formatCurrency(Number(subscription.amount) || 0) }}
              </span>
            </div>
          </div>
          <p v-else class="empty-state">No recurring items yet.</p>
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
import { addFinanceSubscription, getFinanceSubscriptions, getFinanceAccounts } from '@/shared/db/app_db';
import { formatCurrency } from '@/shared/utils/currency';
import { scheduleSubscriptionReminders } from '@/shared/utils/notifications';
import { getNotifSubscriptionEnabled, getNotifSubscriptionDaysBefore } from '@/shared/utils/userSettings';

const subscriptionName = ref('');
const subscriptionAmount = ref('');
const subscriptionCadence = ref('monthly');
const subscriptionNextDue = ref('');
const subscriptionAccountId = ref<number | null>(null);
const subscriptionDirection = ref<'expense' | 'income'>('expense');
const subscriptions = ref<Array<Record<string, any>>>([]);
const accounts = ref<Array<Record<string, any>>>([]);

const loadSubscriptions = async () => {
  subscriptions.value = await getFinanceSubscriptions();
  if (getNotifSubscriptionEnabled()) {
    await scheduleSubscriptionReminders(
      subscriptions.value.map((s) => ({
        id: Number(s.id),
        name: String(s.name),
        amount: Number(s.amount),
        next_due_date: s.next_due_date ?? null,
      })),
      getNotifSubscriptionDaysBefore()
    );
  }
};

const isDueSoon = (dateStr: string | null): boolean => {
  if (!dateStr) return false;
  const days = (new Date(dateStr).getTime() - Date.now()) / 86400000;
  return days >= 0 && days <= getNotifSubscriptionDaysBefore();
};

const isOverdue = (dateStr: string | null): boolean => {
  if (!dateStr) return false;
  return new Date(dateStr).getTime() < Date.now();
};

const loadAccounts = async () => {
  accounts.value = await getFinanceAccounts();
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
  if (!Number.isFinite(amount) || amount <= 0) {
    const toast = await toastController.create({
      message: 'Enter an amount above zero.',
      duration: 2000,
      color: 'warning',
    });
    await toast.present();
    return;
  }

  try {
    await addFinanceSubscription(
      subscriptionName.value.trim(),
      amount,
      subscriptionCadence.value,
      subscriptionNextDue.value || undefined,
      subscriptionAccountId.value,
      subscriptionDirection.value
    );
  } catch {
    const toast = await toastController.create({
      message: 'Could not save subscription.',
      duration: 2000,
      color: 'warning',
    });
    await toast.present();
    return;
  }
  subscriptionName.value = '';
  subscriptionAmount.value = '';
  subscriptionNextDue.value = '';
  subscriptionAccountId.value = null;
  subscriptionDirection.value = 'expense';
  await loadSubscriptions();

  const toast = await toastController.create({
    message: 'Recurring item added.',
    duration: 1800,
    color: 'success',
  });
  await toast.present();
};

onIonViewWillEnter(async () => {
  await Promise.all([loadAccounts(), loadSubscriptions()]);
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
  color: rgba(var(--nt-ink), 0.5);
}

.card-count {
  font-size: 0.72rem;
  color: rgba(var(--nt-ink), 0.5);
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
  color: rgba(var(--nt-ink), 0.5);
}

.styled-input,
.styled-select {
  background: rgba(var(--nt-ink), 0.06);
  border: 1px solid rgba(var(--nt-ink), 0.1);
  border-radius: 8px;
  color: var(--nt-fg);
  --color: var(--nt-fg);
  --placeholder-color: rgba(var(--nt-ink), 0.35);
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
  background: rgba(var(--nt-ink), 0.05);
  border: 1px solid transparent;
}

.list-item--due-soon {
  border: 1px solid rgba(255, 215, 0, 0.35);
}

.list-item--overdue {
  border: 1px solid rgba(215, 26, 33, 0.5);
}

.list-item__info {
  display: grid;
  gap: 4px;
}

.list-item__name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.due-badge {
  font-family: var(--nt-font-head);
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border-radius: 999px;
  padding: 2px 7px;
}

.due-badge--soon {
  color: rgb(255, 215, 0);
  background: rgba(255, 215, 0, 0.12);
}

.due-badge--overdue {
  color: var(--nt-accent);
  background: rgba(215, 26, 33, 0.12);
}

.list-item__name {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--nt-fg);
}

.list-item__meta {
  font-size: 0.72rem;
  text-transform: capitalize;
  color: rgba(var(--nt-ink), 0.5);
}

.list-item__value {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--nt-fg);
  white-space: nowrap;
}

.list-item__value--income {
  color: var(--nt-data-positive);
}

.empty-state {
  margin: 0;
  color: rgba(var(--nt-ink), 0.5);
  font-size: 0.9rem;
}
</style>
