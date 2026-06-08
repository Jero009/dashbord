<template>
  <ion-page>
    <ion-header>
      <DashboardTopBar />
      <PlanSectionTabs />
    </ion-header>

    <ion-content :fullscreen="true">
      <div class="page-content">

        <!-- Today snapshot -->
        <div class="card today-card">
          <p class="section-kicker">Today · {{ todayLabel }}</p>
          <div class="snapshot-grid">
            <div class="snapshot-tile" @click="navTo('/plan/habits')">
              <span class="snapshot-value" :class="{ 'value--done': allHabitsDone }">
                {{ habitsDone }}<span class="snapshot-denom">/{{ habitsTotal }}</span>
              </span>
              <span class="snapshot-label">Habits</span>
            </div>
            <div class="snapshot-tile" @click="navTo('/plan/calendar')">
              <span class="snapshot-value snapshot-value--event" v-if="nextEvent">
                {{ nextEvent.time_start ? nextEvent.time_start.slice(0, 5) : 'All day' }}
              </span>
              <span class="snapshot-value snapshot-value--muted" v-else">—</span>
              <span class="snapshot-label">{{ nextEvent ? nextEvent.title : 'No events' }}</span>
            </div>
            <div class="snapshot-tile" @click="navTo('/plan/goals')">
              <span class="snapshot-value">{{ activeGoals }}</span>
              <span class="snapshot-label">Goals active</span>
            </div>
          </div>
        </div>

        <!-- Upcoming events strip -->
        <div v-if="upcomingEvents.length" class="card events-card">
          <p class="section-kicker">Events today</p>
          <ul class="event-list">
            <li v-for="ev in upcomingEvents" :key="ev.id" class="event-row">
              <span class="event-time">{{ ev.time_start ? ev.time_start.slice(0, 5) : '—' }}</span>
              <span class="event-dot" :class="`dot--${ev.type}`"></span>
              <span class="event-title">{{ ev.title }}</span>
              <span class="event-tag" :class="`tag--${ev.type}`">{{ ev.type }}</span>
            </li>
          </ul>
        </div>

        <!-- Nav tiles -->
        <p class="section-kicker nav-kicker">Sections</p>
        <div class="nav-grid">
          <button class="nav-tile" @click="navTo('/plan/goals')">
            <ion-icon :icon="flagOutline" class="nav-tile__icon" />
            <div class="nav-tile__text">
              <span class="nav-tile__label">Goals</span>
              <span class="nav-tile__hint">{{ activeGoals }} active</span>
            </div>
            <ion-icon :icon="chevronForwardOutline" class="nav-tile__arrow" />
          </button>

          <button class="nav-tile" @click="navTo('/plan/habits')">
            <ion-icon :icon="checkboxOutline" class="nav-tile__icon" />
            <div class="nav-tile__text">
              <span class="nav-tile__label">Habits</span>
              <span class="nav-tile__hint">{{ habitsDone }}/{{ habitsTotal }} done today</span>
            </div>
            <ion-icon :icon="chevronForwardOutline" class="nav-tile__arrow" />
          </button>

          <button class="nav-tile" @click="navTo('/plan/calendar')">
            <ion-icon :icon="calendarOutline" class="nav-tile__icon" />
            <div class="nav-tile__text">
              <span class="nav-tile__label">Calendar</span>
              <span class="nav-tile__hint">{{ upcomingEvents.length ? `${upcomingEvents.length} event${upcomingEvents.length > 1 ? 's' : ''} today` : 'No events today' }}</span>
            </div>
            <ion-icon :icon="chevronForwardOutline" class="nav-tile__arrow" />
          </button>
        </div>

      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonContent, IonHeader, IonIcon, onIonViewWillEnter } from '@ionic/vue'
import { flagOutline, checkboxOutline, calendarOutline, chevronForwardOutline } from 'ionicons/icons'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue'
import PlanSectionTabs from '@/features/plan/components/PlanSectionTabs.vue'
import { getHabitsWithStatus, getGoals, getCalendarEventsForDate } from '@/shared/db/app_db'
import { hapticLight } from '@/shared/utils/haptics'

