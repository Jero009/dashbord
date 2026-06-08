<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <health-section-tabs />
    </ion-header>

    <ion-content :fullscreen="true" class="circadian-content">
      <div class="circadian-shell">

        <!-- Loading state -->
        <div v-if="loading" class="loading-state">
          <span class="loading-text">Loading circadian data...</span>
        </div>

        <template v-else>

          <!-- 1. Chronotype card -->
          <div class="card">
            <p class="section-kicker">Chronotype</p>
            <div class="chronotype-hero">
              <span
                class="chronotype-label"
                :class="`chronotype-label--${profile?.chronotype ?? 'intermediate'}`"
              >{{ profile?.chronotype ?? '—' }}</span>
              <span
                v-if="profile?.dataQuality"
                class="quality-badge"
                :class="`quality-badge--${profile.dataQuality}`"
              >{{ profile.dataQuality }} quality</span>
            </div>

            <div class="metric-grid">
              <div class="card-metric">
                <span class="metric-label">Sleep midpoint</span>
                <strong class="metric-value">{{ profile?.msfsc != null ? formatHour(profile.msfsc) : '—' }}</strong>
                <span class="metric-sub">free-day chronotype</span>
              </div>
              <div class="card-metric">
                <span class="metric-label">Melatonin onset</span>
                <strong class="metric-value">{{ profile?.dlmoEstimate != null ? formatHour(profile.dlmoEstimate) : '—' }}</strong>
                <span class="metric-sub">est. sleep drive start</span>
              </div>
              <div class="card-metric">
                <span class="metric-label">Temp minimum</span>
                <strong class="metric-value">{{ profile?.ctminEstimate != null ? formatHour(profile.ctminEstimate) : '—' }}</strong>
                <span class="metric-sub">deepest sleep marker</span>
              </div>
              <div class="card-metric" :class="{ 'card-metric--warn': (profile?.socialJetlag ?? 0) > 1.5 }">
                <span class="metric-label">Social jetlag</span>
                <strong class="metric-value">
                  {{ profile?.socialJetlag != null ? profile.socialJetlag.toFixed(1) + ' h' : '—' }}
                  <span v-if="(profile?.socialJetlag ?? 0) > 1.5" class="warn-flag">high</span>
                </strong>
                <span class="metric-sub">work vs free-day offset</span>
              </div>
            </div>
          </div>

          <!-- 2. Circadian Health Score card -->
          <div class="card">
            <p class="section-kicker">Circadian health score</p>
            <div class="score-hero">
              <span
                class="score-number"
                :class="scoreColorClass"
              >{{ score?.total ?? '—' }}</span>
              <div class="score-bar-track">
                <div
                  class="score-bar-fill"
                  :class="scoreColorClass"
                  :style="{ width: (score?.total ?? 0) + '%' }"
                ></div>
              </div>
            </div>

            <div class="component-grid">
              <div class="card-metric">
                <span class="metric-label">Consistency</span>
                <strong class="metric-value">{{ score?.consistency ?? '—' }}</strong>
              </div>
              <div class="card-metric">
                <span class="metric-label">Amplitude</span>
                <strong class="metric-value">{{ score?.amplitude ?? '—' }}</strong>
              </div>
              <div class="card-metric">
                <span class="metric-label">Efficiency</span>
                <strong class="metric-value">{{ score?.efficiency ?? '—' }}</strong>
              </div>
              <div class="card-metric">
                <span class="metric-label">Recovery</span>
                <strong class="metric-value">{{ score?.recovery ?? '—' }}</strong>
              </div>
            </div>
          </div>

          <!-- 3. Today's alertness curve -->
          <div class="card">
            <p class="section-kicker">Alertness today</p>
            <div class="curve-wrap">
              <svg
                v-if="alertnessCurve.length"
                viewBox="0 0 24 10"
                preserveAspectRatio="none"
                class="alertness-svg"
                aria-hidden="true"
              >
                <!-- Recommended sleep band (wraps midnight: two rects) -->
                <template v-if="windows">
                  <!-- from bedtime to end of day -->
                  <rect
                    :x="windows.bedtimeTarget"
                    y="0"
                    :width="24 - windows.bedtimeTarget"
                    height="10"
                    class="sleep-band"
                  />
                  <!-- from start of day to wake -->
                  <rect
                    x="0"
                    y="0"
                    :width="avgWakeHour"
                    height="10"
                    class="sleep-band"
                  />
                  <text
                    :x="(windows.bedtimeTarget + 24) / 2"
                    y="5.5"
                    class="sleep-band-label"
                    text-anchor="middle"
                  >sleep</text>
                </template>
                <!-- Area fill -->
                <polygon
                  :points="`0,10 ${alertnessCurve.map(p => `${p.hour},${(1 - p.alertness) * 9 + 0.5}`).join(' ')} 23,10`"
                  class="curve-area"
                />
                <!-- Line -->
                <polyline
                  :points="alertnessCurve.map(p => `${p.hour},${(1 - p.alertness) * 9 + 0.5}`).join(' ')"
                  class="curve-line"
                />
                <!-- Now line -->
                <line
                  :x1="currentHour"
                  y1="0.5"
                  :x2="currentHour"
                  y2="9.5"
                  class="now-line"
                />
                <!-- Peak label -->
                <text
                  v-if="peakPoint"
                  :x="peakPoint.hour"
                  :y="(1 - peakPoint.alertness) * 9 + 0.5 - 0.6"
                  class="peak-label"
                  text-anchor="middle"
                >peak</text>
              </svg>
              <div v-else class="curve-empty">No alertness data</div>
            </div>
            <div class="axis-labels">
              <span>0</span>
              <span>6</span>
              <span>12</span>
              <span>18</span>
            </div>
          </div>

          <!-- 4. Timing windows card -->
          <div v-if="windows" class="card">
            <p class="section-kicker">Timing windows</p>
            <div class="windows-list">
              <div class="window-row">
                <span class="window-dot window-dot--red"></span>
                <span class="window-label">Cognitive peak</span>
                <span class="window-time">{{ formatHour(windows.cognitiveStart) }} – {{ formatHour(windows.cognitiveEnd) }}</span>
              </div>
              <div v-if="windows.exerciseMorning != null" class="window-row">
                <span class="window-dot window-dot--yellow"></span>
                <span class="window-label">Morning exercise</span>
                <span class="window-time">{{ formatHour(windows.exerciseMorning!.start) }} – {{ formatHour(windows.exerciseMorning!.end) }}</span>
              </div>
              <div v-if="windows.exerciseAfternoon != null" class="window-row">
                <span class="window-dot window-dot--yellow"></span>
                <span class="window-label">Afternoon exercise</span>
                <span class="window-time">{{ formatHour(windows.exerciseAfternoon!.start) }} – {{ formatHour(windows.exerciseAfternoon!.end) }}</span>
              </div>
              <div class="window-row">
                <span class="window-dot window-dot--green"></span>
                <span class="window-label">Last meal by</span>
                <span class="window-time">{{ formatHour(windows.lastMealBy) }}</span>
              </div>
              <div class="window-row">
                <span class="window-dot window-dot--blue"></span>
                <span class="window-label">Bedtime target</span>
                <span class="window-time">{{ formatHour(windows.bedtimeTarget) }}</span>
              </div>
            </div>
          </div>

          <!-- 5. Recommendations card -->
          <div v-if="recs?.nudges?.length" class="card">
            <p class="section-kicker">Recommendations</p>
            <div class="nudge-list">
              <div v-for="(nudge, i) in recs.nudges" :key="i" class="nudge-row">
                <span class="nudge-dot"></span>
                <span class="nudge-text">{{ nudge }}</span>
              </div>
            </div>
          </div>

          <!-- 6. Today's log card -->
          <div class="card">
            <div class="log-card-header">
              <p class="section-kicker">Today's log</p>
              <button class="toggle-btn" @click="showLogForm = !showLogForm">
                {{ showLogForm ? 'Cancel' : (todayLog ? 'Edit' : 'Log today') }}
              </button>
            </div>

            <!-- Existing log summary when form is hidden -->
            <div v-if="todayLog && !showLogForm" class="log-summary">
              <div class="metric-grid">
                <div class="card-metric">
                  <span class="metric-label">Day type</span>
                  <strong class="metric-value">{{ todayLog.day_type }}</strong>
                </div>
                <div class="card-metric">
                  <span class="metric-label">Energy wake</span>
                  <strong class="metric-value">{{ todayLog.energy_wake ?? '—' }}<span class="metric-unit">/10</span></strong>
                </div>
                <div class="card-metric">
                  <span class="metric-label">Energy noon</span>
                  <strong class="metric-value">{{ todayLog.energy_noon ?? '—' }}<span class="metric-unit">/10</span></strong>
                </div>
                <div class="card-metric">
                  <span class="metric-label">Energy evening</span>
                  <strong class="metric-value">{{ todayLog.energy_evening ?? '—' }}<span class="metric-unit">/10</span></strong>
                </div>
              </div>
              <div v-if="todayLog.meal_first || todayLog.meal_last" class="log-meals">
                <span v-if="todayLog.meal_first" class="meal-item">First meal: {{ todayLog.meal_first }}</span>
                <span v-if="todayLog.meal_last" class="meal-item">Last meal: {{ todayLog.meal_last }}</span>
              </div>
              <div class="morning-light-row">
                <span class="metric-label">Morning light</span>
                <span class="metric-value" :class="todayLog.morning_light ? 'text-green' : 'text-subtle'">
                  {{ todayLog.morning_light ? 'Yes' : 'No' }}
                </span>
              </div>
            </div>

            <div v-else-if="!todayLog && !showLogForm" class="empty-log">
              <span class="empty-text">No entry for today.</span>
            </div>

            <!-- Log form -->
            <div v-if="showLogForm" class="log-form">

              <!-- Day type -->
              <div class="form-section">
                <span class="form-label">Day type</span>
                <div class="type-btns">
                  <button
                    class="type-btn"
                    :class="{ 'type-btn--active': formDayType === 'work' }"
                    @click="selectDayType('work')"
                  >Work</button>
                  <button
                    class="type-btn"
                    :class="{ 'type-btn--active': formDayType === 'free' }"
                    @click="selectDayType('free')"
                  >Free day</button>
                </div>
              </div>

              <!-- Energy at wake -->
              <div class="form-section">
                <span class="form-label">Energy at wake</span>
                <div class="energy-selector">
                  <button
                    v-for="n in 11"
                    :key="n - 1"
                    class="energy-box"
                    :class="{ 'energy-box--active': formEnergyWake === n - 1 }"
                    @click="selectEnergy('wake', n - 1)"
                  >{{ n - 1 }}</button>
                </div>
              </div>

              <!-- Energy at noon -->
              <div class="form-section">
                <span class="form-label">Energy at noon</span>
                <div class="energy-selector">
                  <button
                    v-for="n in 11"
                    :key="n - 1"
                    class="energy-box"
                    :class="{ 'energy-box--active': formEnergyNoon === n - 1 }"
                    @click="selectEnergy('noon', n - 1)"
                  >{{ n - 1 }}</button>
                </div>
              </div>

              <!-- Energy at evening -->
              <div class="form-section">
                <span class="form-label">Energy at evening</span>
                <div class="energy-selector">
                  <button
                    v-for="n in 11"
                    :key="n - 1"
                    class="energy-box"
                    :class="{ 'energy-box--active': formEnergyEvening === n - 1 }"
                    @click="selectEnergy('evening', n - 1)"
                  >{{ n - 1 }}</button>
                </div>
              </div>

              <!-- Meal times -->
              <div class="form-section form-row">
                <div class="form-field">
                  <span class="form-label">First meal</span>
                  <input v-model="formMealFirst" type="time" class="form-input" />
                </div>
                <div class="form-field">
                  <span class="form-label">Last meal</span>
                  <input v-model="formMealLast" type="time" class="form-input" />
                </div>
              </div>

              <!-- Morning light -->
              <div class="form-section">
                <span class="form-label">Got outdoor light before 9 AM</span>
                <button
                  class="light-toggle"
                  :class="{ 'light-toggle--yes': formMorningLight }"
                  @click="formMorningLight = !formMorningLight"
                >{{ formMorningLight ? 'Yes' : 'No' }}</button>
              </div>

              <!-- Save -->
              <button class="save-btn" @click="saveLog">Save</button>
            </div>
          </div>

        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { IonPage, IonHeader, IonContent, onIonViewWillEnter, toastController } from '@ionic/vue';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import HealthSectionTabs from '@/features/health/components/HealthSectionTabs.vue';

