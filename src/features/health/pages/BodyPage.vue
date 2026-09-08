<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <health-section-tabs />
    </ion-header>
    <ion-content :fullscreen="true" class="body-content">
      <div class="body-shell">

        <!-- Log entry card -->
        <div class="card">
          <p class="section-kicker">Log weight</p>
          <div class="form-fields">
            <div class="field-row">
              <div class="field-group">
                <label class="field-label">Date</label>
                <input v-model="form.date" type="date" class="form-input form-input--date" />
              </div>
              <div class="field-group">
                <label class="field-label">Weight (kg)</label>
                <input
                  v-model="form.weight"
                  type="number"
                  step="0.1"
                  inputmode="decimal"
                  placeholder="0.0"
                  class="form-input"
                />
              </div>
            </div>
            <div class="field-row">
              <div class="field-group">
                <label class="field-label">Waist (cm)</label>
                <input v-model="form.waist" type="number" step="0.1" inputmode="decimal" placeholder="–" class="form-input" />
              </div>
              <div class="field-group">
                <label class="field-label">Chest (cm)</label>
                <input v-model="form.chest" type="number" step="0.1" inputmode="decimal" placeholder="–" class="form-input" />
              </div>
            </div>
            <div class="field-row">
              <div class="field-group">
                <label class="field-label">Hips (cm)</label>
                <input v-model="form.hips" type="number" step="0.1" inputmode="decimal" placeholder="–" class="form-input" />
              </div>
              <div class="field-group">
                <label class="field-label">Arm (cm)</label>
                <input v-model="form.arm" type="number" step="0.1" inputmode="decimal" placeholder="–" class="form-input" />
              </div>
            </div>
            <div class="field-row">
              <div class="field-group">
                <label class="field-label">Thigh (cm)</label>
                <input v-model="form.thigh" type="number" step="0.1" inputmode="decimal" placeholder="–" class="form-input" />
              </div>
              <div class="field-group">
                <label class="field-label">Body fat (%)</label>
                <input v-model="form.bodyFat" type="number" step="0.1" inputmode="decimal" placeholder="–" class="form-input" />
              </div>
            </div>
            <div class="field-group">
              <label class="field-label">Notes</label>
              <input v-model="form.notes" type="text" class="form-input" />
            </div>
          </div>
          <button class="save-btn" @click="saveEntry">Save</button>
        </div>

        <!-- Progress chart -->
        <div v-if="entries.length >= 2" class="card chart-card">
          <div class="chart-header">
            <ion-select
              v-model="chartMetric"
              interface="action-sheet"
              :interface-options="{ cssClass: 'app-action-sheet' }"
              class="app-select metric-select"
            >
              <ion-select-option v-for="m in METRICS" :key="m.key" :value="m.key">{{ m.label }}</ion-select-option>
            </ion-select>
            <div class="chart-range-btns">
              <button
                v-for="opt in ([30, 90, 180, 0] as const)"
                :key="opt"
                class="range-btn"
                :class="{ 'range-btn--active': chartRange === opt }"
                @click="chartRange = opt"
              >{{ opt === 0 ? 'All' : opt + 'd' }}</button>
            </div>
          </div>
          <div class="chart-frame chart-frame--short">
            <canvas ref="chartRef"></canvas>
          </div>
        </div>

        <!-- History -->
        <div v-if="entries.length" class="card">
          <p class="section-kicker">History</p>
          <div v-if="trendDelta !== null" class="trend-row">
            <span class="trend-label">vs previous</span>
            <span class="trend-value" :class="trendClass">{{ trendLabel }}</span>
          </div>
          <div class="entry-list">
            <div v-for="entry in entries" :key="entry.id" class="entry-row">
              <div class="entry-main">
                <div class="entry-info">
                  <span class="entry-date">{{ formatDate(entry.date) }}</span>
                  <span class="entry-weight">{{ entry.weight_kg }} kg</span>
                  <span v-if="entry.notes" class="entry-notes">{{ entry.notes }}</span>
                </div>
                <button class="delete-btn" aria-label="Delete entry" @click="removeEntry(entry)"><ion-icon :icon="close" /></button>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="card empty-card">
          <p class="empty-text">No entries yet</p>
        </div>

      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { IonPage, IonHeader, IonContent, IonIcon, IonSelect, IonSelectOption, onIonViewWillEnter, toastController } from '@ionic/vue'
import { close } from 'ionicons/icons'
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler } from 'chart.js'
Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler)
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue'
import { localDateISO, parseLocalDate } from '@/shared/utils/timeFormat'
import { chartLineDataset, chartGoalDataset, chartTooltip, chartTicks, chartGrid } from '@/shared/utils/chartStyle'
import HealthSectionTabs from '@/features/health/components/HealthSectionTabs.vue'
import { insertBodyLog, getBodyLogs, deleteBodyLog } from '@/shared/db/app_db'
import { hapticHeavy, hapticMedium, hapticSuccess } from '@/shared/utils/haptics'
import { dismissWeightReminder } from '@/shared/utils/notifications'
import type { BodyLogEntry } from '@/shared/db/app_db'
import { getGoalWeightKg } from '@/shared/utils/userSettings'

