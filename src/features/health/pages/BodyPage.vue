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
            <button class="photo-btn" @click="pickPhoto">
              <template v-if="form.photoPreview">
                <img :src="form.photoPreview" class="photo-btn__thumb" />
                <span class="photo-btn__label">Change photo</span>
              </template>
              <span v-else class="photo-btn__label">+ Add progress photo</span>
            </button>
          </div>
          <button class="save-btn" @click="saveEntry">Save</button>
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
import { ref, computed } from 'vue'
import { IonPage, IonHeader, IonContent, onIonViewWillEnter, toastController } from '@ionic/vue'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { FilePicker } from '@capawesome/capacitor-file-picker'
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue'
import HealthSectionTabs from '@/features/health/components/HealthSectionTabs.vue'
import { insertBodyLog, getBodyLogs, deleteBodyLog } from '@/shared/db/app_db'
import type { BodyLogEntry } from '@/shared/db/app_db'

const entries = ref<BodyLogEntry[]>([])
const photoUrls = ref<Record<number, string>>({})
const viewingPhoto = ref<string | null>(null)

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
  for (const entry of entries.value) {
    if (!entry.photo_path) continue
    try {
      const file = await Filesystem.readFile({ path: entry.photo_path, directory: Directory.Data })
      const mime = entry.photo_path.endsWith('.png') ? 'image/png' : 'image/jpeg'
      photoUrls.value[entry.id] = `data:${mime};base64,${file.data}`
    } catch {
      // file missing on disk, skip thumbnail
    }
  }
}

const pickPhoto = async () => {
  try {
    const result = await FilePicker.pickFiles({ types: ['image/jpeg', 'image/png'], readData: true, limit: 1 })
    const file = result.files?.[0]
    if (!file?.data) return
    form.value.photoBase64 = file.data as string
    form.value.photoMime = file.mimeType ?? 'image/jpeg'
    form.value.photoPreview = `data:${form.value.photoMime};base64,${file.data}`
  } catch {
    // user cancelled
  }
}

const saveEntry = async () => {
  const weight = parseFloat(form.value.weight)
  if (!weight || weight <= 0) {
    const t = await toastController.create({ message: 'Enter a valid weight.', duration: 1800, color: 'warning' })
    await t.present()
    return
  }

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

  form.value.weight = ''
  form.value.notes = ''
  form.value.photoBase64 = ''
  form.value.photoMime = ''
  form.value.photoPreview = ''
  form.value.date = new Date().toISOString().slice(0, 10)

  await loadEntries()
}

const removeEntry = async (entry: BodyLogEntry) => {
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

/* Photo picker button */
.photo-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px dashed rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
}

.photo-btn__label {
  font-size: 0.88rem;
  color: rgba(255, 255, 255, 0.5);
}

.photo-btn__thumb {
  width: 44px;
  height: 44px;
  object-fit: cover;
  border-radius: 6px;
  flex-shrink: 0;
}

.save-btn {
  width: 100%;
  padding: 11px;
  background: rgb(239, 68, 68);
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
.trend-value--up   { color: rgb(239, 68, 68); }

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