import {
  computeCircadianProfile,
  computeCircadianScore,
  computeAlertnessCurve,
  computeCircadianWindows,
  computeCircadianRecommendations,
  type SleepRecord,
  type DayType,
  type CircadianProfile,
  type CircadianScore,
  type AlertnessPoint,
  type CircadianWindows,
  type CircadianRecommendations,
} from '@/shared/health/circadian';

import {
  getRecentSleepSessions,
  getLatestHealthMetric,
  getRecentHealthMetrics,
  upsertCircadianLog,
  getCircadianLog,
  getRecentCircadianLogs,
  type CircadianLogEntry,
} from '@/shared/db/app_db';
import { hapticMedium, hapticSelect, hapticSuccess } from '@/shared/utils/haptics';

// ── State ─────────────────────────────────────────────────────────────────────

const profile = ref<CircadianProfile | null>(null);
const score = ref<CircadianScore | null>(null);
const alertnessCurve = ref<AlertnessPoint[]>([]);
const windows = ref<CircadianWindows | null>(null);
const recs = ref<CircadianRecommendations | null>(null);
const todayLog = ref<CircadianLogEntry | null>(null);
const loading = ref(true);
const avgWakeHour = ref(7.0);

// Daily log form state
const formDayType = ref<'work' | 'free'>('work');
const formEnergyWake = ref<number | null>(null);
const formEnergyNoon = ref<number | null>(null);
const formEnergyEvening = ref<number | null>(null);
const formMealFirst = ref('');
const formMealLast = ref('');
const formMorningLight = ref(false);
const showLogForm = ref(false);

