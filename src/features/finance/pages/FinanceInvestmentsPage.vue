<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <finance-section-tabs />
    </ion-header>
    <ion-content :fullscreen="true" class="finance-content">
      <div class="finance-shell">
        <!-- Portfolio summary -->
        <ion-card class="finance-card summary-card">
          <div class="card-topline">
            <p class="section-kicker">Portfolio value</p>
          </div>
          <div class="summary-value">{{ formatCurrency(totalValue) }}</div>
          <div class="summary-grid">
            <div class="summary-cell">
              <span>Invested</span>
              <strong>{{ formatCurrency(totalCost) }}</strong>
            </div>
            <div class="summary-cell">
              <span>Gain / loss</span>
              <strong :class="gainClass">
                {{ totalGain >= 0 ? '+' : '−' }}{{ formatCurrency(Math.abs(totalGain)) }}
                <template v-if="totalCost > 0"> ({{ totalGainPct >= 0 ? '+' : '−' }}{{ Math.abs(totalGainPct).toFixed(1) }}%)</template>
              </strong>
            </div>
          </div>
        </ion-card>

        <!-- Add / edit form -->
        <ion-card class="finance-card">
          <div class="card-topline">
            <p class="section-kicker">{{ editingId ? 'Edit investment' : 'Add investment' }}</p>
            <button v-if="editingId" class="link-btn" @click="resetForm">Cancel</button>
          </div>
          <div class="form-fields">
            <div class="field-group">
              <label class="field-label">Name</label>
              <ion-input v-model="investmentName" class="styled-input"></ion-input>
            </div>
            <div class="form-fields--inline">
              <div class="field-group">
                <label class="field-label">Type</label>
                <ion-select v-model="investmentType" class="styled-select" interface="action-sheet">
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
            </div>
            <div class="field-group">
              <label class="field-label">Ticker / symbol</label>
              <ion-input v-model="investmentSymbol" class="styled-input" :placeholder="symbolPlaceholder" autocapitalize="characters"></ion-input>
              <span class="field-hint">{{ investmentSymbol.trim() ? 'Value auto-updates from live prices' : 'Optional — enables live price tracking' }}</span>
            </div>
            <div class="form-fields--inline">
              <div class="field-group">
                <label class="field-label">Cost basis</label>
                <ion-input v-model="investmentCost" type="number" inputmode="decimal" class="styled-input" placeholder="Invested"></ion-input>
              </div>
              <div class="field-group">
                <label class="field-label">Current value</label>
                <ion-input v-model="investmentValue" type="number" inputmode="decimal" class="styled-input"></ion-input>
              </div>
            </div>
            <div class="field-group">
              <label class="field-label">Funded from</label>
              <ion-select v-model="investmentAccountId" class="styled-select" interface="action-sheet" placeholder="Account" :disabled="!accounts.length">
                <ion-select-option :value="null">No account</ion-select-option>
                <ion-select-option v-for="account in accounts" :key="account.id" :value="account.id">
                  {{ account.name }}
                </ion-select-option>
              </ion-select>
            </div>
          </div>
          <ion-button expand="block" class="add-btn" @click="saveInvestment">{{ editingId ? 'Save' : 'Add' }}</ion-button>
        </ion-card>

        <!-- Holdings -->
        <ion-card class="finance-card">
          <div class="card-topline">
            <p class="section-kicker">Holdings</p>
            <button v-if="hasSymbols" class="refresh-btn" :disabled="refreshing" @click="refreshPrices(false)">
              <ion-icon :icon="refreshOutline" :class="{ spinning: refreshing }" />
              {{ refreshing ? 'Updating' : 'Refresh' }}
            </button>
            <span v-else class="card-count">{{ investments.length }}</span>
          </div>
          <p v-if="lastUpdated" class="updated-line">Live prices · updated {{ lastUpdated }}</p>
          <div v-if="investments.length" class="item-list">
            <div v-for="inv in holdingRows" :key="inv.id" class="list-item">
              <div class="list-item__info">
                <div class="list-item__name-row">
                  <strong class="list-item__name">{{ inv.name }}</strong>
                  <span v-if="inv.symbol" class="ticker">{{ inv.symbol }}</span>
                  <span v-if="inv.changePct !== null" class="day-chip" :class="inv.changePct >= 0 ? 'metric-positive' : 'metric-negative'">
                    {{ inv.changePct >= 0 ? '+' : '−' }}{{ Math.abs(inv.changePct).toFixed(2) }}%
                  </span>
                </div>
                <span class="list-item__meta">
                  {{ inv.type }} · {{ inv.quantity }} units<template v-if="inv.unitPrice"> @ {{ formatCurrency(inv.unitPrice) }}</template><template v-if="inv.account_name"> · {{ inv.account_name }}</template>
                </span>
              </div>
              <div class="list-item__end">
                <div class="list-item__figs">
                  <span class="list-item__value">{{ formatCurrency(inv.value) }}</span>
                  <span v-if="inv.cost > 0" class="list-item__gain" :class="inv.gain >= 0 ? 'metric-positive' : 'metric-negative'">
                    {{ inv.gain >= 0 ? '+' : '−' }}{{ Math.abs(inv.gainPct).toFixed(1) }}%
                  </span>
                </div>
                <button class="row-icon" aria-label="Edit investment" @click="beginEdit(inv.raw)">
                  <ion-icon :icon="createOutline" />
                </button>
                <button class="row-icon" aria-label="Delete investment" @click="confirmDelete(inv.raw)">
                  <ion-icon :icon="trashOutline" />
                </button>
              </div>
            </div>
          </div>
          <p v-else class="empty-state">No investments</p>
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
import { createOutline, trashOutline, refreshOutline } from 'ionicons/icons';
import { computed, ref } from 'vue';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import FinanceSectionTabs from '@/features/finance/components/FinanceSectionTabs.vue';
import {
  addFinanceInvestment,
  updateFinanceInvestment,
  deleteFinanceInvestment,
  updateInvestmentPrice,
  getFinanceInvestments,
  getFinanceAccounts,
} from '@/shared/db/app_db';
import { formatCurrency } from '@/shared/utils/currency';
import { hapticMedium, hapticHeavy, hapticSuccess, hapticLight } from '@/shared/utils/haptics';
import { investmentsTotal, investmentsCostBasis } from '@/features/finance/finance';
import { fetchInvestmentPrices, type PriceQuote } from '@/features/finance/prices';

