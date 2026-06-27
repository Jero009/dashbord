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
          <ion-spinner name="crescent" class="loading-spinner" />
          <span class="loading-text">Loading…</span>
        </div>

        <template v-else>

          <!-- 1. Chronotype + sleep rhythm card -->
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
              >{{ profile.dataQuality }}</span>
            </div>

            <div class="metric-grid">
              <div class="card-metric">
                <span class="metric-label">Avg bedtime</span>
                <strong class="metric-value">{{ profile?.avgSleepOnset != null ? formatHour(profile.avgSleepOnset) : '—' }}</strong>
              </div>
              <div class="card-metric">
                <span class="metric-label">Avg wake</span>
                <strong class="metric-value">{{ profile?.avgWakeTime != null ? formatHour(profile.avgWakeTime) : '—' }}</strong>
              </div>
              <div class="card-metric">
                <span class="metric-label">Melatonin onset</span>
                <strong class="metric-value">{{ profile?.dlmoEstimate != null ? formatHour(profile.dlmoEstimate) : '—' }}</strong>
                <span class="metric-sub">est. sleep drive start</span>
              </div>
              <div class="card-metric">
                <span class="metric-label">Temp minimum (Tmin)</span>
                <strong class="metric-value">
                  {{ melatoninWindows ? formatHour(melatoninWindows.tminHour) : (profile?.ctminEstimate != null ? formatHour(profile.ctminEstimate) : '—') }}
                  <span v-if="melatoninWindows" class="tmin-source-inline" :class="melatoninWindows.source === 'hr' ? 'tmin-source-inline--hr' : ''">
                    {{ melatoninWindows.source === 'hr' ? 'measured' : 'est' }}
                  </span>
                </strong>
                <span class="metric-sub">{{ melatoninWindows?.source === 'hr' ? 'HR nadir · last night' : 'deepest sleep marker' }}</span>
              </div>
              <div class="card-metric">
                <span class="metric-label">Free-day midpoint</span>
                <strong class="metric-value">{{ profile?.msfsc != null ? formatHour(profile.msfsc) : '—' }}</strong>
                <span class="metric-sub">MSFsc chronotype</span>
              </div>
              <div class="card-metric" :class="{ 'card-metric--warn': (profile?.socialJetlag ?? 0) > 1.5 }">
                <span class="metric-label">Social jetlag</span>
                <strong class="metric-value">
                  {{ profile?.socialJetlag != null ? profile.socialJetlag.toFixed(1) + ' h' : '—' }}
                  <span v-if="(profile?.socialJetlag ?? 0) > 1.5" class="warn-flag">HIGH</span>
                </strong>
                <span class="metric-sub">work vs free-day offset</span>
              </div>
            </div>
          </div>

          <!-- 2+3. Alertness curve + timeline — single unified scrollable card -->
          <div class="card">
            <div class="curve-header">
              <p class="section-kicker">Today</p>
              <div v-if="alertnessCurve.length" class="curve-now-badge">
                <span class="curve-now-label">Now</span>
                <span class="curve-now-value">{{ currentAlertnessLabel }}</span>
              </div>
            </div>

            <div v-if="!alertnessCurve.length" class="curve-empty">Not enough data</div>

            <div v-else class="unified-scroll-wrap">
              <!-- Fixed Y-axis (does not scroll) -->
              <div class="y-axis">
                <span class="y-label">High</span>
                <span class="y-label">Mid</span>
                <span class="y-label">Low</span>
              </div>

              <!-- Scrollable area -->
              <div class="timeline-scroll" ref="timelineRef">
                <div class="timeline-inner">

                  <!-- Hour ruler -->
                  <div class="timeline-ruler">
                    <div v-for="h in 25" :key="h-1" class="timeline-hour" :style="{ left: ((h-1) * HOUR_PX) + 'px' }">
                      {{ String(h-1).padStart(2,'0') }}
                    </div>
                  </div>

                  <!-- Alertness curve SVG — same 52px/h scale -->
                  <div class="curve-svg-row">
                    <svg
                      :width="24 * HOUR_PX"
                      height="100"
                      class="alertness-svg-scroll"
                      aria-hidden="true"
                    >
                      <!-- Sleep bands -->
                      <template v-if="windows">
                        <rect :x="windows.bedtimeTarget * HOUR_PX" y="0" :width="(24 - windows.bedtimeTarget) * HOUR_PX" height="100" class="band-sleep" />
                        <rect x="0" y="0" :width="avgWakeHour * HOUR_PX" height="100" class="band-sleep" />
                      </template>
                      <!-- Window bands -->
                      <template v-if="windows">
                        <rect v-if="windows.exerciseMorning" :x="windows.exerciseMorning.start * HOUR_PX" y="0" :width="(windows.exerciseMorning.end - windows.exerciseMorning.start) * HOUR_PX" height="100" class="band-exercise" />
                        <rect v-if="windows.exerciseAfternoon" :x="windows.exerciseAfternoon.start * HOUR_PX" y="0" :width="(windows.exerciseAfternoon.end - windows.exerciseAfternoon.start) * HOUR_PX" height="100" class="band-exercise" />
                        <rect :x="windows.cognitiveStart * HOUR_PX" y="0" :width="(windows.cognitiveEnd - windows.cognitiveStart) * HOUR_PX" height="100" class="band-cognitive" />
                      </template>
                      <!-- Vertical grid every hour -->
                      <line v-for="h in 23" :key="h" :x1="h * HOUR_PX" y1="0" :x2="h * HOUR_PX" y2="100" class="grid-line" />
                      <!-- Midline -->
                      <line x1="0" y1="50" :x2="24 * HOUR_PX" y2="50" class="mid-line" />
                      <!-- Curve area + line -->
                      <polygon :points="areaPointsScroll" class="curve-area" />
                      <polyline :points="linePointsScroll" class="curve-line" />
                      <!-- Now line -->
                      <line :x1="currentHour * HOUR_PX" y1="0" :x2="currentHour * HOUR_PX" y2="100" class="now-line" />
                      <!-- Now dot -->
                      <circle v-if="nowPoint" :cx="nowPoint.hour * HOUR_PX" :cy="toYScroll(nowPoint.alertness)" r="4" class="now-dot" />
                      <!-- Peak -->
                      <template v-if="peakPoint">
                        <circle :cx="peakPoint.hour * HOUR_PX" :cy="toYScroll(peakPoint.alertness)" r="3.5" class="peak-dot" />
                        <text :x="peakPoint.hour * HOUR_PX" :y="toYScroll(peakPoint.alertness) - 7" class="peak-label" text-anchor="middle">{{ formatHour(peakPoint.hour) }}</text>
                      </template>
                      <!-- Band labels -->
                      <template v-if="windows">
                        <text v-if="windows.exerciseMorning" :x="(windows.exerciseMorning.start + windows.exerciseMorning.end) / 2 * HOUR_PX" y="94" class="band-label" text-anchor="middle">exercise</text>
                        <text v-if="windows.exerciseAfternoon" :x="(windows.exerciseAfternoon.start + windows.exerciseAfternoon.end) / 2 * HOUR_PX" y="94" class="band-label" text-anchor="middle">exercise</text>
                        <text :x="(windows.cognitiveStart + windows.cognitiveEnd) / 2 * HOUR_PX" y="94" class="band-label band-label--focus" text-anchor="middle">focus</text>
                      </template>
                    </svg>
                  </div>

                  <!-- Unified activity row: wake-anchored blocks + Tmin-anchored blocks in one line.
                       When measured Tmin is available both sets share the same anchor, so the
                       Tmin deep-focus peak sits naturally inside the broader cognitive-peak band. -->
                  <div class="timeline-bar-row" v-if="windows">
                    <div class="tl-block tl-block--sleep" :style="{ left: '0px', width: (avgWakeHour * HOUR_PX) + 'px' }"><span class="tl-block-label">Sleep</span></div>
                    <!-- Morning light (Tmin+2h, 30 min) — only when Tmin data exists -->
                    <div v-if="tminPos" class="tl-block tl-block--light" :style="{ left: (tminPos.lightStart * HOUR_PX) + 'px', width: (tminPos.lightWidthH * HOUR_PX) + 'px' }"><span class="tl-block-label">Light</span></div>
                    <div v-if="windows.exerciseMorning" class="tl-block tl-block--exercise" :style="{ left: (windows.exerciseMorning.start * HOUR_PX) + 'px', width: ((windows.exerciseMorning.end - windows.exerciseMorning.start) * HOUR_PX) + 'px' }"><span class="tl-block-label">Exercise</span></div>
                    <!-- Cognitive peak — broader zone (ctmin+2→+8); red band -->
                    <div class="tl-block tl-block--focus" :style="{ left: (windows.cognitiveStart * HOUR_PX) + 'px', width: ((windows.cognitiveEnd - windows.cognitiveStart) * HOUR_PX) + 'px' }"><span class="tl-block-label">Focus</span></div>
                    <!-- Deep focus peak — Tmin+4→+7, subset of cognitive zone; green highlight -->
                    <div v-if="tminPos" class="tl-block tl-block--deepfocus" :style="{ left: (tminPos.focusStart * HOUR_PX) + 'px', width: (tminPos.focusWidthH * HOUR_PX) + 'px' }"><span class="tl-block-label">Peak</span></div>
                    <div v-if="windows.exerciseAfternoon" class="tl-block tl-block--exercise" :style="{ left: (windows.exerciseAfternoon.start * HOUR_PX) + 'px', width: ((windows.exerciseAfternoon.end - windows.exerciseAfternoon.start) * HOUR_PX) + 'px' }"><span class="tl-block-label">Exercise</span></div>
                    <!-- Strength peak (Tmin+10h, 30 min) -->
                    <div v-if="tminPos" class="tl-block tl-block--strength" :style="{ left: (tminPos.strengthStart * HOUR_PX) + 'px', width: (tminPos.strengthWidthH * HOUR_PX) + 'px' }"><span class="tl-block-label">Strength</span></div>
                    <div class="tl-block tl-block--sleep" :style="{ left: (windows.bedtimeTarget * HOUR_PX) + 'px', width: ((24 - windows.bedtimeTarget) * HOUR_PX) + 'px' }"><span class="tl-block-label">Sleep</span></div>
                    <div class="tl-now" :style="{ left: (currentHour * HOUR_PX) + 'px' }"></div>
                  </div>

                  <!-- Event pins row: wake-anchored pins + melatonin curfew from Tmin -->
                  <div class="timeline-pins-row" v-if="windows">
                    <div class="tl-pin" :style="{ left: (windows.lastMealBy * HOUR_PX) + 'px' }">
                      <div class="tl-pin-line"></div>
                      <span class="tl-pin-label">Last meal<br/>{{ formatHour(windows.lastMealBy) }}</span>
                    </div>
                    <!-- Melatonin onset: prefer measured Tmin−9h, fall back to DLMO estimate -->
                    <div v-if="tminPos" class="tl-pin tl-pin--mel" :style="{ left: (tminPos.curfew * HOUR_PX) + 'px' }">
                      <div class="tl-pin-line"></div>
                      <span class="tl-pin-label">Dim screens<br/>{{ formatHour(tminPos.curfew) }}</span>
                    </div>
                    <div v-else-if="profile?.dlmoEstimate != null" class="tl-pin tl-pin--dim" :style="{ left: (profile.dlmoEstimate * HOUR_PX) + 'px' }">
                      <div class="tl-pin-line"></div>
                      <span class="tl-pin-label">Dim screens<br/>{{ formatHour(profile.dlmoEstimate) }}</span>
                    </div>
                    <div class="tl-pin tl-pin--sleep" :style="{ left: (windows.bedtimeTarget * HOUR_PX) + 'px' }">
                      <div class="tl-pin-line"></div>
                      <span class="tl-pin-label">Bedtime<br/>{{ formatHour(windows.bedtimeTarget) }}</span>
                    </div>
                  </div>

                </div>
              </div><!-- end timeline-scroll -->
            </div><!-- end unified-scroll-wrap -->

            <!-- What's happening now -->
            <div class="now-activity">
              <span class="now-activity-label">Now</span>
              <span class="now-activity-value">{{ nowActivityLabel }}</span>
            </div>

            <!-- Legend -->
            <div class="legend-row">
              <span class="legend-item"><span class="legend-dot legend-dot--red"></span>Alertness</span>
              <span class="legend-item"><span class="legend-swatch legend-swatch--red"></span>Focus</span>
              <span class="legend-item"><span class="legend-swatch legend-swatch--white"></span>Exercise</span>
              <span class="legend-item"><span class="legend-swatch legend-swatch--sleep"></span>Sleep</span>
              <span v-if="tminPos" class="legend-item"><span class="legend-swatch legend-swatch--light"></span>Light</span>
              <span v-if="tminPos" class="legend-item"><span class="legend-swatch legend-swatch--deepfocus"></span>Peak</span>
              <span v-if="tminPos" class="legend-item"><span class="legend-swatch legend-swatch--strength"></span>Strength</span>
            </div>
          </div>

          <!-- 4. Circadian Health Score card -->
          <div class="card">
            <p class="section-kicker">Health score</p>
            <div class="score-hero">
              <span class="score-number" :class="scoreColorClass">{{ score?.total ?? '—' }}</span>
              <div class="score-bar-track">
                <div class="score-bar-fill" :class="scoreColorClass" :style="{ width: (score?.total ?? 0) + '%' }"></div>
              </div>
            </div>
            <div class="score-grid">
              <div class="score-component">
                <span class="metric-label">Consistency</span>
                <div class="mini-bar-track"><div class="mini-bar-fill" :style="{ width: (score?.consistency ?? 0) + '%' }"></div></div>
                <strong class="score-val">{{ score?.consistency ?? '—' }}</strong>
              </div>
              <div class="score-component">
                <span class="metric-label">Amplitude</span>
                <div class="mini-bar-track"><div class="mini-bar-fill" :style="{ width: (score?.amplitude ?? 0) + '%' }"></div></div>
                <strong class="score-val">{{ score?.amplitude ?? '—' }}</strong>
              </div>
              <div class="score-component">
                <span class="metric-label">Efficiency</span>
                <div class="mini-bar-track"><div class="mini-bar-fill" :style="{ width: (score?.efficiency ?? 0) + '%' }"></div></div>
                <strong class="score-val">{{ score?.efficiency ?? '—' }}</strong>
              </div>
              <div class="score-component">
                <span class="metric-label">Recovery</span>
                <div class="mini-bar-track"><div class="mini-bar-fill" :style="{ width: (score?.recovery ?? 0) + '%' }"></div></div>
                <strong class="score-val">{{ score?.recovery ?? '—' }}</strong>
              </div>
              <div class="score-component">
                <span class="metric-label">Light</span>
                <div class="mini-bar-track"><div class="mini-bar-fill" :style="{ width: (score?.light ?? 0) + '%' }"></div></div>
                <strong class="score-val">{{ score?.light ?? '—' }}</strong>
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
            <div v-if="recs.socialJetlagWarning" class="jetlag-warning">
              <span class="jetlag-text">{{ recs.socialJetlagWarning }}</span>
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
              <span class="empty-text">No entry</span>
            </div>

            <div v-if="showLogForm" class="log-form">
              <div class="form-section">
                <span class="form-label">Day type</span>
                <div class="type-btns">
                  <button class="type-btn" :class="{ 'type-btn--active': formDayType === 'work' }" @click="selectDayType('work')">Work</button>
                  <button class="type-btn" :class="{ 'type-btn--active': formDayType === 'free' }" @click="selectDayType('free')">Free day</button>
                </div>
              </div>

              <div class="form-section">
                <span class="form-label">Energy at wake</span>
                <div class="energy-selector">
                  <button v-for="n in 11" :key="n - 1" class="energy-box" :class="{ 'energy-box--active': formEnergyWake === n - 1 }" @click="selectEnergy('wake', n - 1)">{{ n - 1 }}</button>
                </div>
              </div>

              <div class="form-section">
                <span class="form-label">Energy at noon</span>
                <div class="energy-selector">
                  <button v-for="n in 11" :key="n - 1" class="energy-box" :class="{ 'energy-box--active': formEnergyNoon === n - 1 }" @click="selectEnergy('noon', n - 1)">{{ n - 1 }}</button>
                </div>
              </div>

              <div class="form-section">
                <span class="form-label">Energy at evening</span>
                <div class="energy-selector">
                  <button v-for="n in 11" :key="n - 1" class="energy-box" :class="{ 'energy-box--active': formEnergyEvening === n - 1 }" @click="selectEnergy('evening', n - 1)">{{ n - 1 }}</button>
                </div>
              </div>

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

              <div class="form-section">
                <span class="form-label">Morning light</span>
                <button class="light-toggle" :class="{ 'light-toggle--yes': formMorningLight }" @click="formMorningLight = !formMorningLight">
                  {{ formMorningLight ? 'Yes' : 'No' }}
                </button>
              </div>

              <button class="save-btn" @click="saveLog">Save</button>
            </div>
          </div>

        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { IonPage, IonHeader, IonContent, IonSpinner, onIonViewWillEnter, toastController } from '@ionic/vue';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import HealthSectionTabs from '@/features/health/components/HealthSectionTabs.vue';

