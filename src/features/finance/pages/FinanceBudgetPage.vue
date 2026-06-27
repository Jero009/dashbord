<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <finance-section-tabs />
    </ion-header>
    <ion-content :fullscreen="true" class="finance-content">
      <div class="finance-shell">
        <ion-card class="finance-card flow-card">
          <div class="card-topline">
            <p class="section-kicker">Cash flow</p>
            <div class="month-nav">
              <button class="month-btn" @click="shiftMonth(-1)" aria-label="Previous month">
                <ion-icon :icon="chevronBackOutline" />
              </button>
              <span class="month-label">{{ monthLabel }}</span>
              <button class="month-btn" :disabled="isCurrentMonth" @click="shiftMonth(1)" aria-label="Next month">
                <ion-icon :icon="chevronForwardOutline" />
              </button>
            </div>
          </div>
          <div class="flow-hero">
            <span class="flow-hero__label">Left to spend</span>
            <span class="flow-hero__value" :class="{ 'flow-hero__value--over': leftToSpend < 0 }">
              {{ formatCurrency(leftToSpend) }}
            </span>
          </div>
          <div class="card-metrics">
            <div class="card-metric">
              <span>Income</span>
              <strong>{{ formatCurrency(incomeTotal) }}</strong>
            </div>
            <div class="card-metric">
              <span>Spent</span>
              <strong>{{ formatCurrency(expenseTotal) }}</strong>
            </div>
            <div class="card-metric">
              <span>Net</span>
              <strong :class="{ 'metric-negative': netFlow < 0, 'metric-positive': netFlow > 0 }">
                {{ formatCurrency(netFlow) }}
              </strong>
            </div>
            <div class="card-metric">
              <span>Budgeted</span>
              <strong>{{ formatCurrency(budgetTotal) }}</strong>
            </div>
          </div>
        </ion-card>

        <ion-card class="finance-card">
          <div class="card-topline">
            <p class="section-kicker">Budgets</p>
            <span class="card-count">{{ budgets.length }} categories</span>
          </div>
          <div v-if="budgetRows.length" class="budget-list">
            <div v-for="row in budgetRows" :key="row.id" class="budget-row">
              <div class="budget-row__head">
                <strong class="budget-row__name">{{ categoryLabel(row.category) }}</strong>
                <span class="budget-row__figures">
                  <span :class="{ 'budget-over-text': row.over }">{{ formatCurrency(row.spent) }}</span>
                  <span class="budget-row__limit"> / {{ formatCurrency(row.limit) }}</span>
                </span>
              </div>
              <div class="budget-bar">
                <div
                  class="budget-bar__fill"
                  :class="{ 'budget-bar__fill--over': row.over, 'budget-bar__fill--warn': !row.over && row.ratio >= 0.85 }"
                  :style="{ width: `${Math.min(row.ratio, 1) * 100}%` }"
                />
              </div>
              <div class="budget-row__foot">
                <span v-if="row.over" class="budget-over-text">{{ formatCurrency(row.spent - row.limit) }} over</span>
                <span v-else>{{ formatCurrency(row.limit - row.spent) }} left</span>
                <button class="row-delete" aria-label="Remove budget" @click="removeBudget(row.id)">
                  <ion-icon :icon="closeOutline" />
                </button>
              </div>
            </div>
          </div>
          <p v-else class="empty-state">No budgets yet.</p>

          <div class="form-fields form-fields--inline">
            <div class="field-group">
              <label class="field-label">Category</label>
              <ion-select v-model="budgetCategory" class="styled-select" interface="popover">
                <ion-select-option v-for="cat in expenseCategories" :key="cat.value" :value="cat.value">
                  {{ cat.label }}
                </ion-select-option>
              </ion-select>
            </div>
            <div class="field-group">
              <label class="field-label">Monthly limit</label>
              <ion-input v-model="budgetLimit" type="number" inputmode="decimal" class="styled-input"></ion-input>
            </div>
          </div>
          <ion-button expand="block" class="outline-btn" @click="saveBudget">Set budget</ion-button>
        </ion-card>

        <ion-card class="finance-card">
          <div class="card-topline">
            <p class="section-kicker">Add transaction</p>
          </div>
          <div class="type-toggle">
            <button
              class="type-toggle__btn"
              :class="{ 'type-toggle__btn--active': transactionType === 'expense' }"
              @click="setType('expense')"
            >Expense</button>
            <button
              class="type-toggle__btn"
              :class="{ 'type-toggle__btn--active': transactionType === 'income' }"
              @click="setType('income')"
            >Income</button>
          </div>
          <div class="form-fields">
            <div class="field-group">
              <label class="field-label">Name</label>
              <ion-input v-model="transactionName" class="styled-input"></ion-input>
            </div>
            <div class="form-fields--inline">
              <div class="field-group">
                <label class="field-label">Amount</label>
                <ion-input v-model="transactionAmount" type="number" inputmode="decimal" class="styled-input"></ion-input>
              </div>
              <div class="field-group">
                <label class="field-label">Date</label>
                <ion-input v-model="transactionDate" type="date" class="styled-input"></ion-input>
              </div>
            </div>
            <div v-if="transactionType === 'expense'" class="field-group">
              <label class="field-label">Category</label>
              <ion-select v-model="transactionCategory" class="styled-select" interface="popover">
                <ion-select-option v-for="cat in expenseCategories" :key="cat.value" :value="cat.value">
                  {{ cat.label }}
                </ion-select-option>
              </ion-select>
            </div>
          </div>
          <ion-button expand="block" class="add-btn" @click="saveTransaction">Add transaction</ion-button>
        </ion-card>

        <ion-card class="finance-card">
          <div class="card-topline">
            <p class="section-kicker">Transactions</p>
            <span class="card-count">{{ transactions.length }} this month</span>
          </div>
          <div v-if="transactions.length" class="item-list">
            <div v-for="transaction in transactions" :key="transaction.id" class="list-item">
              <div class="list-item__info">
                <strong class="list-item__name">{{ transaction.name }}</strong>
                <span class="list-item__meta">
                  {{ transaction.type === 'income' ? 'Income' : categoryLabel(transaction.category) }} · {{ formatDay(transaction.date) }}
                </span>
              </div>
              <div class="list-item__end">
                <span class="list-item__value" :class="{ 'metric-positive': transaction.type === 'income' }">
                  {{ transaction.type === 'income' ? '+' : '−' }}{{ formatCurrency(Number(transaction.amount) || 0) }}
                </span>
                <button class="row-delete" aria-label="Delete transaction" @click="removeTransaction(transaction.id)">
                  <ion-icon :icon="closeOutline" />
                </button>
              </div>
            </div>
          </div>
          <p v-else class="empty-state">No transactions logged for {{ monthLabel }}.</p>
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
} from '@ionic/vue';
import { chevronBackOutline, chevronForwardOutline, closeOutline } from 'ionicons/icons';
import { computed, ref } from 'vue';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import FinanceSectionTabs from '@/features/finance/components/FinanceSectionTabs.vue';
import { hapticLight, hapticMedium, hapticHeavy, hapticSuccess } from '@/shared/utils/haptics';
import { formatCurrency } from '@/shared/utils/currency';
import {
  addFinanceTransaction,
  getFinanceTransactionsForMonth,
  deleteFinanceTransaction,
  upsertFinanceBudget,
  getFinanceBudgets,
  deleteFinanceBudget,
} from '@/shared/db/app_db';

