<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
    </ion-header>
    <ion-content class="settings-content">
      <div class="settings-shell">

        <!-- HEALTH TARGETS -->
        <div class="card">
          <p class="section-kicker">Health Targets</p>
          <div class="fields">
            <div class="field-group">
              <label class="field-label">Sleep goal (hours)</label>
              <input
                v-model.number="sleepGoal"
                type="number"
                step="0.5"
                min="4"
                max="14"
                class="form-input"
              />
            </div>
            <div class="field-group">
              <label class="field-label">Daily step goal</label>
              <input
                v-model.number="stepGoal"
                type="number"
                step="500"
                min="1000"
                max="30000"
                class="form-input"
              />
            </div>
            <div class="field-group">
              <label class="field-label">Goal weight (kg)</label>
              <input
                v-model="goalWeight"
                type="number"
                step="0.1"
                min="30"
                max="300"
                class="form-input"
              />
            </div>
          </div>
          <button class="btn-primary" @click="saveTargets">Save targets</button>
        </div>

        <!-- HEALTH CONNECT SYNC -->
        <div class="card">
          <p class="section-kicker">Health Connect</p>
          <button class="btn-primary" :disabled="syncing" @click="syncNow">
            {{ syncing ? 'Syncing...' : 'Sync now' }}
          </button>
          <p v-if="lastSyncTime" class="hint-text">Last sync: {{ lastSyncTime }}</p>
        </div>

        <!-- DATA -->
        <div class="card">
          <p class="section-kicker">Data</p>
          <button v-if="!alreadyImported" class="btn-secondary" @click="importHistory">
            Import history from Better Weight (452 entries)
          </button>
          <p v-else class="hint-text">Body weight history imported.</p>
        </div>

        <!-- GOALS -->
        <div class="card">
          <p class="section-kicker">Goals</p>
          <button class="btn-secondary" @click="goToGoals">Manage goals</button>
        </div>

        <!-- GYM -->
        <div class="card">
          <p class="section-kicker">Gym</p>
          <div class="field-row">
            <label class="field-label">Weekly workout goal</label>
            <ion-select
              v-model="weeklyWorkoutGoal"
              interface="action-sheet"
              :interface-options="{ cssClass: 'app-action-sheet' }"
              class="settings-select"
            >
              <ion-select-option v-for="goal in weeklyGoalOptions" :key="goal" :value="goal">
                {{ goal }} / week
              </ion-select-option>
            </ion-select>
          </div>
        </div>

        <!-- NOTIFICATIONS -->
        <div class="card">
          <p class="section-kicker">Notifications</p>
          <button class="save-btn notif-perm-btn" @click="requestPermission">Allow notifications</button>

          <!-- Weight -->
          <div class="notif-row">
            <div class="notif-row__label">
              <span class="notif-title">Weight reminder</span>
              <span class="notif-sub">Daily log reminder</span>
            </div>
            <div class="notif-row__controls">
              <input v-if="notifWeightEnabled" v-model="notifWeightTime" type="time" class="form-input form-input--time notif-time" @change="saveNotifWeight" />
              <label class="notif-toggle">
                <input type="checkbox" v-model="notifWeightEnabled" @change="saveNotifWeight" />
                <span class="notif-toggle__track"></span>
              </label>
            </div>
          </div>

          <!-- Habit -->
          <div class="notif-row">
            <div class="notif-row__label">
              <span class="notif-title">Habit reminder</span>
              <span class="notif-sub">Incomplete habits</span>
            </div>
            <div class="notif-row__controls">
              <input v-if="notifHabitEnabled" v-model="notifHabitTime" type="time" class="form-input form-input--time notif-time" @change="saveNotifHabit" />
              <label class="notif-toggle">
                <input type="checkbox" v-model="notifHabitEnabled" @change="saveNotifHabit" />
                <span class="notif-toggle__track"></span>
              </label>
            </div>
          </div>

          <!-- Sleep -->
          <div class="notif-row">
            <div class="notif-row__label">
              <span class="notif-title">Sleep reminder</span>
              <span class="notif-sub">Wind down alert</span>
            </div>
            <div class="notif-row__controls">
              <input v-if="notifSleepEnabled" v-model="notifSleepTime" type="time" class="form-input form-input--time notif-time" @change="saveNotifSleep" />
              <label class="notif-toggle">
                <input type="checkbox" v-model="notifSleepEnabled" @change="saveNotifSleep" />
                <span class="notif-toggle__track"></span>
              </label>
            </div>
          </div>

          <!-- Calendar -->
          <div class="notif-row">
            <div class="notif-row__label">
              <span class="notif-title">Calendar reminder</span>
              <span class="notif-sub">Before events</span>
            </div>
            <div class="notif-row__controls">
              <select v-if="notifCalendarEnabled" v-model="notifCalendarMins" class="form-select notif-select" @change="saveNotifCalendar">
                <option :value="0">At event</option>
                <option :value="15">15 min before</option>
                <option :value="30">30 min before</option>
                <option :value="60">1 hr before</option>
              </select>
              <label class="notif-toggle">
                <input type="checkbox" v-model="notifCalendarEnabled" @change="saveNotifCalendar" />
                <span class="notif-toggle__track"></span>
              </label>
            </div>
          </div>

          <!-- Subscription -->
          <div class="notif-row">
            <div class="notif-row__label">
              <span class="notif-title">Subscription reminder</span>
              <span class="notif-sub">Before renewal</span>
            </div>
            <div class="notif-row__controls">
              <select v-if="notifSubscriptionEnabled" v-model="notifSubDays" class="form-select notif-select" @change="saveNotifSubscription">
                <option :value="1">1 day before</option>
                <option :value="3">3 days before</option>
                <option :value="7">7 days before</option>
              </select>
              <label class="notif-toggle">
                <input type="checkbox" v-model="notifSubscriptionEnabled" @change="saveNotifSubscription" />
                <span class="notif-toggle__track"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- DATABASE -->
        <div class="card">
          <p class="section-kicker">Database</p>
          <div class="db-actions">
            <button class="btn-primary" @click="handleExport">Export backup</button>
            <button class="btn-secondary" @click="triggerImport">Import backup</button>
          </div>
          <input ref="importFileInput" type="file" accept=".sql,text/plain" style="display:none" @change="handleImportFile" />
        </div>

        <div class="card">
          <p class="section-kicker">Google Drive backup</p>
          <div class="notif-row">
            <div class="notif-row__label">
              <span class="notif-title">Auto-backup daily</span>
              <span class="notif-sub">Uploads a SQL export to your Google Drive once per day</span>
            </div>
            <div class="notif-row__controls">
              <label class="notif-toggle">
                <input type="checkbox" :checked="driveEnabled" @change="toggleDriveBackup" />
                <span class="notif-toggle__track"></span>
              </label>
            </div>
          </div>
          <p v-if="lastBackupDate" class="hint-text">Last backup: {{ lastBackupDate }}</p>
          <button class="btn-primary" style="margin-top:10px" :disabled="driveBackingUp" @click="handleDriveBackupNow">
            {{ driveBackingUp ? 'Backing up...' : 'Back up now' }}
          </button>
        </div>

      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { IonPage, IonHeader, IonContent, IonSelect, IonSelectOption, toastController, alertController } from '@ionic/vue'