const investmentName = ref('');
const investmentType = ref('stock');
const investmentQuantity = ref('');
const investmentCost = ref('');
const investmentValue = ref('');
const investmentSymbol = ref('');
const investmentAccountId = ref<number | null>(null);
const editingId = ref<number | null>(null);

const investments = ref<Array<Record<string, any>>>([]);
const accounts = ref<Array<Record<string, any>>>([]);

// 24h change % keyed by holding id, populated by the last live-price refresh.
const dayChange = ref<Map<number, number | null>>(new Map());
const refreshing = ref(false);
const lastUpdated = ref('');
// Throttle auto (silent) refreshes so navigating in/out doesn't hammer the free
// price APIs (rate-limited). Manual refresh always runs.
let lastRefreshAt = 0;
const AUTO_REFRESH_COOLDOWN_MS = 120000;

const hasSymbols = computed(() => investments.value.some((i) => String(i.symbol ?? '').trim()));

const symbolPlaceholder = computed(() =>
  investmentType.value === 'crypto' ? 'BTC, ETH, SOL…' : 'AAPL, MSFT, VOO…'
);

const totalValue = computed(() => investmentsTotal(investments.value));
const totalCost = computed(() => investmentsCostBasis(investments.value));
const totalGain = computed(() => totalValue.value - totalCost.value);
const totalGainPct = computed(() => (totalCost.value > 0 ? (totalGain.value / totalCost.value) * 100 : 0));
const gainClass = computed(() => (totalGain.value >= 0 ? 'metric-positive' : 'metric-negative'));

