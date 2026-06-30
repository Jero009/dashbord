<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
    </ion-header>
    <ion-content class="settings-content">
      <div class="settings-shell">

        <!-- PREFERENCES -->
        <div class="card">
          <p class="section-kicker">Preferences</p>

          <div class="set-stack">
            <span class="set-row__title">Theme</span>
            <div class="theme-seg">
              <button
                v-for="opt in themeOptions"
                :key="opt.value"
                type="button"
                class="theme-seg__btn"
                :class="{ 'theme-seg__btn--active': themeMode === opt.value }"
                @click="selectTheme(opt.value)"
              >{{ opt.label }}</button>
            </div>
          </div>

          <div class="set-row">
            <div class="set-row__label">
              <span class="set-row__title">Currency</span>
            </div>
            <ion-select
              v-model="currency"
              interface="action-sheet"
              :interface-options="{ cssClass: 'app-action-sheet' }"
              class="settings-select"
              @ionChange="hapticSelect()"
            >
              <ion-select-option v-for="code in currencyOptions" :key="code" :value="code">
                {{ code }}
              </ion-select-option>
            </ion-select>
          </div>
        </div>

        <!-- GOALS & TARGETS -->
        <div class="card">
          <p class="section-kicker">Goals &amp; targets</p>

          <div class="set-row">
            <div class="set-row__label">
              <span class="set-row__title">Sleep goal</span>
            </div>
            <input v-model.number="sleepGoal" type="number" step="0.5" min="4" max="14" class="form-input form-input--compact" />
          </div>

          <div class="set-row">
            <div class="set-row__label">
              <span class="set-row__title">Daily steps</span>
            </div>
            <input v-model.number="stepGoal" type="number" step="500" min="1000" max="30000" class="form-input form-input--compact" />
          </div>

          <div class="set-row">
            <div class="set-row__label">
              <span class="set-row__title">Goal weight</span>
            </div>
            <input v-model="goalWeight" type="number" step="0.1" min="30" max="300" class="form-input form-input--compact" />
          </div>

          <div class="set-row">
            <div class="set-row__label">
              <span class="set-row__title">Weekly workouts</span>
            </div>
            <ion-select
              v-model="weeklyWorkoutGoal"
              interface="action-sheet"
              :interface-options="{ cssClass: 'app-action-sheet' }"
              class="settings-select"
              @ionChange="hapticSelect()"
            >
              <ion-select-option v-for="goal in weeklyGoalOptions" :key="goal" :value="goal">
                {{ goal }} / week
              </ion-select-option>
            </ion-select>
          </div>

          <button class="btn-primary set-action" @click="saveTargets">Save</button>

          <button class="nav-row" @click="goToGoals">
            <span class="set-row__title">Manage goals</span>
            <ion-icon :icon="chevronForwardOutline" class="nav-row__icon" />
          </button>
        </div>

        <!-- NOTIFICATIONS -->
        <div class="card">
          <p class="section-kicker">Notifications</p>

          <div class="set-row">
            <div class="set-row__label">
              <span class="set-row__title">System permission</span>
            </div>
            <button class="btn-chip" @click="requestPermission">Allow</button>
          </div>

          <!-- Weight -->
          <div class="notif-row">
            <div class="notif-row__label">
              <span class="notif-title">Weight reminder</span>
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

          <!-- Morning summary -->
          <div class="notif-row">
            <div class="notif-row__label">
              <span class="notif-title">Morning summary</span>
              <span class="notif-sub">Readiness + agenda</span>
            </div>
            <div class="notif-row__controls">
              <input v-if="notifMorningEnabled" v-model="notifMorningTime" type="time" class="form-input form-input--time notif-time" @change="saveNotifMorning" />
              <label class="notif-toggle">
                <input type="checkbox" v-model="notifMorningEnabled" @change="saveNotifMorning" />
                <span class="notif-toggle__track"></span>
              </label>
            </div>
          </div>

          <!-- Weekly digest -->
          <div class="notif-row">
            <div class="notif-row__label">
              <span class="notif-title">Weekly digest</span>
            </div>
            <div class="notif-row__controls">
              <select v-if="notifWeeklyEnabled" v-model.number="notifWeeklyWeekday" class="form-select notif-select" @change="saveNotifWeekly">
                <option v-for="(d, i) in weekdayNames" :key="i" :value="i">{{ d }}</option>
              </select>
              <input v-if="notifWeeklyEnabled" v-model="notifWeeklyTime" type="time" class="form-input form-input--time notif-time" @change="saveNotifWeekly" />
              <label class="notif-toggle">
                <input type="checkbox" v-model="notifWeeklyEnabled" @change="saveNotifWeekly" />
                <span class="notif-toggle__track"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- DATA & SYNC -->
        <div class="card">
          <p class="section-kicker">Data &amp; sync</p>

          <input ref="importFileInput" type="file" accept=".sql,text/plain" style="display:none" @change="handleImportFile" />

          <div class="set-row">
            <div class="set-row__label">
              <span class="set-row__title">Health Connect</span>
              <span class="set-row__sub">{{ lastSyncTime ? `Last sync ${lastSyncTime}` : 'Not synced' }}</span>
            </div>
            <button class="btn-chip" :disabled="syncing" @click="syncNow">{{ syncing ? 'Syncing…' : 'Sync now' }}</button>
          </div>

          <button class="nav-row" @click="handleExport">
            <span class="set-row__title">Export backup</span>
            <ion-icon :icon="downloadOutline" class="nav-row__icon" />
          </button>

          <button class="nav-row" @click="triggerImport">
            <span class="set-row__title">Import backup</span>
            <ion-icon :icon="cloudUploadOutline" class="nav-row__icon" />
          </button>

          <button class="nav-row" :disabled="aiExporting" @click="handleAiExport">
            <div class="set-row__label">
              <span class="set-row__title">{{ aiExporting ? 'Preparing…' : 'Export for AI analysis' }}</span>
              <span class="set-row__sub">Plain-text for an AI</span>
            </div>
            <ion-icon :icon="sparklesOutline" class="nav-row__icon" />
          </button>
        </div>

      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { IonPage, IonHeader, IonContent, IonSelect, IonSelectOption, IonIcon, toastController, alertController } from '@ionic/vue'