import { useRouter } from 'vue-router'
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue'
import { localDateISO } from '@/shared/utils/timeFormat'
import {
  getSleepGoalHours, setSleepGoalHours, getStepGoal, setStepGoal, getGoalWeightKg, setGoalWeightKg,
  getNotifWeightEnabled, setNotifWeightEnabled, getNotifWeightTime, setNotifWeightTime,
  getNotifHabitEnabled, setNotifHabitEnabled, getNotifHabitTime, setNotifHabitTime,
  getNotifSleepEnabled, setNotifSleepEnabled, getNotifSleepTime, setNotifSleepTime,
  getNotifCalendarEnabled, setNotifCalendarEnabled, getNotifCalendarMinsBefore, setNotifCalendarMinsBefore,
  getNotifSubscriptionEnabled, setNotifSubscriptionEnabled, getNotifSubscriptionDaysBefore, setNotifSubscriptionDaysBefore,
} from '@/shared/utils/userSettings'
import {
  requestNotificationPermission,
  scheduleWeightReminder, scheduleHabitReminder, scheduleSleepReminder,
  scheduleCalendarReminders, scheduleSubscriptionReminders,
} from '@/shared/utils/notifications'
import { getHabitsWithStatus, getCalendarEventsForDate, getFinanceSubscriptions } from '@/shared/db/app_db'
import { syncHealthConnectMetrics } from '@/shared/health/healthConnect'
import { getDriveBackupEnabled, setDriveBackupEnabled, getLastBackupDate, runBackupNow } from '@/shared/utils/driveBackup'
import { exportDatabaseToSQL, importDatabaseFromSQL } from '@/shared/db/app_db'
import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { FilePicker } from '@capawesome/capacitor-file-picker'

