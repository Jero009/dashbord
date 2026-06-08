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
            <div class="field-group">
              <label class="field-label">Notes</label>
              <input v-model="form.notes" type="text" placeholder="Optional" class="form-input" />
            </div>
            <div class="photo-row">
              <button class="photo-source-btn" @click="takePhoto">
                <span class="photo-btn__label">Camera</span>
              </button>
              <button class="photo-source-btn" @click="pickPhoto">
                <span class="photo-btn__label">Gallery</span>
              </button>
            </div>
            <div v-if="form.photoPreview" class="photo-preview-wrap">
              <img :src="form.photoPreview" class="photo-preview-img" />
              <button class="photo-remove-btn" @click="clearPhoto">Remove</button>
            </div>
          </div>
          <button class="save-btn" @click="saveEntry">Save</button>
        </div>

        <!-- Progress chart -->
        <div v-if="entries.length >= 2" class="card chart-card">
          <div class="chart-header">
            <p class="section-kicker">Progress</p>
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
          <div class="chart-wrap">
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
                <button class="delete-btn" @click="removeEntry(entry)">×</button>
              </div>
              <img
                v-if="photoUrls[entry.id]"
                :src="photoUrls[entry.id]"
                class="entry-photo"
                @click="viewingPhoto = photoUrls[entry.id]"
              />
            </div>
          </div>
        </div>

        <div v-else class="card empty-card">
          <p class="empty-text">No entries yet. Log your first weight above.</p>
        </div>

      </div>

      <!-- Full-screen photo viewer -->
      <div v-if="viewingPhoto" class="photo-viewer" @click="viewingPhoto = null">
        <img :src="viewingPhoto" class="photo-viewer__img" />
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { IonPage, IonHeader, IonContent, onIonViewWillEnter, toastController } from '@ionic/vue'
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler } from 'chart.js'
Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler)
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { FilePicker } from '@capawesome/capacitor-file-picker'
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue'
import HealthSectionTabs from '@/features/health/components/HealthSectionTabs.vue'
import { insertBodyLog, getBodyLogs, deleteBodyLog } from '@/shared/db/app_db'
import { hapticHeavy, hapticMedium, hapticSuccess } from '@/shared/utils/haptics'
import { dismissWeightReminder } from '@/shared/utils/notifications'
import type { BodyLogEntry } from '@/shared/db/app_db'
import { getGoalWeightKg } from '@/shared/utils/userSettings'

const entries = ref<BodyLogEntry[]>([])
const photoUrls = ref<Record<number, string>>({})
const viewingPhoto = ref<string | null>(null)

// Chart
const chartRef = ref<HTMLCanvasElement>()
let chartInstance: Chart | null = null
const chartRange = ref<30 | 90 | 180 | 0>(90)

const buildChart = () => {
  if (!chartRef.value || !entries.value.length) return
  const goal = getGoalWeightKg()

  const sorted = [...entries.value].reverse()
  const cutoff = chartRange.value === 0
    ? null
    : new Date(Date.now() - chartRange.value * 86400000).toISOString().slice(0, 10)
  const filtered = cutoff ? sorted.filter(e => e.date >= cutoff) : sorted

  if (filtered.length < 2) {
    if (chartInstance) { chartInstance.destroy(); chartInstance = null }
    return
  }

  const labels = filtered.map(e => {
    const d = new Date(e.date + 'T12:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })
  const data = filtered.map(e => e.weight_kg)
  const goalData = goal ? filtered.map(() => goal) : null

  if (chartInstance) chartInstance.destroy()
  const ctx = chartRef.value.getContext('2d')!
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Weight',
          data,
          borderColor: 'var(--ion-color-accent-red)',
          backgroundColor: 'rgba(239,68,68,0.15)',
          borderWidth: 2,
          pointRadius: filtered.length > 60 ? 0 : 3,
          pointBackgroundColor: 'var(--ion-color-accent-red)',
          tension: 0.3,
          fill: true,
        },
        ...(goalData ? [{
          label: 'Goal',
          data: goalData,
          borderColor: 'rgba(255,215,0,0.6)',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderDash: [6, 4],
          pointRadius: 0,
          tension: 0,
          fill: false,
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
          backgroundColor: 'rgba(0,0,0,0.85)',
          titleColor: 'rgba(255,255,255,0.5)',
          bodyColor: '#fff',
          padding: 10,
          callbacks: { label: (ctx) => ` ${(ctx.parsed.y ?? 0).toFixed(1)} kg` }
        }
      },
      scales: {
        x: {
          ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 }, maxTicksLimit: 8 },
          grid: { color: 'rgba(255,255,255,0.1)' },
        },
        y: {
          ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 }, callback: (v) => `${v} kg` },
          grid: { color: 'rgba(255,255,255,0.1)' },
        }
      }
    }
  })
}

watch(chartRange, buildChart, { flush: 'post' })

onUnmounted(() => {
  if (chartInstance) { chartInstance.destroy(); chartInstance = null }
})

const form = ref({
  date: new Date().toISOString().slice(0, 10),
  weight: '',
  notes: '',
  photoBase64: '',
  photoMime: '',
  photoPreview: '',
})

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
  new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const loadEntries = async () => {
  entries.value = await getBodyLogs()
  photoUrls.value = {}
  await Promise.all(entries.value.map(async (entry) => {
    if (!entry.photo_path) return
    try {
      const file = await Filesystem.readFile({ path: entry.photo_path, directory: Directory.Data })
      const mime = entry.photo_path.endsWith('.png') ? 'image/png' : 'image/jpeg'
      photoUrls.value[entry.id] = `data:${mime};base64,${file.data}`
    } catch {
      // file missing on disk, skip thumbnail
    }
  }))
  buildChart()
}