import { chevronForwardOutline, downloadOutline, cloudUploadOutline, sparklesOutline } from 'ionicons/icons'
import { useRouter } from 'vue-router'
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue'
import { localDateISO } from '@/shared/utils/timeFormat'
import {
  getSleepGoalHours, setSleepGoalHours, getStepGoal, setStepGoal, getGoalWeightKg, setGoalWeightKg,
  getCurrency, setCurrency, getLastHcSyncAt, setLastHcSyncAt,
  getNotifWeightEnabled, setNotifWeightEnabled, getNotifWeightTime, setNotifWeightTime,
  getNotifHabitEnabled, setNotifHabitEnabled, getNotifHabitTime, setNotifHabitTime,
  getNotifSleepEnabled, setNotifSleepEnabled, getNotifSleepTime, setNotifSleepTime,
  getNotifCalendarEnabled, setNotifCalendarEnabled, getNotifCalendarMinsBefore, setNotifCalendarMinsBefore,
  getNotifSubscriptionEnabled, setNotifSubscriptionEnabled, getNotifSubscriptionDaysBefore, setNotifSubscriptionDaysBefore,
  getNotifMorningEnabled, setNotifMorningEnabled, getNotifMorningTime, setNotifMorningTime,
  getNotifWeeklyEnabled, setNotifWeeklyEnabled, getNotifWeeklyTime, setNotifWeeklyTime, getNotifWeeklyWeekday, setNotifWeeklyWeekday,
} from '@/shared/utils/userSettings'
import type { CurrencyCode } from '@/shared/utils/userSettings'
import {
  requestNotificationPermission,
  scheduleWeightReminder, scheduleHabitReminder, scheduleSleepReminder,
  scheduleCalendarReminders, scheduleSubscriptionReminders,
  scheduleMorningSummary, scheduleWeeklyDigest,
  cancelWeightReminder, cancelHabitReminder, cancelSleepReminder,
  cancelCalendarReminders, cancelSubscriptionReminders,
  cancelMorningSummary, cancelWeeklyDigest,
} from '@/shared/utils/notifications'
import { buildMorningBody, buildWeeklyBody } from '@/shared/utils/notificationDigests'
import { hapticLight, hapticMedium, hapticSelect, hapticSuccess, hapticError } from '@/shared/utils/haptics'
import { useTheme } from '@/shared/composables/useTheme'
import type { ThemeMode } from '@/shared/composables/useTheme'
import { getHabitsWithStatus, getCalendarEventsForDate, getFinanceSubscriptions } from '@/shared/db/app_db'
import { syncHealthConnectMetrics } from '@/shared/health/healthConnect'
import { exportDatabaseToSQL, importDatabaseFromSQL } from '@/shared/db/app_db'
import { buildAiExport } from '@/shared/utils/aiExport'
import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { FilePicker } from '@capawesome/capacitor-file-picker'