const entries = ref<BodyLogEntry[]>([])

// Chart
const chartRef = ref<HTMLCanvasElement>()
let chartInstance: Chart | null = null
const chartRange = ref<30 | 90 | 180 | 0>(90)

// Metrics the progress chart can plot. Weight is the default and the only one
// with a goal line.
const METRICS = [
  { key: 'weight_kg', label: 'Weight', unit: 'kg' },
  { key: 'body_fat_pct', label: 'Body fat', unit: '%' },
  { key: 'waist_cm', label: 'Waist', unit: 'cm' },
  { key: 'chest_cm', label: 'Chest', unit: 'cm' },
  { key: 'hips_cm', label: 'Hips', unit: 'cm' },
  { key: 'arm_cm', label: 'Arm', unit: 'cm' },
  { key: 'thigh_cm', label: 'Thigh', unit: 'cm' },
] as const
type MetricKey = typeof METRICS[number]['key']
const chartMetric = ref<MetricKey>('weight_kg')
const currentMetric = computed(() => METRICS.find(m => m.key === chartMetric.value)!)

const buildChart = () => {
  if (!chartRef.value || !entries.value.length) return
  const metric = currentMetric.value
  const goal = metric.key === 'weight_kg' ? getGoalWeightKg() : null

  const sorted = [...entries.value].reverse()
  const cutoff = chartRange.value === 0
    ? null
    : localDateISO(new Date(Date.now() - chartRange.value * 86400000))
  const ranged = cutoff ? sorted.filter(e => e.date >= cutoff) : sorted
  // Only keep entries that actually have a value for the selected metric.
  const filtered = ranged.filter(e => {
    const v = (e as Record<string, unknown>)[metric.key]
    return v != null && Number.isFinite(Number(v))
  })

  if (filtered.length < 2) {
    if (chartInstance) { chartInstance.destroy(); chartInstance = null }
    return
  }

  const labels = filtered.map(e => {
    const d = parseLocalDate(e.date)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })
  const data = filtered.map(e => Number((e as Record<string, unknown>)[metric.key]))
  const goalData = goal ? filtered.map(() => goal) : null

  if (chartInstance) chartInstance.destroy()
  const ctx = chartRef.value.getContext('2d')!
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          ...chartLineDataset,
          label: metric.label,
          data,
          pointRadius: filtered.length > 60 ? 0 : 3,
        },
        ...(goalData ? [{
          ...chartGoalDataset,
          label: 'Goal',
          data: goalData,
        }] : []),
      ]
    },
    options: {
      responsive: true,
      animation: false,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...chartTooltip,
          callbacks: { label: (ctx) => ` ${(ctx.parsed.y ?? 0).toFixed(1)} ${metric.unit}` }
        }
      },
      scales: {
        x: {
          ticks: { ...chartTicks, maxTicksLimit: 8 },
          grid: chartGrid,
        },
        y: {
          ticks: { ...chartTicks, callback: (v) => `${v} ${metric.unit}` },
          grid: chartGrid,
        }
      }
    }
  })
}

watch([chartRange, chartMetric], buildChart, { flush: 'post' })

onUnmounted(() => {
  if (chartInstance) { chartInstance.destroy(); chartInstance = null }
})

const form = ref({
  date: localDateISO(),
  weight: '',
  waist: '',
  chest: '',
  hips: '',
  arm: '',
  thigh: '',
  bodyFat: '',
  notes: '',
})