import {
  computeCircadianProfile,
  computeCircadianScore,
  computeAlertnessCurve,
  computeCircadianWindows,
  computeCircadianRecommendations,
  computeTmin,
  computeMelatoninWindows,
  type SleepRecord,
  type DayType,
  type CircadianProfile,
  type CircadianScore,
  type AlertnessPoint,
  type CircadianWindows,
  type CircadianRecommendations,
  type MelatoninWindows,
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
const melatoninWindows = ref<MelatoninWindows | null>(null);
const todayLog = ref<CircadianLogEntry | null>(null);
const loading = ref(true);
const avgWakeHour = ref(7.0);
const timelineRef = ref<HTMLElement | null>(null);

const HOUR_PX = 52; // pixels per hour in the timeline

const formDayType = ref<'work' | 'free'>('work');
const formEnergyWake = ref<number | null>(null);
const formEnergyNoon = ref<number | null>(null);
const formEnergyEvening = ref<number | null>(null);
const formMealFirst = ref('');
const formMealLast = ref('');
const formMorningLight = ref(false);
const showLogForm = ref(false);

// ── Computed ──────────────────────────────────────────────────────────────────

const currentHour = computed(() => {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60;
});

// SVG Y for the scrollable curve (fixed-pixel: height=100, usable 6–88)
const toYScroll = (alertness: number) => (1 - alertness) * 82 + 6;

const peakPoint = computed<AlertnessPoint | null>(() => {
  if (!alertnessCurve.value.length) return null;
  return alertnessCurve.value.reduce((best, p) => p.alertness > best.alertness ? p : best);
});

const nowPoint = computed<AlertnessPoint | null>(() => {
  if (!alertnessCurve.value.length) return null;
  const h = Math.round(currentHour.value);
  return alertnessCurve.value.find(p => p.hour === Math.min(h, 23)) ?? null;
});

const currentAlertnessLabel = computed(() => {
  const a = nowPoint.value?.alertness ?? 0;
  if (a >= 0.75) return 'High';
  if (a >= 0.5) return 'Moderate';
  if (a >= 0.25) return 'Low';
  return 'Very low';
});

const scoreColorClass = computed(() => {
  const t = score.value?.total ?? 0;
  if (t >= 70) return 'score--green';
  if (t >= 45) return 'score--yellow';
  return 'score--red';
});

// Scrollable SVG uses fixed pixel coords: x = hour * HOUR_PX
const linePointsScroll = computed(() =>
  alertnessCurve.value.map(p => `${p.hour * HOUR_PX},${toYScroll(p.alertness)}`).join(' ')
);

const areaPointsScroll = computed(() => {
  if (!alertnessCurve.value.length) return '';
  const pts = alertnessCurve.value.map(p => `${p.hour * HOUR_PX},${toYScroll(p.alertness)}`).join(' ');
  const first = alertnessCurve.value[0];
  const last = alertnessCurve.value[alertnessCurve.value.length - 1];
  return `${first.hour * HOUR_PX},100 ${pts} ${last.hour * HOUR_PX},100`;
});

const nowActivityLabel = computed(() => {
  const h = currentHour.value;
  const w = windows.value;
  if (!w) return '—';
  if (h < avgWakeHour.value) return 'Sleep';
  if (w.exerciseMorning && h >= w.exerciseMorning.start && h < w.exerciseMorning.end) return 'Morning exercise';
  if (h >= w.cognitiveStart && h < w.cognitiveEnd) return 'Deep work';
  if (w.exerciseAfternoon && h >= w.exerciseAfternoon.start && h < w.exerciseAfternoon.end) return 'Afternoon exercise';
  if (h >= w.lastMealBy - 0.1 && h < w.bedtimeTarget) return 'Wind down — stop eating';
  if (h >= w.bedtimeTarget) return 'Bedtime';
  return 'Rest';
});

// Timeline positions read directly from melatoninWindows so any model change auto-propagates.
// widthH fields drive block widths so the model's .end values are the single source of truth.
const tminPos = computed(() => {
  const mw = melatoninWindows.value;
  if (!mw) return null;
  const wrapDiff = (end: number, start: number) => {
    const d = end - start;
    return d >= 0 ? d : d + 24;
  };
  return {
    tmin:            mw.tminHour,
    lightStart:      mw.morningLight.start,
    lightWidthH:     wrapDiff(mw.morningLight.end, mw.morningLight.start),
    focusStart:      mw.deepFocus.start,
    focusWidthH:     wrapDiff(mw.deepFocus.end, mw.deepFocus.start),
    strengthStart:   mw.strengthPeak.start,
    strengthWidthH:  wrapDiff(mw.strengthPeak.end, mw.strengthPeak.start),
    curfew:          mw.melatoninOnset,
  };
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
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  try {
    const sessions = await getRecentSleepSessions(30);
    const sleepRecords: SleepRecord[] = sessions.map(s => ({
      date: s.date,
      bedtime: s.bedtime,
      waketime: s.waketime,
      timeAsleepHours: s.time_asleep_hours,
      efficiency: s.efficiency,
    }));

    // Compute avg wake hour first — used as the Tmin anchor for stable windows
    const localAvgWakeHour = sleepRecords.length
      ? sleepRecords.slice(0, 7).reduce((s, r) => {
          const d = new Date(r.waketime);
          return s + d.getHours() + d.getMinutes() / 60;
        }, 0) / Math.min(sleepRecords.length, 7)
      : 7.0;

    // Tmin: use avg wake time as the anchor so windows stay stable even after
    // an off-schedule night. We build a synthetic "today at avg-wake" ISO and pass
    // it as the wake boundary — this way both the HR search window and the estimated
    // fallback (wakeHour−1) are grounded in the 7-night average, not today's outlier.
    const lastSession = sessions[0];
    if (!lastSession) {
      melatoninWindows.value = null;
    } else {
      const avgWakeH = Math.floor(localAvgWakeHour);
      const avgWakeMin = Math.round((localAvgWakeHour - avgWakeH) * 60);
      const avgWakeDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), avgWakeH, avgWakeMin);
      const avgWakeIso = avgWakeDate.toISOString();

      let hrSamples: { t: string; v: number }[] = [];
      if (lastSession.hr_timeline_json) {
        try {
          hrSamples = JSON.parse(lastSession.hr_timeline_json);
        } catch {
          // corrupted stored JSON — treat as no overnight HR data
        }
      }
      const tminResult = computeTmin(hrSamples, lastSession.bedtime, avgWakeIso);
      melatoninWindows.value = computeMelatoninWindows(tminResult);
    }

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

    const lightFraction = logs.length ? logs.filter(l => l.morning_light === 1).length / logs.length : null;
    const computedProfile = computeCircadianProfile(sleepRecords, dayTypes);
    profile.value = computedProfile;
    score.value = computeCircadianScore(sleepRecords, rhrToday, rhrBaseline, lightFraction);

    avgWakeHour.value = localAvgWakeHour;

    // When HR data found last night's actual nadir, anchor both the alertness curve
    // (Process C phase) and the timing windows (cognitive peak, DLMO) to that measurement
    // instead of the 30-night MSFsc average.  This makes every derived time slot
    // reflect last night's biology rather than a chronic estimate.
    const measuredCtmin = melatoninWindows.value?.source === 'hr'
      ? melatoninWindows.value.tminHour
      : null;

    alertnessCurve.value = computeAlertnessCurve(computedProfile, avgWakeHour.value, measuredCtmin);
    const w = computeCircadianWindows(computedProfile, avgWakeHour.value, measuredCtmin);
    windows.value = w;
    recs.value = computeCircadianRecommendations(
      computedProfile, w, computedProfile.socialJetlag, [],
      logs.map(l => ({ energy_wake: l.energy_wake, energy_noon: l.energy_noon, energy_evening: l.energy_evening }))
    );

    // Scroll timeline to 2h before current time so "now" is visible
    await nextTick();
    if (timelineRef.value) {
      const targetScroll = Math.max(0, (currentHour.value - 2) * HOUR_PX);
      timelineRef.value.scrollLeft = targetScroll;
    }

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
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  await upsertCircadianLog({
    date: today,
    day_type: formDayType.value,
    energy_wake: formEnergyWake.value,
    energy_noon: formEnergyNoon.value,
    energy_evening: formEnergyEvening.value,
    meal_first: formMealFirst.value || null,
    meal_last: formMealLast.value || null,
    morning_light: formMorningLight.value ? 1 : 0,
    notes: todayLog.value?.notes ?? null,
  });
  showLogForm.value = false;
  await loadData();
  hapticSuccess();
  const t = await toastController.create({ message: 'logged', duration: 1600, color: 'success' });
  await t.present();
};
</script>

<style scoped>
/* ── Page shell ─────────────────────────────────────────────────────────────── */
.circadian-content {
  --background: var(--nt-bg);
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
  border-radius: var(--nt-radius-md);
  padding: 18px;
}

.section-kicker {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: rgba(var(--nt-ink), 0.5);
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
  background: rgba(var(--nt-ink), 0.05);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.card-metric--warn {
  border: 1px solid rgba(215, 26, 33, 0.35);
}

.metric-sub {
  font-size: 0.72rem;
  color: rgba(var(--nt-ink), 0.5);
}

.metric-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(var(--nt-ink), 0.5);
}

.metric-value {
  font-size: 0.95rem;
  color: rgba(var(--nt-ink), 0.85);
  font-weight: 600;
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.metric-unit {
  font-size: 0.72rem;
  font-weight: 400;
  color: rgba(var(--nt-ink), 0.5);
}

/* ── Chronotype ─────────────────────────────────────────────────────────────── */
.chronotype-hero {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}

.chronotype-label {
  font-size: 1.4rem;
  font-weight: 700;
  text-transform: capitalize;
  color: rgba(var(--nt-ink), 0.85);
}

.chronotype-label--early      { color: rgb(34, 197, 94); }
.chronotype-label--intermediate { color: rgba(var(--nt-ink), 0.85); }
.chronotype-label--late       { color: rgb(215, 26, 33); }

.quality-badge {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 2px 10px;
  border-radius: 999px;
  border: 1px solid rgba(var(--nt-ink), 0.1);
  color: rgba(var(--nt-ink), 0.5);
}

.quality-badge--high   { border-color: rgba(34, 197, 94, 0.4); color: rgb(34, 197, 94); }
.quality-badge--medium { border-color: rgba(var(--nt-ink), 0.12); color: rgba(var(--nt-ink), 0.85); }
.quality-badge--low    { border-color: rgba(215, 26, 33, 0.4); color: rgb(215, 26, 33); }

.warn-flag {
  font-size: 0.72rem;
  font-weight: 400;
  color: rgb(215, 26, 33);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

/* ── Alertness curve + timeline ─────────────────────────────────────────────── */
.curve-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.curve-header .section-kicker { margin-bottom: 0; }

.curve-now-badge {
  display: flex;
  align-items: center;
  gap: 6px;
}

.curve-now-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(var(--nt-ink), 0.4);
}

.curve-now-value {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgb(215, 26, 33);
}

.unified-scroll-wrap {
  display: flex;
  align-items: flex-start;
  gap: 0;
}

/* Y-axis stays fixed on the left */
.y-axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  /* height = SVG 100px, don't include ruler or bars */
  height: 100px;
  width: 30px;
  flex-shrink: 0;
  padding-right: 4px;
}

.y-label {
  font-size: 0.58rem;
  color: rgba(var(--nt-ink), 0.3);
  text-align: right;
  line-height: 1;
}

/* Scrollable area fills the rest */
.timeline-scroll {
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  flex: 1;
  min-width: 0;
  scrollbar-width: none;
}
.timeline-scroll::-webkit-scrollbar { display: none; }

.timeline-inner {
  width: 1248px; /* 52 * 24 */
  position: relative;
}

/* Hour ruler */
.timeline-ruler {
  position: relative;
  height: 22px;
  border-bottom: 1px solid rgba(var(--nt-ink), 0.07);
}

.timeline-hour {
  position: absolute;
  top: 4px;
  transform: translateX(-50%);
  font-size: 0.62rem;
  color: rgba(var(--nt-ink), 0.35);
  font-family: var(--nt-font-mono);
}

/* Alertness curve SVG row */
.curve-svg-row {
  background: rgba(var(--nt-ink), 0.02);
  border-bottom: 1px solid rgba(var(--nt-ink), 0.05);
}

.alertness-svg-scroll {
  display: block;
}

/* SVG elements */
.band-sleep    { fill: rgba(var(--nt-ink), 0.04); }
.band-exercise { fill: rgba(var(--nt-ink), 0.07); }
.band-cognitive { fill: rgba(215, 26, 33, 0.12); }

.grid-line {
  stroke: rgba(var(--nt-ink), 0.05);
  stroke-width: 1;
}

.mid-line {
  stroke: rgba(var(--nt-ink), 0.07);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}

.curve-area  { fill: rgba(215, 26, 33, 0.15); }

.curve-line {
  fill: none;
  stroke: rgb(215, 26, 33);
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.now-line {
  stroke: rgba(var(--nt-ink), 0.6);
  stroke-width: 1.5;
  stroke-dasharray: 4 3;
}

.now-dot  { fill: var(--nt-fg); }

.peak-dot {
  fill: rgb(215, 26, 33);
  stroke: var(--nt-fg);
  stroke-width: 1.5;
}

.peak-label {
  fill: rgba(var(--nt-ink), 0.7);
  font-size: 8px;
  font-family: sans-serif;
}

.band-label {
  fill: rgba(var(--nt-ink), 0.4);
  font-size: 7px;
  font-family: sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.band-label--focus { fill: rgba(215, 26, 33, 0.7); }

.curve-empty {
  padding: 32px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  color: rgba(var(--nt-ink), 0.5);
  text-align: center;
}

.legend-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.72rem;
  color: rgba(var(--nt-ink), 0.5);
}

.legend-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  flex-shrink: 0;
}

.legend-dot--red { background: rgb(215, 26, 33); }

.legend-swatch {
  width: 14px;
  height: 8px;
  border-radius: 2px;
  flex-shrink: 0;
}

.legend-swatch--red   { background: rgba(215, 26, 33, 0.3); }
.legend-swatch--white { background: rgba(var(--nt-ink), 0.12); }
.legend-swatch--sleep { background: rgba(var(--nt-ink), 0.06); border: 1px solid rgba(var(--nt-ink), 0.1); }

.timeline-bar-row {
  position: relative;
  height: 52px;
  margin: 6px 0;
}

.tl-block {
  position: absolute;
  top: 0;
  height: 100%;
  display: flex;
  align-items: center;
  padding: 0 8px;
  overflow: hidden;
  min-width: 4px;
}

.tl-block--sleep   { background: rgba(var(--nt-ink), 0.05); }
.tl-block--exercise {
  background: rgba(var(--nt-ink), 0.11);
  border-radius: 8px;
}
.tl-block--focus {
  background: rgba(215, 26, 33, 0.2);
  border: 1px solid rgba(215, 26, 33, 0.3);
  border-radius: 8px;
}

.tl-block-label {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(var(--nt-ink), 0.55);
  white-space: nowrap;
}

.tl-block--focus .tl-block-label { color: rgb(215, 26, 33); }

.tl-now {
  position: absolute;
  top: -6px;
  bottom: -6px;
  width: 2px;
  background: var(--nt-fg);
  border-radius: 999px;
  z-index: 2;
}

.timeline-pins-row {
  position: relative;
  height: 60px;
  border-top: 1px solid rgba(var(--nt-ink), 0.07);
}

.tl-pin {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.tl-pin-line {
  width: 1px;
  height: 8px;
  background: rgba(var(--nt-ink), 0.3);
}

.tl-pin--dim .tl-pin-line   { background: rgba(var(--nt-ink), 0.15); }
.tl-pin--sleep .tl-pin-line { background: rgba(var(--nt-ink), 0.2); }

.tl-pin-label {
  font-size: 0.6rem;
  color: rgba(var(--nt-ink), 0.55);
  text-align: center;
  line-height: 1.4;
  white-space: nowrap;
}

.tl-pin--dim .tl-pin-label   { color: rgba(var(--nt-ink), 0.35); }
.tl-pin--sleep .tl-pin-label { color: rgba(var(--nt-ink), 0.4); }

.now-activity {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(var(--nt-ink), 0.06);
}

.now-activity-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(var(--nt-ink), 0.4);
  white-space: nowrap;
}

.now-activity-value {
  font-size: 0.88rem;
  font-weight: 600;
  color: rgba(var(--nt-ink), 0.85);
}

/* ── Score ──────────────────────────────────────────────────────────────────── */
.score-hero {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.score-number {
  font-family: var(--nt-font-display);
  font-size: 2.8rem;
  font-weight: 700;
  line-height: 1;
  min-width: 72px;
}

.score-number.score--green  { color: rgb(34, 197, 94); }
.score-number.score--yellow { color: rgba(var(--nt-ink), 0.85); }
.score-number.score--red    { color: rgb(215, 26, 33); }

.score-bar-track {
  flex: 1;
  height: 4px;
  background: rgba(var(--nt-ink), 0.1);
  border-radius: 999px;
  overflow: hidden;
}

.score-bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 400ms ease;
}

.score-bar-fill.score--green  { background: rgb(34, 197, 94); }
.score-bar-fill.score--yellow { background: rgba(var(--nt-ink), 0.85); }
.score-bar-fill.score--red    { background: rgb(215, 26, 33); }

.score-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.score-component {
  display: grid;
  grid-template-columns: 100px 1fr 32px;
  align-items: center;
  gap: 10px;
}

.mini-bar-track {
  height: 4px;
  background: rgba(var(--nt-ink), 0.08);
  border-radius: 999px;
  overflow: hidden;
}

.mini-bar-fill {
  height: 100%;
  border-radius: 999px;
  background: rgba(var(--nt-ink), 0.3);
  transition: width 400ms ease;
}

.score-val {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(var(--nt-ink), 0.85);
  text-align: right;
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
  border-radius: 999px;
  background: rgb(215, 26, 33);
  flex-shrink: 0;
  margin-top: 6px;
}

.nudge-text {
  font-size: 0.9rem;
  color: rgba(var(--nt-ink), 0.85);
  line-height: 1.5;
}

.jetlag-warning {
  margin-top: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(215, 26, 33, 0.1);
  border: 1px solid rgba(215, 26, 33, 0.25);
}

.jetlag-text {
  font-size: 0.85rem;
  color: rgba(215, 26, 33, 0.9);
  line-height: 1.5;
}

/* ── Log card ───────────────────────────────────────────────────────────────── */
.log-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.log-card-header .section-kicker { margin: 0; }

.toggle-btn {
  font-size: 0.9rem;
  background: transparent;
  border: 1px solid rgba(var(--nt-ink), 0.1);
  border-radius: 8px;
  color: rgba(var(--nt-ink), 0.85);
  padding: 6px 12px;
  cursor: pointer;
  transition: border-color 150ms ease;
}

.log-summary {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}

.log-meals {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.meal-item {
  font-size: 0.9rem;
  color: rgba(var(--nt-ink), 0.5);
}

.morning-light-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.text-green  { color: rgb(34, 197, 94); }
.text-subtle { color: rgba(var(--nt-ink), 0.5); }

.empty-log { margin-top: 10px; }
.empty-text {
  font-size: 0.9rem;
  color: rgba(var(--nt-ink), 0.5);
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
  gap: 10px;
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
  color: rgba(var(--nt-ink), 0.5);
}

.type-btns {
  display: flex;
  gap: 10px;
}

.type-btn {
  flex: 1;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid rgba(var(--nt-ink), 0.1);
  background: transparent;
  color: rgba(var(--nt-ink), 0.5);
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease;
}

.type-btn--active {
  background: rgb(215, 26, 33);
  border-color: rgb(215, 26, 33);
  color: var(--nt-on-accent);
  font-weight: 600;
}

.energy-selector {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.energy-box {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid rgba(var(--nt-ink), 0.1);
  background: transparent;
  color: rgba(var(--nt-ink), 0.5);
  font-size: 0.72rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: background-color 150ms ease, border-color 150ms ease;
}

.energy-box::after {
  content: '';
  position: absolute;
  inset: -6px;
}

.energy-box--active {
  background: rgb(215, 26, 33);
  border-color: rgb(215, 26, 33);
  color: var(--nt-on-accent);
  font-weight: 600;
}

.form-input {
  background: rgba(var(--nt-ink), 0.06);
  border: 1px solid rgba(var(--nt-ink), 0.1);
  border-radius: 8px;
  color: var(--nt-fg);
  padding: 10px 12px;
  font-size: 0.9rem;
  width: 100%;
  box-sizing: border-box;
  color-scheme: var(--nt-color-scheme);
  transition: border-color 150ms ease;
}

.form-input:focus {
  border-color: rgb(215, 26, 33);
  outline: none;
}

.light-toggle {
  align-self: flex-start;
  padding: 10px 18px;
  border-radius: 8px;
  border: 1px solid rgba(var(--nt-ink), 0.1);
  background: transparent;
  color: rgba(var(--nt-ink), 0.5);
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease;
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
  background: rgb(215, 26, 33);
  border: none;
  border-radius: 8px;
  color: var(--nt-on-accent);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 150ms ease;
}

.save-btn:active {
  background: rgb(178, 19, 25);
}

/* ── Tmin timeline row ───────────────────────────────────────────────────────── */
.timeline-tmin-row {
  position: relative;
  height: 52px;
  border-top: 1px solid rgba(var(--nt-ink), 0.07);
  margin-top: 6px;
}

.tmin-spike {
  position: absolute;
  top: 6px;
  bottom: 6px;
  width: 2px;
  background: rgba(var(--nt-ink), 0.35);
  border-radius: 999px;
  transform: translateX(-50%);
}

.tl-block--light {
  background: rgba(255, 215, 0, 0.28);
  border: 1px solid rgba(255, 215, 0, 0.25);
  border-radius: 8px;
}
.tl-block--light .tl-block-label { color: rgba(255, 215, 0, 0.85); }

.tl-block--deepfocus {
  background: rgba(34, 197, 94, 0.22);
  border: 1px solid rgba(34, 197, 94, 0.18);
  border-radius: 8px;
}
.tl-block--deepfocus .tl-block-label { color: rgba(34, 197, 94, 0.85); }

.tl-block--strength {
  background: rgba(215, 26, 33, 0.42);
  border: 1px solid rgba(215, 26, 33, 0.3);
  border-radius: 8px;
}
.tl-block--strength .tl-block-label { color: rgba(var(--nt-ink), 0.85); }

.tl-pin--mel .tl-pin-line { background: rgba(var(--nt-ink), 0.22); }
.tl-pin--mel .tl-pin-label { color: rgba(var(--nt-ink), 0.38); }

/* Tmin source inline badge inside metric-value */
.tmin-source-inline {
  font-size: 0.62rem;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(var(--nt-ink), 0.35);
  margin-left: 4px;
}
.tmin-source-inline--hr { color: rgb(34, 197, 94); }

.legend-swatch--light     { background: rgba(255, 215, 0, 0.5); }
.legend-swatch--deepfocus { background: rgba(34, 197, 94, 0.45); }
.legend-swatch--strength  { background: rgba(215, 26, 33, 0.55); }


/* ── Loading ────────────────────────────────────────────────────────────────── */
.loading-state {
  padding: 48px 0;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.loading-spinner { color: rgb(215, 26, 33); }

.loading-text {
  font-size: 0.9rem;
  color: rgba(var(--nt-ink), 0.5);
}
</style>