const router = useRouter()

// --- Health Targets ---
const sleepGoal = ref(getSleepGoalHours())
const stepGoal = ref(getStepGoal())
const goalWeight = ref<number | string>(getGoalWeightKg() ?? '')

const saveTargets = async () => {
  setSleepGoalHours(sleepGoal.value)
  setStepGoal(stepGoal.value)
  if (goalWeight.value !== '' && Number(goalWeight.value) > 0) {
    setGoalWeightKg(Number(goalWeight.value))
  }
  const t = await toastController.create({ message: 'Saved', duration: 1500, color: 'success' })
  await t.present()
}

// --- Sync ---
const syncing = ref(false)
const lastSyncTime = ref<string | null>(null)

const syncNow = async () => {
  syncing.value = true
  try {
    const result = await syncHealthConnectMetrics()
    lastSyncTime.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const msg = result.available && result.granted
      ? `Synced ${result.synced} records`
      : result.available
        ? 'Health Connect permission not granted'
        : 'Health Connect not available'
    const color = result.available && result.granted ? 'success' : 'warning'
    const t = await toastController.create({ message: msg, duration: 2000, color })
    await t.present()
  } catch {
    const t = await toastController.create({ message: 'Sync failed', duration: 2000, color: 'danger' })
    await t.present()
  } finally {
    syncing.value = false
  }
}

// --- Import history ---
const IMPORT_KEY = 'body_history_imported_v1'
const alreadyImported = ref(localStorage.getItem(IMPORT_KEY) === '1')

const importHistory = () => {
  localStorage.setItem(IMPORT_KEY, '1')
  alreadyImported.value = true
}

// --- Google Drive backup ---
const driveEnabled   = ref(getDriveBackupEnabled())
const driveBackingUp = ref(false)
const lastBackupDate = ref(getLastBackupDate())

const toggleDriveBackup = (e: Event) => {
  const enabled = (e.target as HTMLInputElement).checked
  setDriveBackupEnabled(enabled)
  driveEnabled.value = enabled
}

const handleDriveBackupNow = async () => {
  driveBackingUp.value = true
  try {
    await runBackupNow()
    lastBackupDate.value = getLastBackupDate()
    const t = await toastController.create({ message: 'Backed up to Google Drive.', duration: 2000, color: 'success' })
    await t.present()
  } catch (err) {
    const t = await toastController.create({ message: err instanceof Error ? err.message : 'Backup failed.', duration: 2500, color: 'danger' })
    await t.present()
  } finally {
    driveBackingUp.value = false
  }
}

// --- Goals ---
const goToGoals = () => router.push('/health/planner')

// --- Gym: weekly workout goal ---
const WEEKLY_GOAL_STORAGE_KEY = 'homeWeeklyGoal'
const weeklyGoalOptions = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12]
const weeklyWorkoutGoal = ref(4)

onMounted(() => {
  const savedGoal = Number(localStorage.getItem(WEEKLY_GOAL_STORAGE_KEY))
  weeklyWorkoutGoal.value = Number.isFinite(savedGoal) && savedGoal > 0 ? savedGoal : 4
})

watch(weeklyWorkoutGoal, (goal) => {
  localStorage.setItem(WEEKLY_GOAL_STORAGE_KEY, String(goal))
})

