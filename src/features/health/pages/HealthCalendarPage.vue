<template>
  <ion-page>
    <ion-header>
      <dashboard-top-bar />
      <health-section-tabs />
    </ion-header>
    <ion-content :fullscreen="true" class="health-content">
      <div class="health-shell">
        <ion-card class="calendar-card">
          <ion-card-header>
            <ion-card-title>Calendar</ion-card-title>
            <ion-card-subtitle>Track events and recovery days</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <ion-item>
              <ion-label position="stacked">Select date</ion-label>
              <ion-input v-model="selectedDate" type="date"></ion-input>
            </ion-item>
          </ion-card-content>
        </ion-card>

        <ion-card class="calendar-card">
          <ion-card-header>
            <ion-card-title>Add event</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list>
              <ion-item>
                <ion-label position="stacked">Title</ion-label>
                <ion-input v-model="eventTitle"></ion-input>
              </ion-item>
              <ion-item>
                <ion-label position="stacked">Type</ion-label>
                <ion-select v-model="eventType">
                  <ion-select-option value="general">General</ion-select-option>
                  <ion-select-option value="workout">Workout</ion-select-option>
                  <ion-select-option value="recovery">Recovery</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-item>
                <ion-label position="stacked">Notes</ion-label>
                <ion-input v-model="eventNotes"></ion-input>
              </ion-item>
            </ion-list>
            <ion-button expand="block" @click="saveEvent">Save event</ion-button>
          </ion-card-content>
        </ion-card>

        <ion-card class="calendar-card">
          <ion-card-header>
            <ion-card-title>Events on {{ selectedDate }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list v-if="events.length">
              <ion-item v-for="event in events" :key="event.id">
                <ion-label>
                  <h3>{{ event.title }}</h3>
                  <p>{{ event.type }}</p>
                  <p v-if="event.notes">{{ event.notes }}</p>
                </ion-label>
              </ion-item>
            </ion-list>
            <p v-else class="empty-state">No events yet.</p>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonHeader,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonList,
  IonButton,
  onIonViewWillEnter,
  toastController,
} from '@ionic/vue';
import { ref, watch } from 'vue';
import DashboardTopBar from '@/shared/components/DashboardTopBar.vue';
import HealthSectionTabs from '@/features/health/components/HealthSectionTabs.vue';
import { addCalendarEvent, getCalendarEventsForDate } from '@/shared/db/app_db';

const selectedDate = ref(new Date().toISOString().slice(0, 10));
const eventTitle = ref('');
const eventType = ref('general');
const eventNotes = ref('');
const events = ref<Array<Record<string, any>>>([]);

const loadEvents = async () => {
  events.value = await getCalendarEventsForDate(selectedDate.value);
};

const saveEvent = async () => {
  if (!eventTitle.value.trim()) {
    const toast = await toastController.create({
      message: 'Add a title for the event.',
      duration: 2000,
      color: 'warning',
    });
    await toast.present();
    return;
  }

  await addCalendarEvent(eventTitle.value.trim(), selectedDate.value, eventType.value, eventNotes.value.trim());
  eventTitle.value = '';
  eventNotes.value = '';
  await loadEvents();

  const toast = await toastController.create({
    message: 'Event added.',
    duration: 1800,
    color: 'success',
  });
  await toast.present();
};

watch(selectedDate, async () => {
  await loadEvents();
});

onIonViewWillEnter(async () => {
  await loadEvents();
});
</script>

<style scoped>
.health-content {
  --padding-top: 16px;
  --padding-bottom: 24px;
}

.health-shell {
  padding: 16px;
  display: grid;
  gap: 16px;
}

.calendar-card {
  margin: 0;
  border-radius: 12px;
  background: var(--ion-color-primary);
}

.empty-state {
  margin: 0;
  color: rgba(255, 255, 255, 0.6);
}
</style>
