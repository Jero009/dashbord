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
            <p class="nt-kicker">Recurring / mo</p>
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
            <p class="nt-kicker">{{ editingId ? 'Edit recurring' : 'Add recurring' }}</p>
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
                  <ion-select-option value="quarterly">Quarterly</ion-select-option>
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
            <p class="nt-kicker">Recurring</p>
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
                <button class="row-icon" aria-label="Mark paid" @click="markPaid(sub)">
                  <ion-icon :icon="checkmarkOutline" />
                </button>
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
          <p v-else class="nt-empty">No recurring items</p>
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
  alertController,
} from '@ionic/vue';
import { showToast } from '@/shared/utils/toast';
import { createOutline, trashOutline, pauseOutline, playOutline, checkmarkOutline } from 'ionicons/icons';
import { computed, ref } from 'vue';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import FinanceSectionTabs from '@/features/finance/components/FinanceSectionTabs.vue';
import {
  addFinanceSubscription,
  updateFinanceSubscription,
  deleteFinanceSubscription,
  setFinanceSubscriptionStatus,
  markSubscriptionPaid,
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

// Compare on calendar-day granularity in local time, mirroring dueLabel() so the
// "Due soon"/"Overdue" badges never contradict the relative-date label on the same row.
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const daysUntil = (dateStr: string): number | null => {
  const target = new Date(String(dateStr));
  if (!Number.isFinite(target.getTime())) return null;
  return Math.round((startOfDay(target) - startOfDay(new Date())) / 86400000);
};

const DUE_SOON_DAYS = 3;

const isDueSoon = (dateStr: string | null): boolean => {
  if (!dateStr) return false;
  const days = daysUntil(dateStr);
  return days !== null && days >= 0 && days <= DUE_SOON_DAYS;
};

const isOverdue = (dateStr: string | null): boolean => {
  if (!dateStr) return false;
  const days = daysUntil(dateStr);
  return days !== null && days < 0;
};

const loadSubscriptions = async () => {
  subscriptions.value = await getFinanceSubscriptions();
};

const loadAccounts = async () => {
  accounts.value = await getFinanceAccounts();
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

// Accept the current period as paid: logs the transaction (unless the
// auto-poster already did) and rolls the due date forward one cadence.
const markPaid = async (sub: SubscriptionRow) => {
  hapticLight();
  try {
    await markSubscriptionPaid(Number(sub.id));
  } catch {
    await showToast('update failed', 'warning');
    return;
  }
  await loadSubscriptions();
  hapticSuccess();
  await showToast(`${sub.name} marked paid`, 'success');
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
/* Shared finance primitives (.finance-content, .form-fields*, .field-*, .styled-*,
   .add-btn, .metric-*, .link-btn) live in theme/finance.css — do not re-declare
   them here; a scoped copy silently shadows the global (v3.21.1 contract). */

.type-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  background: var(--nt-tile);
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

.item-list {
  display: grid;
  gap: 10px;
}

</style>