const applyPhoto = (base64: string, mime: string) => {
  form.value.photoBase64 = base64
  form.value.photoMime = mime
  form.value.photoPreview = `data:${mime};base64,${base64}`
}

const clearPhoto = () => {
  form.value.photoBase64 = ''
  form.value.photoMime = ''
  form.value.photoPreview = ''
}

const takePhoto = async () => {
  try {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
      quality: 80,
    })
    if (!photo.base64String) return
    applyPhoto(photo.base64String, photo.format === 'png' ? 'image/png' : 'image/jpeg')
  } catch {
    // user cancelled or camera unavailable
  }
}

const pickPhoto = async () => {
  try {
    const result = await FilePicker.pickFiles({ types: ['image/jpeg', 'image/png'], readData: true, limit: 1 })
    const file = result.files?.[0]
    if (!file?.data) return
    applyPhoto(file.data as string, file.mimeType ?? 'image/jpeg')
  } catch {
    // user cancelled
  }
}

const saveEntry = async () => {
  hapticMedium();
  const weight = parseFloat(form.value.weight)
  if (!weight || weight <= 0) {
    const t = await toastController.create({ message: 'Enter a valid weight.', duration: 1800, color: 'warning' })
    await t.present()
    return
  }

  const existing = entries.value.find(e => e.date === form.value.date)
  if (existing) {
    const t = await toastController.create({ message: 'Already logged for this date.', duration: 1800, color: 'warning' })
    await t.present()
    return
  }

  try {
    let photoPath: string | undefined
    if (form.value.photoBase64) {
      const ext = form.value.photoMime === 'image/png' ? 'png' : 'jpg'
      const filename = `body_photos/${Date.now()}.${ext}`
      try {
        await Filesystem.mkdir({ path: 'body_photos', directory: Directory.Data, recursive: true })
      } catch {
        // directory already exists
      }
      await Filesystem.writeFile({ path: filename, data: form.value.photoBase64, directory: Directory.Data })
      photoPath = filename
    }

    await insertBodyLog({
      date: form.value.date,
      weight_kg: weight,
      notes: form.value.notes.trim() || undefined,
      photo_path: photoPath,
    })
    const today = new Date().toISOString().slice(0, 10)
    if (form.value.date === today) dismissWeightReminder()

    form.value.weight = ''
    form.value.notes = ''
    clearPhoto()
    form.value.date = new Date().toISOString().slice(0, 10)

    await loadEntries()

    hapticSuccess();
    const t = await toastController.create({ message: 'Saved!', duration: 1500, color: 'success' })
    await t.present()
  } catch (err) {
    const t = await toastController.create({ message: 'Failed to save. Try again.', duration: 2000, color: 'danger' })
    await t.present()
  }
}

const removeEntry = async (entry: BodyLogEntry) => {
  hapticHeavy();
  if (entry.photo_path) {
    try {
      await Filesystem.deleteFile({ path: entry.photo_path, directory: Directory.Data })
    } catch {
      // file may already be missing
    }
  }
  await deleteBodyLog(entry.id)
  await loadEntries()
}

onIonViewWillEnter(loadEntries)
</script>

<style scoped>
.body-content {
  --background: #000;
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
  border-radius: 12px;
  padding: 18px;
}

.section-kicker {
  margin: 0 0 14px;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: rgba(255, 255, 255, 0.5);
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
  gap: 5px;
}

.field-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.5);
}

.form-input {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 9px 12px;
  color: #fff;
  font-size: 0.9rem;
  outline: none;
  width: 100%;
  box-sizing: border-box;
}

.form-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.form-input--date {
  color-scheme: dark;
}

/* Photo source row */
.photo-row {
  display: flex;
  gap: 10px;
}

.photo-source-btn {
  flex: 1;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px dashed rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  cursor: pointer;
  text-align: center;
}

.photo-btn__label {
  font-size: 0.88rem;
  color: rgba(255, 255, 255, 0.5);
}

.photo-preview-wrap {
  position: relative;
}

.photo-preview-img {
  width: 100%;
  max-height: 180px;
  object-fit: cover;
  border-radius: 8px;
  display: block;
}

.photo-remove-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  padding: 4px 10px;
  background: rgba(0, 0, 0, 0.6);
  border: none;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.78rem;
  cursor: pointer;
}

.save-btn {
  width: 100%;
  padding: 11px;
  background: var(--ion-color-accent-red);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

/* Trend row */
.trend-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
}

.trend-label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.trend-value {
  font-size: 0.95rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
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
  background: rgba(255, 255, 255, 0.05);
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
  gap: 8px;
}

.entry-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.entry-date {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.5);
}

.entry-weight {
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
}

.entry-notes {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.45);
}

.entry-photo {
  width: 100%;
  max-height: 220px;
  object-fit: cover;
  border-radius: 8px;
  cursor: pointer;
}

.delete-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.3);
  font-size: 1.3rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
  flex-shrink: 0;
}

.delete-btn:hover {
  color: rgba(255, 255, 255, 0.7);
}

/* Empty state */
.empty-card {
  text-align: center;
  padding: 32px 18px;
}

.empty-text {
  margin: 0;
  font-size: 0.88rem;
  color: rgba(255, 255, 255, 0.35);
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

.chart-range-btns {
  display: flex;
  gap: 4px;
}

.range-btn {
  padding: 3px 9px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: transparent;
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.72rem;
  cursor: pointer;
}

.range-btn--active {
  background: var(--ion-color-accent-red);
  border-color: var(--ion-color-accent-red);
  color: #fff;
}

.chart-wrap {
  height: 180px;
  position: relative;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  padding: 8px 4px 4px;
}

/* Full-screen photo viewer */
.photo-viewer {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  cursor: pointer;
}

.photo-viewer__img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 4px;
}
</style>