// --- Notifications ---
const notifWeightEnabled = ref(getNotifWeightEnabled())
const notifWeightTime = ref(getNotifWeightTime())
const notifHabitEnabled = ref(getNotifHabitEnabled())
const notifHabitTime = ref(getNotifHabitTime())
const notifSleepEnabled = ref(getNotifSleepEnabled())
const notifSleepTime = ref(getNotifSleepTime())
const notifCalendarEnabled = ref(getNotifCalendarEnabled())
const notifCalendarMins = ref(getNotifCalendarMinsBefore())
const notifSubscriptionEnabled = ref(getNotifSubscriptionEnabled())
const notifSubDays = ref(getNotifSubscriptionDaysBefore())

const requestPermission = async () => {
  const granted = await requestNotificationPermission()
  const t = await toastController.create({
    message: granted ? 'Notifications allowed' : 'Permission denied or not available',
    duration: 2000,
    color: granted ? 'success' : 'warning',
  })
  await t.present()
}

const saveNotifWeight = async () => {
  setNotifWeightEnabled(notifWeightEnabled.value)
  setNotifWeightTime(notifWeightTime.value)
  if (notifWeightEnabled.value) await scheduleWeightReminder(notifWeightTime.value)
}

const saveNotifHabit = async () => {
  setNotifHabitEnabled(notifHabitEnabled.value)
  setNotifHabitTime(notifHabitTime.value)
  if (notifHabitEnabled.value) {
    const today = localDateISO()
    const habits = await getHabitsWithStatus(today)
    const incomplete = habits.filter((h: any) => h.completed !== 1).map((h: any) => h.name as string)
    await scheduleHabitReminder(notifHabitTime.value, incomplete)
  }
}

const saveNotifSleep = async () => {
  setNotifSleepEnabled(notifSleepEnabled.value)
  setNotifSleepTime(notifSleepTime.value)
  if (notifSleepEnabled.value) await scheduleSleepReminder(notifSleepTime.value)
}

const saveNotifCalendar = async () => {
  setNotifCalendarEnabled(notifCalendarEnabled.value)
  setNotifCalendarMinsBefore(notifCalendarMins.value)
  if (notifCalendarEnabled.value) {
    const today = localDateISO()
    const events = await getCalendarEventsForDate(today)
    await scheduleCalendarReminders(events, notifCalendarMins.value)
  }
}

const saveNotifSubscription = async () => {
  setNotifSubscriptionEnabled(notifSubscriptionEnabled.value)
  setNotifSubscriptionDaysBefore(notifSubDays.value)
  if (notifSubscriptionEnabled.value) {
    const subs = await getFinanceSubscriptions()
    await scheduleSubscriptionReminders(subs, notifSubDays.value)
  }
}

// --- Database: export / import ---
const importFileInput = ref<HTMLInputElement | null>(null)

const showToast = async (message: string, color: string = 'danger', duration: number = 2000) => {
  const toast = await toastController.create({ message, duration, position: 'top', color })
  await toast.present()
}