const expenseCategories = [
  { value: 'food', label: 'Food & Drink' },
  { value: 'groceries', label: 'Groceries' },
  { value: 'transport', label: 'Transport' },
  { value: 'housing', label: 'Housing' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'health', label: 'Health & Fitness' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'education', label: 'Education' },
  { value: 'other', label: 'Other' },
];

const categoryLabel = (value: string) =>
  expenseCategories.find((cat) => cat.value === value)?.label ?? 'Other';

// Local-date keys: toISOString would shift the month near midnight in UTC+ timezones.
const toLocalDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const viewedMonth = ref(toLocalDateKey(new Date()).slice(0, 7));

const monthLabel = computed(() => {
  const [year, month] = viewedMonth.value.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
});

const isCurrentMonth = computed(() => viewedMonth.value === toLocalDateKey(new Date()).slice(0, 7));

const transactions = ref<Array<Record<string, any>>>([]);
const budgets = ref<Array<Record<string, any>>>([]);

const transactionName = ref('');
const transactionAmount = ref('');
const transactionDate = ref(toLocalDateKey(new Date()));
const transactionCategory = ref('food');
const transactionType = ref<'expense' | 'income'>('expense');

const budgetCategory = ref('food');
const budgetLimit = ref('');

const formatDay = (date: string) => {
  const [year, month, day] = String(date).split('-').map(Number);
  if (!year || !month || !day) return date;
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const expenseTotal = computed(() =>
  transactions.value
    .filter((t) => t.type !== 'income')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
);

const incomeTotal = computed(() =>
  transactions.value
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
);

const netFlow = computed(() => incomeTotal.value - expenseTotal.value);

const budgetTotal = computed(() =>
  budgets.value.reduce((sum, b) => sum + (Number(b.monthly_limit) || 0), 0)
);

const leftToSpend = computed(() => budgetTotal.value - expenseTotal.value);

const spentByCategory = computed(() => {
  const totals: Record<string, number> = {};
  for (const t of transactions.value) {
    if (t.type === 'income') continue;
    const key = String(t.category || 'other');
    totals[key] = (totals[key] ?? 0) + (Number(t.amount) || 0);
  }
  return totals;
});

const budgetRows = computed(() =>
  budgets.value.map((b) => {
    const limit = Number(b.monthly_limit) || 0;
    const spent = spentByCategory.value[String(b.category)] ?? 0;
    const ratio = limit > 0 ? spent / limit : spent > 0 ? 1 : 0;
    return { id: Number(b.id), category: String(b.category), limit, spent, ratio, over: spent > limit };
  })
);

const loadBudgetData = async () => {
  transactions.value = await getFinanceTransactionsForMonth(viewedMonth.value);
  budgets.value = await getFinanceBudgets();
};

const shiftMonth = async (delta: number) => {
  hapticLight();
  const [year, month] = viewedMonth.value.split('-').map(Number);
  const next = new Date(year, month - 1 + delta, 1);
  viewedMonth.value = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
  transactions.value = await getFinanceTransactionsForMonth(viewedMonth.value);
};

const setType = (type: 'expense' | 'income') => {
  hapticLight();
  transactionType.value = type;
};

const showToast = async (message: string, color: 'warning' | 'success') => {
  const toast = await toastController.create({ message, duration: 1800, color });
  await toast.present();
};

const saveTransaction = async () => {
  if (!transactionName.value.trim()) {
    await showToast('name required', 'warning');
    return;
  }
  const amount = Number(transactionAmount.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    await showToast('invalid amount', 'warning');
    return;
  }
  if (!transactionDate.value) {
    await showToast('date required', 'warning');
    return;
  }

  hapticMedium();
  try {
    await addFinanceTransaction(
      transactionDate.value,
      transactionName.value.trim(),
      transactionType.value === 'income' ? 'income' : transactionCategory.value,
      amount,
      transactionType.value
    );
  } catch {
    await showToast('save failed', 'warning');
    return;
  }
  transactionName.value = '';
  transactionAmount.value = '';
  await loadBudgetData();
  hapticSuccess();
  await showToast('added', 'success');
};

const removeTransaction = async (id: number) => {
  hapticHeavy();
  try {
    await deleteFinanceTransaction(Number(id));
  } catch {
    await showToast('delete failed', 'warning');
    return;
  }
  await loadBudgetData();
};

const saveBudget = async () => {
  const limit = Number(budgetLimit.value);
  if (!Number.isFinite(limit) || limit <= 0) {
    await showToast('invalid limit', 'warning');
    return;
  }

  hapticMedium();
  try {
    await upsertFinanceBudget(budgetCategory.value, limit);
  } catch {
    await showToast('save failed', 'warning');
    return;
  }
  budgetLimit.value = '';
  await loadBudgetData();
  hapticSuccess();
  await showToast('saved', 'success');
};

const removeBudget = async (id: number) => {
  hapticHeavy();
  try {
    await deleteFinanceBudget(Number(id));
  } catch {
    await showToast('delete failed', 'warning');
    return;
  }
  await loadBudgetData();
};

onIonViewWillEnter(async () => {
  await loadBudgetData();
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
  color: var(--nt-text-dim);
}

.card-count {
  font-size: 0.72rem;
  color: var(--nt-text-dim);
}

.month-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.month-label {
  font-family: var(--nt-font-head);
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: var(--nt-tracking-label);
  color: rgba(var(--nt-ink), 0.85);
  min-width: 110px;
  text-align: center;
}

.month-btn {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: var(--nt-radius-pill);
  background: rgba(var(--nt-ink), 0.05);
  border: none;
  color: rgba(var(--nt-ink), 0.85);
  font-size: 1rem;
}

.month-btn:disabled {
  opacity: 0.3;
}

.flow-hero {
  display: grid;
  gap: 6px;
}

.flow-hero__label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--nt-text-dim);
}

