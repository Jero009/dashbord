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

      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { IonPage, IonHeader, IonContent, IonSelect, IonSelectOption, toastController, alertController } from '@ionic/vue'
import { useRouter } from 'vue-router'
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue'
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
import { bulkInsertBodyLog, exportDatabaseToSQL, importDatabaseFromSQL } from '@/shared/db/app_db'
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

const importHistory = async () => {
  const HISTORY: { date: string; weight_kg: number }[] = [
    ['2026-06-01', 84.0],
    ['2026-05-29', 83.4],
    ['2026-05-20', 83.2],
    ['2026-05-19', 82.9],
    ['2026-05-18', 84.5],
    ['2026-05-15', 82.9],
    ['2026-05-14', 82.9],
    ['2026-05-12', 84.2],
    ['2026-05-11', 85.0],
    ['2026-05-08', 84.0],
    ['2026-05-07', 84.3],
    ['2026-05-06', 84.2],
    ['2026-05-05', 84.9],
    ['2026-05-04', 86.2],
    ['2026-04-07', 83.7],
    ['2026-03-09', 83.4],
    ['2026-03-05', 83.4],
    ['2026-03-03', 83.2],
    ['2026-02-11', 83.2],
    ['2026-02-10', 83.3],
    ['2026-02-05', 82.8],
    ['2026-02-04', 83.4],
    ['2026-01-20', 80.3],
    ['2026-01-14', 81.4],
    ['2026-01-08', 80.4],
    ['2026-01-07', 80.4],
    ['2026-01-05', 80.4],
    ['2025-12-29', 79.4],
    ['2025-12-16', 80.6],
    ['2025-12-15', 80.6],
    ['2025-12-12', 80.6],
    ['2025-12-11', 81.0],
    ['2025-12-10', 79.4],
    ['2025-12-08', 80.6],
    ['2025-12-04', 80.0],
    ['2025-12-03', 80.0],
    ['2025-12-02', 80.3],
    ['2025-12-01', 80.3],
    ['2025-11-29', 80.6],
    ['2025-11-28', 80.6],
    ['2025-11-27', 80.9],
    ['2025-11-24', 81.2],
    ['2025-11-19', 80.9],
    ['2025-11-17', 81.5],
    ['2025-11-10', 82.2],
    ['2025-11-07', 83.0],
    ['2025-11-03', 84.0],
    ['2025-10-23', 81.8],
    ['2025-10-16', 82.4],
    ['2025-10-13', 81.0],
    ['2025-10-10', 81.3],
    ['2025-10-08', 81.3],
    ['2025-10-07', 80.4],
    ['2025-10-06', 81.1],
    ['2025-09-29', 81.8],
    ['2025-09-26', 81.4],
    ['2025-09-23', 81.4],
    ['2025-09-22', 82.0],
    ['2025-09-17', 80.8],
    ['2025-09-15', 80.3],
    ['2025-09-11', 80.7],
    ['2025-09-09', 80.7],
    ['2025-09-05', 82.0],
    ['2025-09-03', 80.7],
    ['2025-09-02', 80.7],
    ['2025-09-01', 81.3],
    ['2025-08-13', 81.7],
    ['2025-08-09', 81.5],
    ['2025-08-07', 82.8],
    ['2025-08-01', 81.6],
    ['2025-07-30', 82.5],
    ['2025-07-29', 82.5],
    ['2025-07-26', 82.5],
    ['2025-07-24', 82.7],
    ['2025-07-23', 83.2],
    ['2025-07-22', 83.2],
    ['2025-07-18', 82.7],
    ['2025-07-17', 83.7],
    ['2025-07-14', 83.4],
    ['2025-07-11', 82.7],
    ['2025-07-10', 83.8],
    ['2025-07-09', 83.2],
    ['2025-07-08', 82.7],
    ['2025-07-05', 82.4],
    ['2025-07-04', 82.9],
    ['2025-07-03', 82.5],
    ['2025-07-02', 82.8],
    ['2025-07-01', 82.8],
    ['2025-06-30', 84.1],
    ['2025-06-27', 82.8],
    ['2025-06-26', 83.1],
    ['2025-06-24', 82.7],
    ['2025-06-23', 83.2],
    ['2025-06-20', 82.8],
    ['2025-06-19', 82.8],
    ['2025-06-17', 83.5],
    ['2025-06-16', 83.8],
    ['2025-06-11', 83.2],
    ['2025-06-10', 83.2],
    ['2025-06-09', 83.9],
    ['2025-06-06', 82.5],
    ['2025-06-05', 82.5],
    ['2025-06-04', 82.9],
    ['2025-06-03', 82.9],
    ['2025-06-02', 83.5],
    ['2025-05-30', 83.5],
    ['2025-05-28', 83.1],
    ['2025-05-27', 82.6],
    ['2025-05-26', 83.5],
    ['2025-05-24', 84.0],
    ['2025-05-23', 83.1],
    ['2025-05-22', 82.8],
    ['2025-05-21', 82.7],
    ['2025-05-20', 82.9],
    ['2025-05-19', 83.2],
    ['2025-05-18', 82.9],
    ['2025-05-17', 83.8],
    ['2025-05-16', 83.8],
    ['2025-05-15', 84.3],
    ['2025-05-14', 84.3],
    ['2025-05-13', 84.3],
    ['2025-05-12', 85.1],
    ['2025-05-11', 84.7],
    ['2025-05-10', 84.9],
    ['2025-05-09', 85.1],
    ['2025-05-08', 85.1],
    ['2025-05-07', 85.5],
    ['2025-05-06', 85.8],
    ['2025-05-05', 86.6],
    ['2025-04-30', 86.0],
    ['2025-04-29', 85.5],
    ['2025-04-28', 86.5],
    ['2025-04-27', 85.0],
    ['2025-04-26', 85.0],
    ['2025-04-25', 85.0],
    ['2025-04-24', 84.5],
    ['2025-04-23', 84.8],
    ['2025-04-22', 85.7],
    ['2025-04-20', 85.4],
    ['2025-04-19', 85.2],
    ['2025-04-18', 86.0],
    ['2025-04-17', 85.7],
    ['2025-04-16', 84.9],
    ['2025-04-15', 84.9],
    ['2025-04-14', 85.7],
    ['2025-04-13', 85.7],
    ['2025-04-12', 85.1],
    ['2025-04-11', 85.4],
    ['2025-04-10', 85.4],
    ['2025-04-08', 84.7],
    ['2025-04-07', 85.4],
    ['2025-04-06', 85.3],
    ['2025-04-05', 85.0],
    ['2025-04-04', 85.1],
    ['2025-04-03', 85.9],
    ['2025-04-02', 85.9],
    ['2025-04-01', 85.2],
    ['2025-03-31', 86.3],
    ['2025-03-28', 84.2],
    ['2025-03-27', 84.1],
    ['2025-03-26', 83.7],
    ['2025-03-25', 84.2],
    ['2025-03-24', 85.0],
    ['2025-03-23', 85.0],
    ['2025-03-22', 83.9],
    ['2025-03-21', 84.3],
    ['2025-03-19', 85.1],
    ['2025-03-18', 85.8],
    ['2025-03-17', 86.0],
    ['2025-03-16', 85.4],
    ['2025-03-13', 84.7],
    ['2025-03-08', 83.5],
    ['2025-03-04', 83.7],
    ['2025-03-03', 84.1],
    ['2025-03-02', 84.4],
    ['2025-03-01', 84.4],
    ['2025-02-26', 83.9],
    ['2025-02-25', 84.5],
    ['2025-02-24', 84.5],
    ['2025-02-21', 84.2],
    ['2025-02-20', 84.1],
    ['2025-02-18', 85.4],
    ['2025-02-13', 84.0],
    ['2025-02-11', 84.9],
    ['2025-02-10', 85.5],
    ['2025-02-09', 86.3],
    ['2025-02-06', 84.5],
    ['2025-02-05', 84.5],
    ['2025-02-04', 85.3],
    ['2025-02-03', 85.3],
    ['2025-01-31', 85.5],
    ['2025-01-30', 84.5],
    ['2025-01-29', 84.4],
    ['2025-01-28', 84.6],
    ['2025-01-25', 83.6],
    ['2025-01-22', 83.2],
    ['2025-01-21', 83.2],
    ['2025-01-20', 84.1],
    ['2025-01-19', 83.1],
    ['2025-01-18', 83.4],
    ['2025-01-17', 83.4],
    ['2025-01-16', 84.2],
    ['2025-01-14', 84.1],
    ['2025-01-13', 84.1],
    ['2025-01-09', 84.1],
    ['2025-01-08', 84.4],
    ['2025-01-07', 84.7],
    ['2025-01-06', 84.8],
    ['2025-01-04', 84.5],
    ['2025-01-03', 84.2],
    ['2025-01-02', 85.0],
    ['2024-12-29', 83.0],
    ['2024-12-24', 81.4],
    ['2024-12-22', 82.7],
    ['2024-12-19', 81.6],
    ['2024-12-17', 81.9],
    ['2024-12-07', 81.3],
    ['2024-11-26', 82.6],
    ['2024-11-21', 82.0],
    ['2024-10-18', 80.8],
    ['2024-10-14', 79.9],
    ['2024-10-12', 79.5],
    ['2024-10-09', 79.9],
    ['2024-10-04', 79.6],
    ['2024-10-02', 78.9],
    ['2024-10-01', 79.4],
    ['2024-09-26', 79.4],
    ['2024-09-19', 80.5],
    ['2024-09-16', 79.8],
    ['2024-09-11', 79.2],
    ['2024-09-09', 79.8],
    ['2024-09-05', 79.0],
    ['2024-08-29', 80.2],
    ['2024-08-16', 78.6],
    ['2024-08-15', 78.1],
    ['2024-08-14', 77.8],
    ['2024-08-13', 78.2],
    ['2024-08-09', 78.8],
    ['2024-08-07', 78.2],
    ['2024-08-06', 78.5],
    ['2024-08-04', 79.0],
    ['2024-08-03', 78.8],
    ['2024-08-02', 79.9],
    ['2024-08-01', 79.3],
    ['2024-07-31', 79.2],
    ['2024-07-30', 79.5],
    ['2024-07-29', 79.6],
    ['2024-07-19', 77.8],
    ['2024-07-18', 77.8],
    ['2024-07-17', 77.5],
    ['2024-07-14', 78.3],
    ['2024-07-06', 78.6],
    ['2024-07-04', 79.0],
    ['2024-06-24', 78.0],
    ['2024-06-23', 78.0],
    ['2024-06-21', 77.1],
    ['2024-06-20', 77.9],
    ['2024-06-19', 78.0],
    ['2024-06-17', 78.6],
    ['2024-06-11', 77.9],
    ['2024-06-08', 77.3],
    ['2024-06-06', 77.4],
    ['2024-06-05', 76.9],
    ['2024-06-04', 77.3],
    ['2024-06-03', 77.7],
    ['2024-06-01', 78.8],
    ['2024-05-25', 77.6],
    ['2024-05-21', 77.6],
    ['2024-05-20', 77.8],
    ['2024-05-16', 78.2],
    ['2024-05-15', 77.3],
    ['2024-05-09', 77.1],
    ['2024-05-08', 77.5],
    ['2024-05-06', 78.4],
    ['2024-04-28', 78.8],
    ['2024-04-27', 77.7],
    ['2024-04-26', 78.6],
    ['2024-04-25', 79.4],
    ['2024-04-24', 78.2],
    ['2024-04-23', 78.1],
    ['2024-04-22', 78.6],
    ['2024-04-18', 78.1],
    ['2024-04-17', 78.7],
    ['2024-04-16', 79.1],
    ['2024-04-11', 79.6],
    ['2024-04-10', 78.7],
    ['2024-04-09', 79.8],
    ['2024-04-07', 79.5],
    ['2024-04-05', 78.8],
    ['2024-04-04', 79.7],
    ['2024-04-01', 79.9],
    ['2024-03-31', 80.0],
    ['2024-03-27', 78.7],
    ['2024-03-26', 78.9],
    ['2024-03-24', 78.9],
    ['2024-03-23', 78.7],
    ['2024-03-22', 79.0],
    ['2024-03-21', 79.9],
    ['2024-03-16', 79.0],
    ['2024-03-15', 79.0],
    ['2024-03-13', 79.4],
    ['2024-03-12', 80.0],
    ['2024-03-11', 80.6],
    ['2024-03-07', 79.4],
    ['2024-03-06', 79.4],
    ['2024-03-04', 79.8],
    ['2024-03-03', 80.2],
    ['2024-03-02', 79.3],
    ['2024-03-01', 79.6],
    ['2024-02-29', 79.7],
    ['2024-02-28', 80.0],
    ['2024-02-27', 80.0],
    ['2024-02-25', 80.2],
    ['2024-01-24', 78.5],
    ['2024-01-07', 77.7],
    ['2023-12-26', 76.7],
    ['2023-11-22', 74.7],
    ['2023-11-14', 75.2],
    ['2023-11-13', 75.4],
    ['2023-11-07', 75.7],
    ['2023-11-05', 75.5],
    ['2023-10-18', 74.2],
    ['2023-10-17', 74.8],
    ['2023-10-13', 74.4],
    ['2023-10-12', 74.9],
    ['2023-10-10', 75.1],
    ['2023-10-09', 75.2],
    ['2023-10-04', 75.5],
    ['2023-09-30', 74.5],
    ['2023-09-01', 74.4],
    ['2023-08-02', 73.8],
    ['2023-08-01', 74.0],
    ['2023-07-18', 73.4],
    ['2023-07-11', 72.7],
    ['2023-06-30', 71.9],
    ['2023-06-29', 71.5],
    ['2023-06-28', 71.4],
    ['2023-06-22', 72.0],
    ['2023-06-19', 70.0],
    ['2023-06-16', 71.5],
    ['2023-06-06', 71.2],
    ['2023-06-02', 70.1],
    ['2023-05-29', 71.2],
    ['2023-05-26', 70.8],
    ['2023-05-25', 71.3],
    ['2023-05-22', 71.0],
    ['2023-05-17', 69.9],
    ['2023-05-16', 69.9],
    ['2023-05-15', 70.7],
    ['2023-05-11', 70.3],
    ['2023-05-10', 69.3],
    ['2023-05-04', 71.4],
    ['2023-05-03', 71.0],
    ['2023-05-02', 71.0],
    ['2023-04-18', 70.0],
    ['2023-04-17', 69.9],
    ['2023-04-13', 69.4],
    ['2023-04-12', 69.0],
    ['2023-04-11', 70.5],
    ['2023-04-07', 69.9],
    ['2023-04-03', 69.9],
    ['2023-03-16', 69.8],
    ['2023-03-13', 70.3],
    ['2023-03-07', 69.7],
    ['2023-03-06', 70.4],
    ['2023-02-15', 69.9],
    ['2023-02-13', 70.9],
    ['2023-02-12', 70.1],
    ['2023-02-04', 68.8],
    ['2023-01-21', 69.2],
    ['2023-01-20', 68.8],
    ['2023-01-13', 69.0],
    ['2023-01-12', 68.9],
    ['2023-01-11', 68.9],
    ['2023-01-10', 69.4],
    ['2023-01-07', 69.8],
    ['2022-12-31', 68.9],
    ['2022-12-24', 68.5],
    ['2022-12-23', 68.5],
    ['2022-12-22', 69.3],
    ['2022-12-19', 69.0],
    ['2022-12-18', 68.9],
    ['2022-12-17', 69.6],
    ['2022-12-16', 69.7],
    ['2022-12-15', 69.7],
    ['2022-12-13', 69.9],
    ['2022-12-09', 69.8],
    ['2022-12-08', 71.3],
    ['2022-12-07', 71.0],
    ['2022-12-04', 70.3],
    ['2022-11-30', 69.8],
    ['2022-11-29', 70.3],
    ['2022-11-25', 70.4],
    ['2022-11-24', 70.7],
    ['2022-11-23', 71.1],
    ['2022-11-22', 71.3],
    ['2022-11-19', 71.2],
    ['2022-11-18', 71.2],
    ['2022-11-17', 71.3],
    ['2022-11-16', 71.7],
    ['2022-11-15', 72.2],
    ['2022-11-14', 72.6],
    ['2022-11-10', 71.8],
    ['2022-11-09', 71.8],
    ['2022-11-08', 71.8],
    ['2022-11-07', 72.3],
    ['2022-10-31', 72.4],
    ['2022-10-30', 71.8],
    ['2022-10-29', 72.2],
    ['2022-10-28', 71.9],
    ['2022-10-27', 72.2],
    ['2022-10-26', 72.1],
    ['2022-10-25', 71.3],
    ['2022-10-21', 72.8],
    ['2022-10-20', 72.4],
    ['2022-10-19', 72.7],
    ['2022-10-18', 72.7],
    ['2022-10-13', 72.7],
    ['2022-10-12', 72.7],
    ['2022-10-11', 73.4],
    ['2022-10-07', 73.8],
    ['2022-10-06', 74.7],
    ['2022-10-04', 74.2],
    ['2022-10-02', 73.6],
    ['2022-09-29', 73.2],
    ['2022-09-28', 72.9],
    ['2022-09-27', 73.3],
    ['2022-09-25', 73.2],
    ['2022-09-24', 73.6],
    ['2022-09-23', 73.9],
    ['2022-09-22', 75.0],
    ['2022-09-21', 74.7],
    ['2022-09-20', 74.7],
    ['2022-09-19', 75.1],
    ['2022-09-16', 74.2],
    ['2022-09-14', 74.4],
    ['2022-09-12', 74.3],
    ['2022-09-11', 75.3],
    ['2022-09-09', 75.3],
    ['2022-09-07', 75.3],
    ['2022-09-06', 75.0],
    ['2022-09-05', 75.9],
    ['2022-09-04', 75.5],
    ['2022-09-02', 75.4],
    ['2022-08-21', 76.5],
    ['2022-08-19', 76.6],
    ['2022-08-18', 76.6],
    ['2022-08-12', 76.4],
    ['2022-08-09', 76.4],
    ['2022-08-08', 76.5],
    ['2022-08-06', 77.1],
    ['2022-08-02', 86.2],
  ].map(([date, weight_kg]) => ({ date: date as string, weight_kg: weight_kg as number }))

  try {
    const count = await bulkInsertBodyLog(HISTORY)
    localStorage.setItem(IMPORT_KEY, '1')
    alreadyImported.value = true
    const t = await toastController.create({ message: `Imported ${count} entries.`, duration: 2000, color: 'success' })
    await t.present()
  } catch {
    const t = await toastController.create({ message: 'Import failed.', duration: 2000, color: 'danger' })
    await t.present()
  }
}

