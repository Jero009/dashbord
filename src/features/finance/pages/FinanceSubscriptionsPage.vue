<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <finance-section-tabs />
    </ion-header>
    <ion-content :fullscreen="true" class="finance-content">
      <div class="finance-shell">
        <!-- Summary -->
        <ion-card class="finance-card summary-card">
          <div class="card-topline">
            <p class="section-kicker">Recurring / mo</p>
          </div>
          <div class="summary-value">{{ formatCurrency(monthlyOutflow) }}</div>
          <div class="summary-grid">
            <div class="summary-cell">
              <span>Per year</span>
              <strong>{{ formatCurrency(monthlyOutflow * 12) }}</strong>
            </div>
            <div class="summary-cell">
              <span>Income / mo</span>
              <strong class="metric-positive">{{ formatCurrency(monthlyInflow) }}</strong>
            </div>
          </div>
        </ion-card>

        <!-- Add / edit form -->
        <ion-card class="finance-card">
          <div class="card-topline">
            <p class="section-kicker">{{ editingId ? 'Edit recurring' : 'Add recurring' }}</p>
            <button v-if="editingId" class="link-btn" @click="resetForm">Cancel</button>
          </div>
          <div class="type-toggle">
            <button class="type-toggle__btn" :class="{ 'type-toggle__btn--active': subscriptionDirection === 'expense' }" @click="subscriptionDirection = 'expense'">Payment</button>
            <button class="type-toggle__btn" :class="{ 'type-toggle__btn--active': subscriptionDirection === 'income' }" @click="subscriptionDirection = 'income'">Income</button>
          </div>
          <div class="form-fields">
            <div class="field-group">
              <label class="field-label">Name</label>
              <ion-input v-model="subscriptionName" class="styled-input"></ion-input>
            </div>
            <div class="form-fields--inline">
              <div class="field-group">
                <label class="field-label">Amount</label>
                <ion-input v-model="subscriptionAmount" type="number" inputmode="decimal" class="styled-input"></ion-input>
              </div>
              <div class="field-group">
                <label class="field-label">Cadence</label>
                <ion-select v-model="subscriptionCadence" class="styled-select" interface="action-sheet">
                  <ion-select-option value="monthly">Monthly</ion-select-option>
                  <ion-select-option value="yearly">Yearly</ion-select-option>
                  <ion-select-option value="weekly">Weekly</ion-select-option>
                </ion-select>
              </div>
            </div>
            <div class="field-group">
              <label class="field-label">Next due</label>
              <ion-input v-model="subscriptionNextDue" type="date" class="styled-input"></ion-input>
            </div>
            <div class="field-group">
              <label class="field-label">{{ subscriptionDirection === 'income' ? 'Deposited to' : 'Paid from' }}</label>
              <ion-select v-model="subscriptionAccountId" class="styled-select" interface="action-sheet" placeholder="Account" :disabled="!accounts.length">
                <ion-select-option :value="null">No account</ion-select-option>
                <ion-select-option v-for="account in accounts" :key="account.id" :value="account.id">
                  {{ account.name }}
                </ion-select-option>
              </ion-select>
            </div>
          </div>
          <ion-button expand="block" class="add-btn" @click="saveSubscription">{{ editingId ? 'Save' : 'Add' }}</ion-button>
        </ion-card>

        <!-- List -->
        <ion-card class="finance-card">
          <div class="card-topline">
            <p class="section-kicker">Recurring</p>
            <span class="card-count">{{ subscriptions.length }}</span>
          </div>
          <div v-if="subscriptions.length" class="item-list">
            <div
              v-for="sub in subscriptions"
              :key="sub.id"
              class="list-item"
              :class="{
                'list-item--due-soon': isActive(sub) && isDueSoon(sub.next_due_date),
                'list-item--overdue': isActive(sub) && isOverdue(sub.next_due_date),
                'list-item--paused': !isActive(sub),
              }"
            >
              <div class="list-item__info">
                <div class="list-item__name-row">
                  <strong class="list-item__name">{{ sub.name }}</strong>
                  <span v-if="!isActive(sub)" class="due-badge due-badge--paused">Paused</span>
                  <span v-else-if="isOverdue(sub.next_due_date)" class="due-badge due-badge--overdue">Overdue</span>
                  <span v-else-if="isDueSoon(sub.next_due_date)" class="due-badge due-badge--soon">Due soon</span>
                </div>
                <span class="list-item__meta">{{ sub.cadence }} · {{ dueLabel(sub.next_due_date) }}<template v-if="sub.account_name"> · {{ sub.direction === 'income' ? 'to' : 'from' }} {{ sub.account_name }}</template></span>
              </div>
              <div class="list-item__end">
                <span class="list-item__value" :class="{ 'metric-positive': sub.direction === 'income' }">
                  {{ sub.direction === 'income' ? '+' : '' }}{{ formatCurrency(Number(sub.amount) || 0) }}
                </span>
                <button class="row-icon" :aria-label="isActive(sub) ? 'Pause' : 'Resume'" @click="toggleStatus(sub)">
                  <ion-icon :icon="isActive(sub) ? pauseOutline : playOutline" />
                </button>
                <button class="row-icon" aria-label="Edit" @click="beginEdit(sub)">
                  <ion-icon :icon="createOutline" />
                </button>
                <button class="row-icon" aria-label="Delete" @click="confirmDelete(sub)">
                  <ion-icon :icon="trashOutline" />
                </button>
              </div>
            </div>
          </div>
          <p v-else class="empty-state">No recurring items</p>
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
  IonIcon,
  onIonViewWillEnter,
  toastController,
  alertController,
} from '@ionic/vue';
import { createOutline, trashOutline, pauseOutline, playOutline } from 'ionicons/icons';
import { computed, ref } from 'vue';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import FinanceSectionTabs from '@/features/finance/components/FinanceSectionTabs.vue';
import {
  addFinanceSubscription,
  updateFinanceSubscription,
  deleteFinanceSubscription,
  setFinanceSubscriptionStatus,
  getFinanceSubscriptions,
  getFinanceAccounts,
} from '@/shared/db/app_db';
import { formatCurrency } from '@/shared/utils/currency';
import { hapticMedium, hapticHeavy, hapticSuccess, hapticLight } from '@/shared/utils/haptics';
import {
  subscriptionsMonthlyOutflow,
  subscriptionsMonthlyInflow,
  dueLabel,
  type SubscriptionRow,
} from '@/features/finance/finance';
import { scheduleSubscriptionReminders } from '@/shared/utils/notifications';
import { getNotifSubscriptionEnabled, getNotifSubscriptionDaysBefore } from '@/shared/utils/userSettings';