const router = useRouter()

const navTo = (path: string) => {
  hapticLight();
  router.push(path);
};

const today = new Date().toISOString().slice(0, 10)
const todayLabel = new Date(today + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

const habits = ref<Record<string, any>[]>([])
const goals  = ref<Record<string, any>[]>([])
const events = ref<Record<string, any>[]>([])

const habitsDone  = computed(() => habits.value.filter(h => h.completed === 1).length)
const habitsTotal = computed(() => habits.value.length)
const allHabitsDone = computed(() => habitsTotal.value > 0 && habitsDone.value === habitsTotal.value)
const activeGoals = computed(() => goals.value.filter(g => g.status !== 'done').length)

const upcomingEvents = computed(() =>
  [...events.value].sort((a, b) => (a.time_start ?? '').localeCompare(b.time_start ?? ''))
)
const nextEvent = computed(() => upcomingEvents.value[0] ?? null)

onIonViewWillEnter(async () => {
  const [h, g, e] = await Promise.all([
    getHabitsWithStatus(today),
    getGoals(),
    getCalendarEventsForDate(today),
  ])
  habits.value = h as Record<string, any>[]
  goals.value  = g as Record<string, any>[]
  events.value = e as Record<string, any>[]
})
</script>

<style scoped>
.page-content {
  padding: 16px;
  max-width: 760px;
  margin: 0 auto;
  display: grid;
  gap: 16px;
}

.section-kicker {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: rgba(255, 255, 255, 0.5);
  margin: 0 0 12px 2px;
}

.nav-kicker { margin-top: 4px; }

/* ── Card base ── */
.card {
  background: var(--ion-color-primary);
  border-radius: 12px;
  padding: 18px;
}

/* ── Today snapshot ── */
.snapshot-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.snapshot-tile {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  cursor: pointer;
  transition: background 0.15s;
}

.snapshot-tile:active { background: rgba(255, 255, 255, 0.09); }

.snapshot-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}

.snapshot-denom {
  font-size: 0.9rem;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.4);
}

.snapshot-value--event {
  font-size: 1.1rem;
  color: rgb(239, 68, 68);
}

.snapshot-value--muted { color: rgba(255, 255, 255, 0.3); }

.value--done { color: rgb(34, 197, 94); }

.snapshot-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.45);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Events strip ── */
.event-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.event-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.event-time {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.45);
  width: 38px;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.event-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot--workout  { background: rgb(239, 68, 68); }
.dot--school   { background: rgb(59, 130, 246); }
.dot--recovery { background: rgb(34, 197, 94); }
.dot--sleep    { background: rgb(99, 102, 241); }
.dot--reminder { background: rgb(234, 179, 8); }
.dot--general  { background: rgba(255, 255, 255, 0.4); }

.event-title {
  flex: 1;
  font-size: 0.88rem;
  color: #fff;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.event-tag {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.tag--workout  { background: rgba(239,68,68,0.15);  color: rgb(239,68,68); }
.tag--school   { background: rgba(59,130,246,0.15); color: rgb(59,130,246); }
.tag--recovery { background: rgba(34,197,94,0.15);  color: rgb(34,197,94); }
.tag--sleep    { background: rgba(99,102,241,0.15); color: rgb(99,102,241); }
.tag--reminder { background: rgba(234,179,8,0.15);  color: rgb(234,179,8); }
.tag--general  { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.6); }

/* ── Nav tiles ── */
.nav-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.nav-tile {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--ion-color-primary);
  border-radius: 12px;
  padding: 16px 18px;
  border: none;
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: background 0.15s ease;
}

.nav-tile:active { background: rgba(255, 255, 255, 0.08); }

.nav-tile__icon {
  font-size: 22px;
  color: rgb(239, 68, 68);
  flex-shrink: 0;
}

.nav-tile__text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-tile__label {
  font-size: 0.95rem;
  font-weight: 600;
  color: #fff;
}

.nav-tile__hint {
  font-size: 0.76rem;
  color: rgba(255, 255, 255, 0.45);
}

.nav-tile__arrow {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.25);
  flex-shrink: 0;
}
</style>