.flow-hero__value {
  font-family: var(--nt-font-display);
  font-size: 3rem;
  font-weight: 700;
  color: var(--nt-fg);
  line-height: 1;
}

.flow-hero__value--over {
  color: var(--ion-color-accent-red);
}

.card-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.card-metric {
  border-radius: 10px;
  padding: 12px 14px;
  background: rgba(var(--nt-ink), 0.05);
}

.card-metric span {
  display: block;
  margin-bottom: 6px;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--nt-text-dim);
}

.card-metric strong {
  display: block;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--nt-fg);
}

.metric-negative {
  color: var(--ion-color-accent-red);
}

.metric-positive {
  color: var(--nt-data-positive);
}

.budget-list {
  display: grid;
  gap: 12px;
}

.budget-row {
  border-radius: 10px;
  padding: 12px 14px;
  background: rgba(var(--nt-ink), 0.05);
  display: grid;
  gap: 8px;
}

.budget-row__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}

.budget-row__name {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--nt-fg);
}

.budget-row__figures {
  font-family: var(--nt-font-mono);
  font-size: 0.82rem;
  color: rgba(var(--nt-ink), 0.85);
  white-space: nowrap;
}

.budget-row__limit {
  color: var(--nt-text-dim);
}

.budget-bar {
  height: 6px;
  border-radius: var(--nt-radius-pill);
  background: rgba(var(--nt-ink), 0.08);
  overflow: hidden;
}