const subscriptionName = ref('');
const subscriptionAmount = ref('');
const subscriptionCadence = ref('monthly');
const subscriptionNextDue = ref('');
const subscriptionAccountId = ref<number | null>(null);
const subscriptionDirection = ref<'expense' | 'income'>('expense');
const editingId = ref<number | null>(null);

const subscriptions = ref<SubscriptionRow[]>([]);
const accounts = ref<Array<Record<string, any>>>([]);

const monthlyOutflow = computed(() => subscriptionsMonthlyOutflow(subscriptions.value));
const monthlyInflow = computed(() => subscriptionsMonthlyInflow(subscriptions.value));

const isActive = (sub: SubscriptionRow): boolean => String(sub.status ?? 'active') === 'active';

const isDueSoon = (dateStr: string | null): boolean => {
  if (!dateStr) return false;
  const days = (new Date(dateStr).getTime() - Date.now()) / 86400000;
  return days >= 0 && days <= getNotifSubscriptionDaysBefore();
};

const isOverdue = (dateStr: string | null): boolean => {
  if (!dateStr) return false;
  return new Date(dateStr).getTime() < Date.now();
};

const loadSubscriptions = async () => {
  subscriptions.value = await getFinanceSubscriptions();
  if (getNotifSubscriptionEnabled()) {
    // Pass the full list (incl. paused/income) so the scheduler can shed their
    // stale reminders; it internally schedules only active expense items.
    await scheduleSubscriptionReminders(
      subscriptions.value.map((s) => ({
        id: Number(s.id),
        name: String(s.name),
        amount: Number(s.amount),
        next_due_date: s.next_due_date ?? null,
        status: String(s.status ?? 'active'),
        direction: String(s.direction ?? 'expense'),
      })),
      getNotifSubscriptionDaysBefore()
    );
  }
};

const loadAccounts = async () => {
  accounts.value = await getFinanceAccounts();
};

const showToast = async (message: string, color: 'warning' | 'success') => {
  const toast = await toastController.create({ message, duration: 1800, color });
  await toast.present();
};

const resetForm = () => {
  editingId.value = null;
  subscriptionName.value = '';
  subscriptionAmount.value = '';
  subscriptionCadence.value = 'monthly';
  subscriptionNextDue.value = '';
  subscriptionAccountId.value = null;
  subscriptionDirection.value = 'expense';
};

const beginEdit = (sub: SubscriptionRow) => {
  hapticMedium();
  editingId.value = Number(sub.id);
  subscriptionName.value = String(sub.name ?? '');
  subscriptionAmount.value = String(sub.amount ?? '');
  subscriptionCadence.value = String(sub.cadence ?? 'monthly');
  subscriptionNextDue.value = sub.next_due_date ? String(sub.next_due_date) : '';
  subscriptionAccountId.value = sub.account_id != null ? Number(sub.account_id) : null;
  subscriptionDirection.value = sub.direction === 'income' ? 'income' : 'expense';
};

