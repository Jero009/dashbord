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
            <p class="section-kicker">Net worth</p>
          </div>
          <div class="summary-value">{{ formatCurrency(netWorth) }}</div>
          <div class="summary-grid">
            <div class="summary-cell">
              <span>Assets</span>
              <strong>{{ formatCurrency(assetsTotal) }}</strong>
            </div>
            <div class="summary-cell">
              <span>Liabilities</span>
              <strong class="metric-negative">{{ formatCurrency(liabilitiesTotal) }}</strong>
            </div>
          </div>
        </ion-card>

        <!-- Add / edit form -->
        <ion-card class="finance-card">
          <div class="card-topline">
            <p class="section-kicker">{{ editingId ? 'Edit account' : 'Add account' }}</p>
            <button v-if="editingId" class="link-btn" @click="resetForm">Cancel</button>
          </div>
          <div class="form-fields">
            <div class="field-group">
              <label class="field-label">Name</label>
              <ion-input v-model="accountName" class="styled-input"></ion-input>
            </div>
            <div class="form-fields--inline">
              <div class="field-group">
                <label class="field-label">Type</label>
                <ion-select v-model="accountType" class="styled-select" interface="action-sheet">
                  <ion-select-option value="cash">Cash</ion-select-option>
                  <ion-select-option value="bank">Bank</ion-select-option>
                  <ion-select-option value="credit">Credit</ion-select-option>
                  <ion-select-option value="loan">Loan</ion-select-option>
                </ion-select>
              </div>
              <div class="field-group">
                <label class="field-label">{{ isLiability ? 'Owed' : 'Balance' }}</label>
                <ion-input v-model="accountBalance" type="number" inputmode="decimal" class="styled-input"></ion-input>
              </div>
            </div>
            <div class="field-group">
              <label class="field-label">Institution</label>
              <ion-input v-model="accountInstitution" class="styled-input"></ion-input>
            </div>
          </div>
          <ion-button expand="block" class="add-btn" @click="saveAccount">{{ editingId ? 'Save' : 'Add' }}</ion-button>
        </ion-card>

        <!-- Assets -->
        <ion-card v-if="assetAccounts.length" class="finance-card">
          <div class="card-topline">
            <p class="section-kicker">Assets</p>
            <span class="card-count">{{ formatCurrency(assetsTotal) }}</span>
          </div>
          <div class="account-list">
            <div v-for="account in assetAccounts" :key="account.id" class="account-item">
              <div class="account-item__info">
                <strong class="account-item__name">{{ account.name }}</strong>
                <span class="account-item__meta">{{ account.type }}<template v-if="account.institution"> · {{ account.institution }}</template></span>
              </div>
              <div class="account-item__end">
                <span class="account-item__balance">{{ formatCurrency(Number(account.balance) || 0) }}</span>
                <button class="row-icon" aria-label="Edit account" @click="beginEdit(account)">
                  <ion-icon :icon="createOutline" />
                </button>
                <button class="row-icon" aria-label="Delete account" @click="confirmDelete(account)">
                  <ion-icon :icon="trashOutline" />
                </button>
              </div>
            </div>
          </div>
        </ion-card>

        <!-- Liabilities -->
        <ion-card v-if="liabilityAccounts.length" class="finance-card">
          <div class="card-topline">
            <p class="section-kicker">Liabilities</p>
            <span class="card-count metric-negative">{{ formatCurrency(liabilitiesTotal) }}</span>
          </div>
          <div class="account-list">
            <div v-for="account in liabilityAccounts" :key="account.id" class="account-item">
              <div class="account-item__info">
                <strong class="account-item__name">{{ account.name }}</strong>
                <span class="account-item__meta">{{ account.type }}<template v-if="account.institution"> · {{ account.institution }}</template></span>
              </div>
              <div class="account-item__end">
                <span class="account-item__balance metric-negative">−{{ formatCurrency(Number(account.balance) || 0) }}</span>
                <button class="row-icon" aria-label="Edit account" @click="beginEdit(account)">
                  <ion-icon :icon="createOutline" />
                </button>
                <button class="row-icon" aria-label="Delete account" @click="confirmDelete(account)">
                  <ion-icon :icon="trashOutline" />
                </button>
              </div>
            </div>
          </div>
        </ion-card>

        <ion-card v-if="!accounts.length" class="finance-card">
          <p class="empty-state">No accounts yet</p>
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
import { createOutline, trashOutline } from 'ionicons/icons';
import { computed, ref } from 'vue';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import FinanceSectionTabs from '@/features/finance/components/FinanceSectionTabs.vue';
import {
  addFinanceAccount,
  updateFinanceAccount,
  deleteFinanceAccount,
  getFinanceAccounts,
  getFinanceInvestments,
} from '@/shared/db/app_db';
import { formatCurrency } from '@/shared/utils/currency';
import { hapticMedium, hapticHeavy, hapticSuccess } from '@/shared/utils/haptics';
import {
  isLiabilityAccount,
  accountAssetsTotal,
  accountLiabilitiesTotal,
  computeNetWorth,
  LIABILITY_ACCOUNT_TYPES,
} from '@/features/finance/finance';