// --- Goals ---
const goToGoals = () => router.push('/health/goals')

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
    const today = new Date().toISOString().slice(0, 10)
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
    const today = new Date().toISOString().slice(0, 10)
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

.fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
}

.field-group {
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

.btn-primary {
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

.btn-primary:disabled {
  opacity: 0.55;
  cursor: default;
}

.btn-secondary {
  width: 100%;
  padding: 11px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.hint-text {
  margin: 10px 0 0;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
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
  --placeholder-color: rgba(255, 255, 255, 0.4);
}

.db-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.notif-perm-btn {
  width: 100%;
  padding: 11px;
  margin-bottom: 16px;
  background: rgba(255, 255, 255, 0.08);
  border: none;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.notif-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
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
  font-size: 0.88rem;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 500;
}

.notif-sub {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.4);
}

.notif-row__controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.notif-time {
  width: 90px;
  padding: 5px 8px;
  font-size: 0.82rem;
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
  padding: 5px 8px;
  font-size: 0.82rem;
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
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.12);
  transition: background 0.2s;
}

.notif-toggle__track::after {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
  top: 3px;
  left: 3px;
  transition: transform 0.2s, background 0.2s;
}

.notif-toggle input:checked + .notif-toggle__track {
  background: var(--ion-color-accent-red);
}

.notif-toggle input:checked + .notif-toggle__track::after {
  transform: translateX(18px);
  background: #fff;
}
</style>