const handleExport = async () => {
  const backup = await exportDatabaseToSQL()

  if (!backup) {
    showToast('Database not initialized yet', 'warning')
    return
  }

  try {
    if (Capacitor.getPlatform() === 'web') {
      const blob = new Blob([backup.sql], { type: 'application/sql' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = backup.fileName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } else {
      const writeResult = await Filesystem.writeFile({
        path: backup.fileName,
        data: backup.sql,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true
      })

      await Share.share({
        title: 'SQL Backup',
        text: 'Workout backup file',
        url: writeResult.uri,
        dialogTitle: 'Share SQL Backup'
      })
    }

    showToast(`Backup ready: ${backup.fileName}`, 'success', 3000)
  } catch (error) {
    console.error('Export failed:', error)
    showToast('Export failed. Please try again.', 'danger')
  }
}

const triggerImport = () => {
  if (Capacitor.getPlatform() === 'web') {
    importFileInput.value?.click()
    return
  }

  void pickNativeImportFile()
}

const parseBase64Text = (base64Data: string) => {
  try {
    return decodeURIComponent(
      atob(base64Data)
        .split('')
        .map((char) => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join('')
    )
  } catch {
    return atob(base64Data)
  }
}

const runImportWithConfirm = async (sqlContent: string) => {
  const confirmAlert = await alertController.create({
    header: 'Import SQL Backup?',
    message: 'Importing will replace your current data with the file content.',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Import',
        handler: async () => {
          try {
            const result = await importDatabaseFromSQL(sqlContent)

            if (result.success) {
              showToast('Import successful!', 'success', 3000)
            } else {
              showToast(`Import failed: ${result.message}`, 'danger')
            }
          } catch (error) {
            console.error('Import error:', error)
            showToast('Import failed. Please try again.', 'danger')
          }
        }
      }
    ]
  })

  await confirmAlert.present()
}

const pickNativeImportFile = async () => {
  try {
    const result = await FilePicker.pickFiles({
      types: ['application/sql', 'text/plain', 'text/x-sql'],
      readData: true
    })

    const pickedFile = result.files?.[0]
    const data = pickedFile?.data

    if (!data) {
      const alert = await alertController.create({
        header: 'Import Failed',
        message: 'Could not read file content from selected file.',
        buttons: ['OK']
      })
      await alert.present()
      return
    }

    const sqlContent = parseBase64Text(data)
    await runImportWithConfirm(sqlContent)
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
    const isCancel = message.includes('cancel')

    if (isCancel) return

    const alert = await alertController.create({
      header: 'Import Failed',
      message: 'Unable to open file picker. Please try again.',
      buttons: ['OK']
    })
    await alert.present()
  }
}

const handleImportFile = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  const sqlContent = await file.text()
  await runImportWithConfirm(sqlContent)
  target.value = ''
}
</script>

<style scoped>
.settings-content {
  --background: #000;
}

.settings-shell {
  padding: 16px;
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 24px;
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

.fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
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
  padding: 10px 12px;
  color: #fff;
  font-size: 0.9rem;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 150ms ease;
}

.form-input:focus {
  border-color: rgb(239, 68, 68);
}

.form-input::placeholder {
  color: rgba(255, 255, 255, 0.35);
}

.btn-primary {
  width: 100%;
  padding: 12px;
  background: rgb(239, 68, 68);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 150ms ease;
}

.btn-primary:hover {
  background: rgb(220, 38, 38);
}

.btn-primary:disabled {
  opacity: 0.4;
  cursor: default;
}

.btn-secondary {
  width: 100%;
  padding: 12px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 150ms ease;
}

.btn-secondary:hover {
  border-color: rgba(255, 255, 255, 0.12);
}

.hint-text {
  margin: 10px 0 0;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.5);
}

.field-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.settings-select {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #fff;
  min-width: 140px;
  --color: #fff;
  --placeholder-color: rgba(255, 255, 255, 0.35);
}

.db-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.notif-perm-btn {
  width: 100%;
  padding: 12px;
  margin-bottom: 16px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 150ms ease;
}

.notif-perm-btn:hover {
  border-color: rgba(255, 255, 255, 0.12);
}

.notif-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.notif-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.notif-row__label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.notif-title {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 400;
}

.notif-sub {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.5);
}

.notif-row__controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.notif-time {
  width: 90px;
  padding: 6px 10px;
  font-size: 0.9rem;
  color-scheme: dark;
}

.form-select {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #fff;
  outline: none;
}

.notif-select {
  padding: 6px 10px;
  font-size: 0.9rem;
  max-width: 120px;
}

/* Toggle switch */
.notif-toggle {
  position: relative;
  display: inline-block;
  width: 42px;
  height: 24px;
  cursor: pointer;
}

.notif-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.notif-toggle__track {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  transition: background-color 150ms ease;
}

.notif-toggle__track::after {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.5);
  top: 3px;
  left: 3px;
  transition: background-color 150ms ease;
}

.notif-toggle input:checked + .notif-toggle__track {
  background: var(--ion-color-accent-red);
}

.notif-toggle input:checked + .notif-toggle__track::after {
  transform: translateX(18px);
  background: #fff;
}
</style>