const router = useRouter()

// --- Appearance ---
const { mode: themeMode, setThemeMode } = useTheme()
const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]
const selectTheme = (value: ThemeMode) => {
  hapticSelect()
  setThemeMode(value)
}

// --- Health Targets ---
const sleepGoal = ref(getSleepGoalHours())
const stepGoal = ref(getStepGoal())
const goalWeight = ref<number | string>(getGoalWeightKg() ?? '')

const saveTargets = async () => {
  hapticMedium()
  // v-model.number yields '' or NaN when a field is cleared — guard so we never
  // persist "NaN" to localStorage (which would then parse back as NaN on read).
  if (Number.isFinite(sleepGoal.value)) setSleepGoalHours(sleepGoal.value)
  if (Number.isFinite(stepGoal.value)) setStepGoal(stepGoal.value)
  if (goalWeight.value !== '' && Number.isFinite(Number(goalWeight.value)) && Number(goalWeight.value) > 0) {
    setGoalWeightKg(Number(goalWeight.value))
  }
  hapticSuccess()
  const t = await toastController.create({ message: 'saved', duration: 1500, color: 'success' })
  await t.present()
}

// --- Sync ---
const formatSyncStamp = (epochMs: number) =>
  new Date(epochMs).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

const syncing = ref(false)
const lastSyncAt = ref<number | null>(getLastHcSyncAt())
const lastSyncTime = computed(() => (lastSyncAt.value ? formatSyncStamp(lastSyncAt.value) : null))

const syncNow = async () => {
  hapticMedium()
  syncing.value = true
  try {
    const result = await syncHealthConnectMetrics()
    const ok = result.available && result.granted
    if (ok) {
      const now = Date.now()
      setLastHcSyncAt(now)
      lastSyncAt.value = now
      hapticSuccess()
    }
    const msg = ok
      ? `synced ${result.synced} records`
      : result.available
        ? 'permission needed'
        : 'health connect unavailable'
    const t = await toastController.create({ message: msg, duration: 2000, color: ok ? 'success' : 'warning' })
    await t.present()
  } catch {
    hapticError()
    const t = await toastController.create({ message: 'sync failed', duration: 2000, color: 'danger' })
    await t.present()
  } finally {
    syncing.value = false
  }
}

// --- Finance ---
const currencyOptions: CurrencyCode[] = ['USD', 'EUR', 'GBP', 'CHF']
const currency = ref<CurrencyCode>(getCurrency())
watch(currency, (code) => setCurrency(code))

// --- Goals ---
const goToGoals = () => {
  hapticLight()
  router.push('/plan/goals')
}

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
const notifMorningEnabled = ref(getNotifMorningEnabled())
const notifMorningTime = ref(getNotifMorningTime())
const notifWeeklyEnabled = ref(getNotifWeeklyEnabled())
const notifWeeklyTime = ref(getNotifWeeklyTime())
const notifWeeklyWeekday = ref(getNotifWeeklyWeekday())
const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const requestPermission = async () => {
  hapticMedium()
  const granted = await requestNotificationPermission()
  const t = await toastController.create({
    message: granted ? 'notifications on' : 'permission denied',
    duration: 2000,
    color: granted ? 'success' : 'warning',
  })
  await t.present()
}

const saveNotifWeight = async () => {
  hapticLight()
  setNotifWeightEnabled(notifWeightEnabled.value)
  setNotifWeightTime(notifWeightTime.value)
  if (notifWeightEnabled.value) await scheduleWeightReminder(notifWeightTime.value)
  else await cancelWeightReminder()
}

const saveNotifHabit = async () => {
  hapticLight()
  setNotifHabitEnabled(notifHabitEnabled.value)
  setNotifHabitTime(notifHabitTime.value)
  if (notifHabitEnabled.value) {
    const today = localDateISO()
    const habits = await getHabitsWithStatus(today)
    const incomplete = habits.filter((h: any) => h.completed !== 1).map((h: any) => h.name as string)
    await scheduleHabitReminder(notifHabitTime.value, incomplete)
  } else {
    await cancelHabitReminder()
  }
}