const accountName = ref('');
const accountType = ref('cash');
const accountInstitution = ref('');
const accountBalance = ref('');
const editingId = ref<number | null>(null);

const accounts = ref<Array<Record<string, any>>>([]);
const investments = ref<Array<Record<string, any>>>([]);

const isLiability = computed(() => LIABILITY_ACCOUNT_TYPES.includes(accountType.value));
const assetAccounts = computed(() => accounts.value.filter((a) => !isLiabilityAccount(a)));
const liabilityAccounts = computed(() => accounts.value.filter((a) => isLiabilityAccount(a)));
const assetsTotal = computed(() => accountAssetsTotal(accounts.value));
const liabilitiesTotal = computed(() => accountLiabilitiesTotal(accounts.value));
const netWorth = computed(() => computeNetWorth(accounts.value, investments.value));

const loadAccounts = async () => {
  const [acc, inv] = await Promise.all([
    getFinanceAccounts().catch(() => []),
    getFinanceInvestments().catch(() => []),
  ]);
  accounts.value = acc;
  investments.value = inv;
};

const showToast = async (message: string, color: 'warning' | 'success') => {
  const toast = await toastController.create({ message, duration: 1800, color });
  await toast.present();
};

const resetForm = () => {
  editingId.value = null;
  accountName.value = '';
  accountType.value = 'cash';
  accountInstitution.value = '';
  accountBalance.value = '';
};

const beginEdit = (account: Record<string, any>) => {
  hapticMedium();
  editingId.value = Number(account.id);
  accountName.value = String(account.name ?? '');
  accountType.value = String(account.type ?? 'cash');
  accountInstitution.value = String(account.institution ?? '');
  accountBalance.value = String(account.balance ?? '');
};

const saveAccount = async () => {
  if (!accountName.value.trim()) {
    await showToast('name required', 'warning');
    return;
  }
  const balance = Number(accountBalance.value);
  if (!Number.isFinite(balance)) {
    await showToast('invalid balance', 'warning');
    return;
  }

  hapticMedium();
  try {
    if (editingId.value) {
      await updateFinanceAccount(
        editingId.value,
        accountName.value.trim(),
        accountType.value,
        accountInstitution.value.trim() || null,
        balance
      );
    } else {
      await addFinanceAccount(
        accountName.value.trim(),
        accountType.value,
        accountInstitution.value.trim() || null,
        balance
      );
    }
  } catch {
    await showToast('save failed', 'warning');
    return;
  }
  resetForm();
  await loadAccounts();
  hapticSuccess();
  await showToast('saved', 'success');
};

const confirmDelete = async (account: Record<string, any>) => {
  const alert = await alertController.create({
    header: 'Delete account',
    message: `Remove "${account.name}"? Linked investments and recurring items are kept.`,
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Delete',
        role: 'destructive',
        handler: async () => {
          hapticHeavy();
          try {
            await deleteFinanceAccount(Number(account.id));
          } catch {
            await showToast('delete failed', 'warning');
            return;
          }
          if (editingId.value === Number(account.id)) resetForm();
          await loadAccounts();
        },
      },
    ],
  });
  await alert.present();
};

onIonViewWillEnter(loadAccounts);
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
  font-family: var(--nt-font-mono);
  font-size: 0.82rem;
  color: rgba(var(--nt-ink), 0.85);
}

.metric-negative {
  color: var(--ion-color-accent-red);
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
  background: rgba(var(--nt-ink), 0.05);
}

.account-item__info {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.account-item__name {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--nt-fg);
}

.account-item__meta {
  font-size: 0.72rem;
  text-transform: capitalize;
  color: rgba(var(--nt-ink), 0.5);
}

.account-item__end {
  display: flex;
  align-items: center;
  gap: 8px;
}

.account-item__balance {
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