.budget-bar__fill {
  height: 100%;
  border-radius: var(--nt-radius-pill);
  background: rgba(var(--nt-ink), 0.85);
  transition: width var(--nt-dur-std) var(--nt-ease-std);
}

.budget-bar__fill--warn {
  background: rgba(var(--nt-ink), 0.5);
}

.budget-bar__fill--over {
  background: var(--ion-color-accent-red);
}

.budget-row__foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.72rem;
  color: var(--nt-text-dim);
}

.budget-over-text {
  color: var(--ion-color-accent-red);
  font-weight: 600;
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
  color: var(--nt-text-dim);
  transition: background var(--nt-dur-micro) var(--nt-ease-decel), color var(--nt-dur-micro) var(--nt-ease-decel);
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
  color: var(--nt-text-dim);
}

.styled-input,
.styled-select {
  background: rgba(var(--nt-ink), 0.06);
  border: 1px solid rgba(var(--nt-ink), 0.1);
  border-radius: var(--nt-radius-sm);
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
  border-color: var(--ion-color-accent-red);
}

.add-btn {
  --background: var(--ion-color-accent-red);
  --background-activated: var(--nt-accent-press);
  --border-radius: 8px;
  --box-shadow: none;
  font-weight: 600;
  margin: 0;
}

.outline-btn {
  --background: transparent;
  --background-activated: var(--nt-surface-2);
  --border-radius: 8px;
  --box-shadow: none;
  --color: rgba(var(--nt-ink), 0.85);
  --border-color: var(--nt-border-strong);
  --border-style: solid;
  --border-width: 1px;
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
}

.list-item__info {
  display: grid;
  gap: 6px;
}

.list-item__name {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--nt-fg);
}

.list-item__meta {
  font-size: 0.72rem;
  color: var(--nt-text-dim);
}

.list-item__end {
  display: flex;
  align-items: center;
  gap: 10px;
}

.list-item__value {
  font-family: var(--nt-font-mono);
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--nt-fg);
  white-space: nowrap;
}

.row-delete {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: var(--nt-radius-pill);
  border: none;
  background: rgba(var(--nt-ink), 0.05);
  color: var(--nt-text-dim);
  font-size: 0.9rem;
}

.empty-state {
  margin: 0;
  color: var(--nt-text-dim);
  font-size: 0.9rem;
}

@media (min-width: 600px) {
  .card-metrics {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