const saveNotifSleep = async () => {
  hapticLight()
  setNotifSleepEnabled(notifSleepEnabled.value)
  setNotifSleepTime(notifSleepTime.value)
  if (notifSleepEnabled.value) await scheduleSleepReminder(notifSleepTime.value)
  else await cancelSleepReminder()
}

const saveNotifCalendar = async () => {
  hapticLight()
  setNotifCalendarEnabled(notifCalendarEnabled.value)
  setNotifCalendarMinsBefore(notifCalendarMins.value)
  const today = localDateISO()
  const events = await getCalendarEventsForDate(today)
  if (notifCalendarEnabled.value) {
    await scheduleCalendarReminders(events, notifCalendarMins.value)
  } else {
    await cancelCalendarReminders(events.map((e: any) => Number(e.id)))
  }
}

const saveNotifSubscription = async () => {
  hapticLight()
  setNotifSubscriptionEnabled(notifSubscriptionEnabled.value)
  setNotifSubscriptionDaysBefore(notifSubDays.value)
  const subs = await getFinanceSubscriptions()
  if (notifSubscriptionEnabled.value) {
    await scheduleSubscriptionReminders(subs, notifSubDays.value)
  } else {
    await cancelSubscriptionReminders(subs.map((s: any) => Number(s.id)))
  }
}

const saveNotifMorning = async () => {
  hapticLight()
  setNotifMorningEnabled(notifMorningEnabled.value)
  setNotifMorningTime(notifMorningTime.value)
  if (notifMorningEnabled.value) {
    await scheduleMorningSummary(notifMorningTime.value, await buildMorningBody(localDateISO()))
  } else {
    await cancelMorningSummary()
  }
}

const saveNotifWeekly = async () => {
  hapticLight()
  setNotifWeeklyEnabled(notifWeeklyEnabled.value)
  setNotifWeeklyTime(notifWeeklyTime.value)
  setNotifWeeklyWeekday(notifWeeklyWeekday.value)
  if (notifWeeklyEnabled.value) {
    await scheduleWeeklyDigest(notifWeeklyWeekday.value, notifWeeklyTime.value, await buildWeeklyBody())
  } else {
    await cancelWeeklyDigest()
  }
}

// --- Database: export / import ---
const importFileInput = ref<HTMLInputElement | null>(null)

const showToast = async (message: string, color: string = 'danger', duration: number = 2000) => {
  const toast = await toastController.create({ message, duration, position: 'top', color })
  await toast.present()
}

const handleExport = async () => {
  hapticMedium()
  const backup = await exportDatabaseToSQL()

  if (!backup) {
    showToast('database not ready', 'warning')
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

    hapticSuccess()
    showToast(`backup ready · ${backup.fileName}`, 'success', 3000)
  } catch (error) {
    console.error('Export failed:', error)
    hapticError()
    showToast('export failed', 'danger')
  }
}

const aiExporting = ref(false)

const handleAiExport = async () => {
  if (aiExporting.value) return
  hapticMedium()
  aiExporting.value = true
  try {
    const text = await buildAiExport()
    const stamp = localDateISO()
    const fileName = `ai-insights-${stamp}.txt`

    if (Capacitor.getPlatform() === 'web') {
      const blob = new Blob([text], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } else {
      const writeResult = await Filesystem.writeFile({
        path: fileName,
        data: text,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true,
      })
      await Share.share({
        title: 'AI insights export',
        text: 'Tracking data for AI analysis',
        url: writeResult.uri,
        dialogTitle: 'Share data for AI analysis',
      })
    }

    hapticSuccess()
    showToast(`export ready · ${fileName}`, 'success', 3000)
  } catch (error) {
    console.error('AI export failed:', error)
    hapticError()
    showToast('export failed', 'danger')
  } finally {
    aiExporting.value = false
  }
}

const triggerImport = () => {
  hapticMedium()
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
    header: 'Import backup?',
    message: 'replaces all data',
    cssClass: 'app-confirm-alert',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Import',
        handler: async () => {
          try {
            const result = await importDatabaseFromSQL(sqlContent)

            if (result.success) {
              showToast('imported', 'success', 3000)
            } else {
              showToast(`import failed · ${result.message}`, 'danger')
            }
          } catch (error) {
            console.error('Import error:', error)
            showToast('import failed', 'danger')
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
        header: 'Import failed',
        message: "couldn't read file",
        cssClass: 'app-confirm-alert',
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
      header: 'Import failed',
      message: "couldn't open picker",
      cssClass: 'app-confirm-alert',
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
  --background: var(--nt-bg);
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
  border-radius: var(--nt-radius-md);
  padding: 18px;
}

.section-kicker {
  margin: 0 0 6px;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: rgba(var(--nt-ink), 0.5);
}

/* Unified setting row: label block on the left, control on the right. */
.set-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 0;
  border-bottom: 1px solid rgba(var(--nt-ink), 0.08);
}

.set-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.set-row__label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.set-row__title {
  font-size: 0.9rem;
  color: rgba(var(--nt-ink), 0.85);
}

.set-row__sub {
  font-size: 0.72rem;
  color: rgba(var(--nt-ink), 0.5);
}

/* Stacked control (label above a full-width control, e.g. the theme switch). */
.set-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(var(--nt-ink), 0.08);
}

/* Tappable navigation / action row (Manage goals, Export, Import). */
.nav-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 0;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(var(--nt-ink), 0.08);
  cursor: pointer;
  text-align: left;
}

