<template>
  <ion-page>
    <ion-header>
      <DashboardTopBar />
      <PlanSectionTabs />
    </ion-header>

    <ion-content :fullscreen="true">
      <div class="page-content">
        <p class="section-kicker">Planning</p>

        <div class="nav-grid">
          <button class="nav-tile" @click="router.push('/plan/goals')">
            <ion-icon :icon="flagOutline" class="nav-tile__icon" />
            <div class="nav-tile__text">
              <span class="nav-tile__label">Goals</span>
              <span class="nav-tile__hint">Track long-term targets</span>
            </div>
          </button>

          <button class="nav-tile" @click="router.push('/plan/habits')">
            <ion-icon :icon="checkboxOutline" class="nav-tile__icon" />
            <div class="nav-tile__text">
              <span class="nav-tile__label">Habits</span>
              <span class="nav-tile__hint">Daily habit streaks</span>
            </div>
          </button>

          <button class="nav-tile" @click="router.push('/plan/calendar')">
            <ion-icon :icon="calendarOutline" class="nav-tile__icon" />
            <div class="nav-tile__text">
              <span class="nav-tile__label">Calendar</span>
              <span class="nav-tile__hint">Schedule and events</span>
            </div>
          </button>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonContent, IonHeader, IonIcon } from '@ionic/vue'
import { flagOutline, checkboxOutline, calendarOutline } from 'ionicons/icons'
import { useRouter } from 'vue-router'
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue'
import PlanSectionTabs from '@/features/plan/components/PlanSectionTabs.vue'

const router = useRouter()
</script>

<style scoped>
.page-content {
  padding: 16px;
  max-width: 760px;
  margin: 0 auto;
}

.section-kicker {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: rgba(255, 255, 255, 0.5);
  margin: 0 0 14px 2px;
}

.nav-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.nav-tile {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--ion-color-primary);
  border-radius: 12px;
  padding: 18px;
  border: none;
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: background 0.15s ease;
}

.nav-tile:active {
  background: rgba(255, 255, 255, 0.08);
}

.nav-tile__icon {
  font-size: 26px;
  color: rgb(239, 68, 68);
  flex-shrink: 0;
}

.nav-tile__label {
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
  display: block;
  line-height: 1.2;
}

.nav-tile__hint {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.5);
  display: block;
  margin-top: 2px;
  line-height: 1.3;
}

.nav-tile__text {
  display: flex;
  flex-direction: column;
}
</style>