// ── Computed ──────────────────────────────────────────────────────────────────

const currentHour = computed(() => new Date().getHours());

const peakPoint = computed<AlertnessPoint | null>(() => {
  if (!alertnessCurve.value.length) return null;
  return alertnessCurve.value.reduce((best, p) =>
    p.alertness > best.alertness ? p : best
  );
});

const scoreColorClass = computed(() => {
  const t = score.value?.total ?? 0;
  if (t >= 70) return 'score--green';
  if (t >= 45) return 'score--yellow';
  return 'score--red';
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatHour = (h: number): string => {
  const norm = ((h % 24) + 24) % 24;
  const hh = Math.floor(norm);
  const mm = Math.round((norm - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

// ── Data loading ──────────────────────────────────────────────────────────────

const loadData = async () => {
  loading.value = true;
  const today = new Date().toISOString().slice(0, 10);
  try {

  const sessions = await getRecentSleepSessions(30);
  const sleepRecords: SleepRecord[] = sessions.map(s => ({
    date: s.date,
    bedtime: s.bedtime,
    waketime: s.waketime,
    timeAsleepHours: s.time_asleep_hours,
    efficiency: s.efficiency,
  }));

  const logs = await getRecentCircadianLogs(30);
  const dayTypes = new Map<string, DayType>(
    logs.map(l => [l.date, l.day_type as DayType])
  );

  const rhrMetric = await getLatestHealthMetric('resting_heart_rate');
  const rhrHistory = await getRecentHealthMetrics('resting_heart_rate', 14);
  const rhrBaseline = rhrHistory.length
    ? rhrHistory.reduce((s, m) => s + Number(m.value), 0) / rhrHistory.length
    : null;
  const rhrToday = rhrMetric ? Number(rhrMetric.value) : null;

  const computedProfile = computeCircadianProfile(sleepRecords, dayTypes);
  profile.value = computedProfile;
  score.value = computeCircadianScore(sleepRecords, rhrToday, rhrBaseline);

  avgWakeHour.value = sleepRecords.length
    ? sleepRecords.slice(0, 7).reduce((s, r) => {
        const d = new Date(r.waketime);
        return s + d.getHours() + d.getMinutes() / 60;
      }, 0) / Math.min(sleepRecords.length, 7)
    : 7.0;

  alertnessCurve.value = computeAlertnessCurve(computedProfile, avgWakeHour.value);
  const w = computeCircadianWindows(computedProfile, avgWakeHour.value);
  windows.value = w;
  recs.value = computeCircadianRecommendations(computedProfile, w, computedProfile.socialJetlag, []);

  const log = await getCircadianLog(today);
  todayLog.value = log;
  if (log) {
    formDayType.value = log.day_type as 'work' | 'free';
    formEnergyWake.value = log.energy_wake;
    formEnergyNoon.value = log.energy_noon;
    formEnergyEvening.value = log.energy_evening;
    formMealFirst.value = log.meal_first ?? '';
    formMealLast.value = log.meal_last ?? '';
    formMorningLight.value = log.morning_light === 1;
  }

  } catch (e) {
    console.error('[CircadianPage] loadData failed:', e);
  } finally {
    loading.value = false;
  }
};

onIonViewWillEnter(loadData);

// ── Save log ──────────────────────────────────────────────────────────────────

const selectDayType = (type: 'work' | 'free') => {
  hapticSelect();
  formDayType.value = type;
};

const selectEnergy = (field: 'wake' | 'noon' | 'evening', value: number) => {
  hapticSelect();
  if (field === 'wake') formEnergyWake.value = value;
  else if (field === 'noon') formEnergyNoon.value = value;
  else formEnergyEvening.value = value;
};

const saveLog = async () => {
  hapticMedium();
  const today = new Date().toISOString().slice(0, 10);
  await upsertCircadianLog({
    date: today,
    day_type: formDayType.value,
    energy_wake: formEnergyWake.value,
    energy_noon: formEnergyNoon.value,
    energy_evening: formEnergyEvening.value,
    meal_first: formMealFirst.value || null,
    meal_last: formMealLast.value || null,
    morning_light: formMorningLight.value ? 1 : 0,
    notes: null,
  });
  showLogForm.value = false;
  await loadData();
  hapticSuccess();
  const t = await toastController.create({ message: 'Day logged.', duration: 1600, color: 'success' });
  await t.present();
};
</script>

<style scoped>
/* ── Page shell ─────────────────────────────────────────────────────────────── */
.circadian-content {
  --background: #000;
}

.circadian-shell {
  max-width: 760px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── Cards ──────────────────────────────────────────────────────────────────── */
.card {
  background: var(--ion-color-primary);
  border-radius: 12px;
  padding: 18px;
}

.section-kicker {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: rgba(255, 255, 255, 0.5);
  margin: 0 0 12px 0;
}

/* ── Metric tiles ───────────────────────────────────────────────────────────── */
.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-top: 12px;
}

.card-metric {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-metric--warn {
  border: 1px solid rgba(239, 68, 68, 0.35);
}

.metric-sub {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.3);
  letter-spacing: 0.03em;
}

.metric-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.5);
}

.metric-value {
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 600;
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.metric-unit {
  font-size: 0.72rem;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.4);
}

/* ── Chronotype ─────────────────────────────────────────────────────────────── */
.chronotype-hero {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;
}

.chronotype-label {
  font-size: 1.4rem;
  font-weight: 700;
  text-transform: capitalize;
  color: rgba(255, 255, 255, 0.85);
}

.chronotype-label--early {
  color: rgb(34, 197, 94);
}

.chronotype-label--intermediate {
  color: rgb(255, 215, 0);
}

.chronotype-label--late {
  color: rgb(239, 68, 68);
}

.quality-badge {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 3px 8px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.5);
}

.quality-badge--high {
  border-color: rgba(34, 197, 94, 0.4);
  color: rgb(34, 197, 94);
}

.quality-badge--medium {
  border-color: rgba(255, 215, 0, 0.4);
  color: rgb(255, 215, 0);
}

.quality-badge--low {
  border-color: rgba(239, 68, 68, 0.4);
  color: rgb(239, 68, 68);
}

.warn-flag {
  font-size: 0.68rem;
  font-weight: 400;
  color: rgb(239, 68, 68);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* ── Score ──────────────────────────────────────────────────────────────────── */
.score-hero {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.score-number {
  font-size: 2.6rem;
  font-weight: 700;
  line-height: 1;
  min-width: 64px;
}

.score-number.score--green { color: rgb(34, 197, 94); }
.score-number.score--yellow { color: rgb(255, 215, 0); }
.score-number.score--red { color: rgb(239, 68, 68); }

.score-bar-track {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.score-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.4s ease;
}

.score-bar-fill.score--green { background: rgb(34, 197, 94); }
.score-bar-fill.score--yellow { background: rgb(255, 215, 0); }
.score-bar-fill.score--red { background: rgb(239, 68, 68); }

.component-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

/* ── Alertness curve SVG ────────────────────────────────────────────────────── */
.curve-wrap {
  width: 100%;
  overflow: hidden;
  border-radius: 6px;
}

.alertness-svg {
  width: 100%;
  height: 80px;
  display: block;
}

.sleep-band {
  fill: rgba(255, 255, 255, 0.05);
}

.sleep-band-label {
  fill: rgba(255, 255, 255, 0.25);
  font-size: 0.8px;
  font-family: sans-serif;
}

.curve-area {
  fill: rgba(239, 68, 68, 0.15);
}

.curve-line {
  fill: none;
  stroke: rgb(239, 68, 68);
  stroke-width: 0.3;
  vector-effect: non-scaling-stroke;
  stroke-linejoin: round;
}

.now-line {
  stroke: rgba(255, 255, 255, 0.3);
  stroke-width: 0.25;
  stroke-dasharray: 0.5 0.4;
  vector-effect: non-scaling-stroke;
}

.peak-label {
  fill: rgba(255, 255, 255, 0.6);
  font-size: 0.9px;
  font-family: sans-serif;
}

.axis-labels {
  display: flex;
  justify-content: space-between;
  padding: 4px 0 0;
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.35);
}

.curve-empty {
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.3);
}

/* ── Timing windows ─────────────────────────────────────────────────────────── */
.windows-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.window-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.window-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.window-dot--red    { background: rgb(239, 68, 68); }
.window-dot--yellow { background: rgb(255, 215, 0); }
.window-dot--green  { background: rgb(34, 197, 94); }
.window-dot--blue   { background: rgb(96, 165, 250); }

.window-label {
  flex: 1;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.6);
}

.window-time {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
}

/* ── Recommendations ────────────────────────────────────────────────────────── */
.nudge-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.nudge-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.nudge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgb(239, 68, 68);
  flex-shrink: 0;
  margin-top: 5px;
}