const saveSubscription = async () => {
  if (!subscriptionName.value.trim()) {
    await showToast('name required', 'warning');
    return;
  }
  const amount = Number(subscriptionAmount.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    await showToast('amount required', 'warning');
    return;
  }

  hapticMedium();
  try {
    if (editingId.value) {
      await updateFinanceSubscription(
        editingId.value,
        subscriptionName.value.trim(),
        amount,
        subscriptionCadence.value,
        subscriptionNextDue.value || null,
        subscriptionAccountId.value,
        subscriptionDirection.value
      );
    } else {
      await addFinanceSubscription(
        subscriptionName.value.trim(),
        amount,
        subscriptionCadence.value,
        subscriptionNextDue.value || undefined,
        subscriptionAccountId.value,
        subscriptionDirection.value
      );
    }
  } catch {
    await showToast('save failed', 'warning');
    return;
  }
  resetForm();
  await loadSubscriptions();
  hapticSuccess();
  await showToast('saved', 'success');
};

const toggleStatus = async (sub: SubscriptionRow) => {
  hapticLight();
  try {
    await setFinanceSubscriptionStatus(Number(sub.id), isActive(sub) ? 'paused' : 'active');
  } catch {
    await showToast('update failed', 'warning');
    return;
  }
  await loadSubscriptions();
};

const confirmDelete = async (sub: SubscriptionRow) => {
  const alert = await alertController.create({
    header: 'Delete recurring item',
    message: `Remove "${sub.name}"?`,
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Delete',
        role: 'destructive',
        handler: async () => {
          hapticHeavy();
          try {
            await deleteFinanceSubscription(Number(sub.id));
          } catch {
            await showToast('delete failed', 'warning');
            return;
          }
          if (editingId.value === Number(sub.id)) resetForm();
          await loadSubscriptions();
        },
      },
    ],
  });
  await alert.present();
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

.summary-card {
  gap: 14px;
}

.summary-value {
  font-family: var(--nt-font-display);
  font-size: 2.4rem;
  font-weight: 700;
  color: var(--nt-fg);
  line-height: 1;
}

.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.summary-cell {
  border-radius: 10px;
  padding: 12px 14px;
  background: rgba(var(--nt-ink), 0.05);
  display: grid;
  gap: 6px;
}

.summary-cell span {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(var(--nt-ink), 0.5);
}

.summary-cell strong {
  font-family: var(--nt-font-mono);
  font-size: 0.95rem;
  color: var(--nt-fg);
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

.metric-positive {
  color: var(--nt-data-positive);
}

.link-btn {
  background: none;
  border: none;
  color: rgba(var(--nt-ink), 0.6);
  font-family: var(--nt-font-head);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.type-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  background: rgba(var(--nt-ink), 0.05);
  border-radius: var(--nt-radius-pill);
  padding: 4px;
}

.type-toggle__btn {
  border: none;
  background: transparent;
  border-radius: var(--nt-radius-pill);
  padding: 8px 0;
  font-family: var(--nt-font-head);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: var(--nt-tracking-label);
  color: rgba(var(--nt-ink), 0.5);
}

.type-toggle__btn--active {
  background: var(--nt-surface-2);
  color: var(--nt-fg);
}

.form-fields {
  display: grid;
  gap: 10px;
}

.form-fields--inline {
  display: grid;
  grid-template-columns: 1fr 1fr;
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
  color-scheme: var(--nt-color-scheme);
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
  border-color: rgba(255, 215, 0, 0.35);
}

.list-item--overdue {
  border-color: rgba(215, 26, 33, 0.5);
}

.list-item--paused {
  opacity: 0.55;
}

.list-item__info {
  display: grid;
  gap: 4px;
  min-width: 0;
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

.due-badge--paused {
  color: rgba(var(--nt-ink), 0.6);
  background: rgba(var(--nt-ink), 0.08);
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

.list-item__end {
  display: flex;
  align-items: center;
  gap: 8px;
}

.list-item__value {
  font-family: var(--nt-font-mono);
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--nt-fg);
  white-space: nowrap;
}

.row-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: var(--nt-radius-pill);
  border: none;
  background: rgba(var(--nt-ink), 0.05);
  color: rgba(var(--nt-ink), 0.6);
  font-size: 0.95rem;
}

.empty-state {
  margin: 0;
  color: rgba(var(--nt-ink), 0.5);
  font-size: 0.9rem;
}
</style>