// Parse an optional measurement field: blank/invalid -> null.
const optionalNum = (v: string): number | null => {
  const n = parseFloat(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

const trendDelta = computed(() => {
  if (entries.value.length < 2) return null
  return entries.value[0].weight_kg - entries.value[1].weight_kg
})

const trendLabel = computed(() => {
  if (trendDelta.value === null) return ''
  const sign = trendDelta.value > 0 ? '+' : ''
  return `${sign}${trendDelta.value.toFixed(1)} kg`
})

const trendClass = computed(() => {
  if (trendDelta.value === null) return ''
  if (trendDelta.value < 0) return 'trend-value--down'
  if (trendDelta.value > 0) return 'trend-value--up'
  return ''
})

const formatDate = (d: string) =>
  parseLocalDate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const loadEntries = async () => {
  entries.value = await getBodyLogs()
  buildChart()
}

const saveEntry = async () => {
  hapticMedium();
  const weight = parseFloat(form.value.weight)
  if (!weight || weight <= 0) {
    const t = await toastController.create({ message: 'invalid weight', duration: 1800, color: 'warning' })
    await t.present()
    return
  }

  const existing = entries.value.find(e => e.date === form.value.date)
  if (existing) {
    const t = await toastController.create({ message: 'already logged', duration: 1800, color: 'warning' })
    await t.present()
    return
  }

  try {
    await insertBodyLog({
      date: form.value.date,
      weight_kg: weight,
      notes: form.value.notes.trim() || undefined,
      waist_cm: optionalNum(form.value.waist),
      chest_cm: optionalNum(form.value.chest),
      hips_cm: optionalNum(form.value.hips),
      arm_cm: optionalNum(form.value.arm),
      thigh_cm: optionalNum(form.value.thigh),
      body_fat_pct: optionalNum(form.value.bodyFat),
    })
    const today = localDateISO()
    if (form.value.date === today) dismissWeightReminder()

    form.value.weight = ''
    form.value.waist = ''
    form.value.chest = ''
    form.value.hips = ''
    form.value.arm = ''
    form.value.thigh = ''
    form.value.bodyFat = ''
    form.value.notes = ''
    form.value.date = localDateISO()

    await loadEntries()

    hapticSuccess();
    const t = await toastController.create({ message: 'saved', duration: 1500, color: 'success' })
    await t.present()
  } catch (err) {
    const t = await toastController.create({ message: 'save failed', duration: 2000, color: 'danger' })
    await t.present()
  }
}

const removeEntry = async (entry: BodyLogEntry) => {
  hapticHeavy();
  await deleteBodyLog(entry.id)
  await loadEntries()
}

onIonViewWillEnter(loadEntries)
</script>

<style scoped>
.body-content {
  --background: var(--nt-bg);
}

.body-shell {
  padding: 16px;
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 40px;
}

.card {
  background: var(--ion-color-primary);
  border-radius: var(--nt-radius-md);
  padding: 18px;
}

.section-kicker {
  margin: 0 0 14px;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: rgba(var(--nt-ink), 0.5);
}

/* Form */
.form-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
}

.field-row {
  display: flex;
  gap: 10px;
}

.field-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(var(--nt-ink), 0.5);
}

.form-input {
  background: rgba(var(--nt-ink), 0.06);
  border: 1px solid rgba(var(--nt-ink), 0.1);
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--nt-fg);
  font-size: 0.9rem;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 150ms ease;
}

.form-input:focus {
  border-color: var(--ion-color-accent-red);
}

.form-input::placeholder {
  color: rgba(var(--nt-ink), 0.35);
}

.form-input--date {
  color-scheme: var(--nt-color-scheme);
}

/* Photo source row */
.save-btn {
  width: 100%;
  padding: 12px;
  background: var(--ion-color-accent-red);
  border: none;
  border-radius: 8px;
  color: var(--nt-on-accent);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 150ms ease;
}

.save-btn:hover {
  background: var(--nt-accent-press);
}

/* Trend row */
.trend-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 10px 12px;
  background: rgba(var(--nt-ink), 0.05);
  border-radius: 10px;
}

.trend-label {
  font-size: 0.75rem;
  color: rgba(var(--nt-ink), 0.5);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.trend-value {
  font-size: 0.95rem;
  font-weight: 600;
  color: rgba(var(--nt-ink), 0.85);
}

.trend-value--down { color: rgb(34, 197, 94); }
.trend-value--up   { color: var(--ion-color-accent-red); }

/* Entry list */
.entry-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.entry-row {
  background: rgba(var(--nt-ink), 0.05);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.entry-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.entry-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.entry-date {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(var(--nt-ink), 0.5);
}

.entry-weight {
  font-size: 1rem;
  font-weight: 600;
  color: var(--nt-fg);
}

.entry-notes {
  font-size: 0.72rem;
  color: rgba(var(--nt-ink), 0.5);
}

.delete-btn {
  background: none;
  border: none;
  color: rgba(var(--nt-ink), 0.25);
  line-height: 1;
  cursor: pointer;
  min-width: 40px;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.delete-btn ion-icon {
  font-size: 20px;
}

.delete-btn:hover {
  color: rgba(var(--nt-ink), 0.5);
}

/* Empty state */
.empty-card {
  text-align: center;
  padding: 24px 18px;
}

.empty-text {
  margin: 0;
  font-size: 0.9rem;
  color: rgba(var(--nt-ink), 0.5);
}

/* Chart card */
.chart-card {
  padding: 18px 18px 12px;
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.chart-header .section-kicker {
  margin: 0;
}

.metric-select {
  max-width: 150px;
  --padding-start: 8px;
  --padding-end: 8px;
  min-height: auto;
  font-family: var(--nt-font-head);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--nt-text-dim);
}

.chart-range-btns {
  display: flex;
  gap: 6px;
}

.range-btn {
  padding: 3px 10px;
  border-radius: 8px;
  border: 1px solid rgba(var(--nt-ink), 0.1);
  background: transparent;
  color: rgba(var(--nt-ink), 0.5);
  font-size: 0.72rem;
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease;
}

.range-btn--active {
  background: var(--ion-color-accent-red);
  border-color: var(--ion-color-accent-red);
  color: var(--nt-on-accent);
}

</style>