.nudge-text {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.5;
}

/* ── Log card ───────────────────────────────────────────────────────────────── */
.log-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.log-card-header .section-kicker {
  margin: 0;
}

.toggle-btn {
  font-size: 0.78rem;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  padding: 5px 12px;
  cursor: pointer;
}

.log-summary {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}

.log-meals {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.meal-item {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.55);
}

.morning-light-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.text-green  { color: rgb(34, 197, 94); }
.text-subtle { color: rgba(255, 255, 255, 0.4); }

.empty-log {
  margin-top: 8px;
}

.empty-text {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.3);
}

/* ── Log form ───────────────────────────────────────────────────────────────── */
.log-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 12px;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-row {
  flex-direction: row;
  gap: 12px;
}

.form-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.5);
}

.type-btns {
  display: flex;
  gap: 8px;
}

.type-btn {
  flex: 1;
  padding: 9px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.type-btn--active {
  background: rgb(239, 68, 68);
  border-color: rgb(239, 68, 68);
  color: #fff;
  font-weight: 600;
}

.energy-selector {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.energy-box {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.78rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s, border-color 0.12s;
}

.energy-box--active {
  background: rgb(239, 68, 68);
  border-color: rgb(239, 68, 68);
  color: #fff;
  font-weight: 600;
}

.form-input {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #fff;
  padding: 9px 12px;
  font-size: 0.9rem;
  width: 100%;
  box-sizing: border-box;
  color-scheme: dark;
}

.light-toggle {
  align-self: flex-start;
  padding: 8px 18px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.light-toggle--yes {
  background: rgba(34, 197, 94, 0.18);
  border-color: rgba(34, 197, 94, 0.5);
  color: rgb(34, 197, 94);
  font-weight: 600;
}

.save-btn {
  width: 100%;
  padding: 12px;
  background: rgb(239, 68, 68);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
}

/* ── Loading ────────────────────────────────────────────────────────────────── */
.loading-state {
  padding: 48px 0;
  text-align: center;
}

.loading-text {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.3);
}
</style>