.nav-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.nav-row:active {
  opacity: 0.6;
}

.nav-row:disabled {
  opacity: 0.5;
  cursor: default;
}

.nav-row__icon {
  font-size: 1.1rem;
  color: rgba(var(--nt-ink), 0.4);
  flex-shrink: 0;
}

/* Compact pill action button sitting at the right of a setting row. */
.btn-chip {
  flex-shrink: 0;
  padding: 8px 16px;
  background: transparent;
  border: 1px solid rgba(var(--nt-ink), 0.14);
  border-radius: var(--nt-radius-pill);
  color: rgba(var(--nt-ink), 0.85);
  font-family: var(--nt-font-head);
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: border-color 150ms ease, opacity 150ms ease;
}

.btn-chip:active {
  opacity: 0.7;
}

.btn-chip:disabled {
  opacity: 0.5;
  cursor: default;
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

.form-input--compact {
  width: 104px;
  padding: 8px 10px;
  text-align: right;
}

.set-action {
  margin-top: 16px;
}

.btn-primary {
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

.btn-primary:hover {
  background: var(--nt-accent-press);
}

.btn-primary:disabled {
  opacity: 0.4;
  cursor: default;
}

.hint-text {
  margin: 10px 0 0;
  font-size: 0.72rem;
  color: rgba(var(--nt-ink), 0.5);
}

.settings-select {
  background: rgba(var(--nt-ink), 0.06);
  border: 1px solid rgba(var(--nt-ink), 0.1);
  border-radius: 8px;
  color: var(--nt-fg);
  min-width: 140px;
  --color: var(--nt-fg);
  --placeholder-color: rgba(var(--nt-ink), 0.35);
}

.notif-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(var(--nt-ink), 0.08);
}

.notif-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

/* Theme segmented control */
.theme-seg {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: rgba(var(--nt-ink), 0.05);
  border-radius: var(--nt-radius-pill);
}

.theme-seg__btn {
  flex: 1;
  padding: 9px 0;
  border: none;
  background: transparent;
  color: var(--nt-text-dim);
  font-family: var(--nt-font-head);
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-radius: var(--nt-radius-pill);
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease;
}

.theme-seg__btn--active {
  background: var(--nt-surface-2);
  color: var(--ion-color-light);
}

.notif-row__label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.notif-title {
  font-size: 0.9rem;
  color: rgba(var(--nt-ink), 0.85);
  font-weight: 400;
}

.notif-sub {
  font-size: 0.72rem;
  color: rgba(var(--nt-ink), 0.5);
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
  color-scheme: var(--nt-color-scheme);
}

.form-select {
  background: rgba(var(--nt-ink), 0.06);
  border: 1px solid rgba(var(--nt-ink), 0.1);
  border-radius: 8px;
  color: var(--nt-fg);
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
  background: rgba(var(--nt-ink), 0.12);
  transition: background-color 150ms ease;
}

.notif-toggle__track::after {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: rgba(var(--nt-ink), 0.5);
  top: 3px;
  left: 3px;
  transition: background-color 150ms ease;
}

.notif-toggle input:checked + .notif-toggle__track {
  background: var(--ion-color-accent-red);
}

.notif-toggle input:checked + .notif-toggle__track::after {
  transform: translateX(18px);
  background: var(--nt-fg);
}
</style>