const holdingRows = computed(() =>
  investments.value.map((i) => {
    const id = Number(i.id);
    const value = Number(i.value) || 0;
    const cost = Number(i.cost_basis) || 0;
    const gain = value - cost;
    const qty = Number(i.quantity) || 0;
    const unitPrice = Number(i.last_price) || (qty > 0 ? value / qty : 0);
    const change = dayChange.value.get(id);
    return {
      id,
      name: String(i.name),
      type: String(i.type),
      quantity: i.quantity,
      symbol: i.symbol ? String(i.symbol).toUpperCase() : '',
      account_name: i.account_name,
      value,
      cost,
      gain,
      gainPct: cost > 0 ? (gain / cost) * 100 : 0,
      unitPrice,
      changePct: change === undefined ? null : change,
      raw: i,
    };
  })
);

const loadAll = async () => {
  const [inv, acc] = await Promise.all([
    getFinanceInvestments().catch(() => []),
    getFinanceAccounts().catch(() => []),
  ]);
  investments.value = inv;
  accounts.value = acc;
  // Auto-refresh quietly on entry when any holding has a symbol, so values feel live.
  if (hasSymbols.value) refreshPrices(true);
};

const refreshPrices = async (silent: boolean) => {
  if (refreshing.value) return;
  // Skip auto-refresh if we fetched recently; a manual tap always goes through.
  if (silent && Date.now() - lastRefreshAt < AUTO_REFRESH_COOLDOWN_MS) return;
  const priceable = investments.value
    .filter((i) => String(i.symbol ?? '').trim())
    .map((i) => ({ id: Number(i.id), type: String(i.type), symbol: String(i.symbol) }));
  if (!priceable.length) return;

  refreshing.value = true;
  lastRefreshAt = Date.now();
  if (!silent) hapticLight();
  let quotes: Map<number, PriceQuote>;
  try {
    quotes = await fetchInvestmentPrices(priceable);
  } catch {
    refreshing.value = false;
    if (!silent) await showToast('price fetch failed', 'warning');
    return;
  }

  if (quotes.size === 0) {
    refreshing.value = false;
    if (!silent) await showToast('no prices found', 'warning');
    return;
  }

  const nextChange = new Map<number, number | null>();
  for (const inv of investments.value) {
    const id = Number(inv.id);
    const quote = quotes.get(id);
    if (!quote) continue;
    const qty = Number(inv.quantity) || 0;
    const value = qty * quote.price;
    nextChange.set(id, quote.changePct);
    try {
      await updateInvestmentPrice(id, value, quote.price);
    } catch {
      /* keep going; one failed write shouldn't abort the batch */
    }
  }
  dayChange.value = nextChange;
  lastUpdated.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  investments.value = await getFinanceInvestments().catch(() => investments.value);
  refreshing.value = false;
  if (!silent) {
    hapticSuccess();
    await showToast(`updated ${quotes.size} price${quotes.size === 1 ? '' : 's'}`, 'success');
  }
};

const showToast = async (message: string, color: 'warning' | 'success') => {
  const toast = await toastController.create({ message, duration: 1800, color });
  await toast.present();
};

const resetForm = () => {
  editingId.value = null;
  investmentName.value = '';
  investmentType.value = 'stock';
  investmentQuantity.value = '';
  investmentCost.value = '';
  investmentValue.value = '';
  investmentSymbol.value = '';
  investmentAccountId.value = null;
};

const beginEdit = (inv: Record<string, any>) => {
  hapticMedium();
  editingId.value = Number(inv.id);
  investmentName.value = String(inv.name ?? '');
  investmentType.value = String(inv.type ?? 'stock');
  investmentQuantity.value = String(inv.quantity ?? '');
  investmentCost.value = String(inv.cost_basis ?? '');
  investmentValue.value = String(inv.value ?? '');
  investmentSymbol.value = inv.symbol ? String(inv.symbol) : '';
  investmentAccountId.value = inv.account_id != null ? Number(inv.account_id) : null;
};

const saveInvestment = async () => {
  if (!investmentName.value.trim()) {
    await showToast('name required', 'warning');
    return;
  }
  const quantity = Number(investmentQuantity.value);
  const value = Number(investmentValue.value);
  const cost = Number(investmentCost.value || 0);
  const symbol = investmentSymbol.value.trim() || null;
  if (!Number.isFinite(quantity) || !Number.isFinite(value) || quantity < 0 || value < 0) {
    await showToast('invalid amount', 'warning');
    return;
  }
  if (!symbol && value <= 0) {
    await showToast('add a value or a ticker', 'warning');
    return;
  }

  hapticMedium();
  try {
    if (editingId.value) {
      await updateFinanceInvestment(
        editingId.value,
        investmentName.value.trim(),
        investmentType.value,
        quantity,
        value,
        investmentAccountId.value,
        Number.isFinite(cost) ? cost : 0,
        symbol
      );
    } else {
      await addFinanceInvestment(
        investmentName.value.trim(),
        investmentType.value,
        quantity,
        value,
        investmentAccountId.value,
        Number.isFinite(cost) ? cost : 0,
        symbol
      );
    }
  } catch {
    await showToast('save failed', 'warning');
    return;
  }
  resetForm();
  // loadAll auto-refreshes live prices when any holding has a ticker, so a
  // newly-added symbol's value populates without an extra call here.
  await loadAll();
  hapticSuccess();
  await showToast('saved', 'success');
};

const confirmDelete = async (inv: Record<string, any>) => {
  const alert = await alertController.create({
    header: 'Delete investment',
    message: `Remove "${inv.name}"?`,
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Delete',
        role: 'destructive',
        handler: async () => {
          hapticHeavy();
          try {
            await deleteFinanceInvestment(Number(inv.id));
          } catch {
            await showToast('delete failed', 'warning');
            return;
          }
          if (editingId.value === Number(inv.id)) resetForm();
          await loadAll();
        },
      },
    ],
  });
  await alert.present();
};

onIonViewWillEnter(loadAll);
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
  min-width: 0;
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

.list-item__figs {
  display: grid;
  gap: 3px;
  justify-items: end;
}

.list-item__value {
  font-family: var(--nt-font-mono);
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--nt-fg);
  white-space: nowrap;
}

.list-item__gain {
  font-family: var(--nt-font-mono);
  font-size: 0.72rem;
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

.field-hint {
  font-size: 0.68rem;
  color: rgba(var(--nt-ink), 0.4);
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: rgba(var(--nt-ink), 0.06);
  border: none;
  border-radius: var(--nt-radius-pill);
  padding: 5px 12px;
  color: rgba(var(--nt-ink), 0.85);
  font-family: var(--nt-font-head);
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.refresh-btn:disabled {
  opacity: 0.6;
}

.refresh-btn ion-icon {
  font-size: 0.9rem;
}

.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.updated-line {
  margin: -8px 0 0;
  font-size: 0.68rem;
  color: rgba(var(--nt-ink), 0.4);
}

.list-item__name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.ticker {
  font-family: var(--nt-font-mono);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: rgba(var(--nt-ink), 0.6);
  background: rgba(var(--nt-ink), 0.08);
  border-radius: 4px;
  padding: 1px 5px;
}

.day-chip {
  font-family: var(--nt-font-mono);
  font-size: 0.66rem;
  font-weight: 600;
}

.empty-state {
  margin: 0;
  color: rgba(var(--nt-ink), 0.5);
  font-size: 0.9rem;
}
</style>
