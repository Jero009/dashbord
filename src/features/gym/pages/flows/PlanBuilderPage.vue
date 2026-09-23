<template>
  <ion-page>
    <ion-header collapse="condense">
      <ion-toolbar>
        <ion-title size="large">CREATE PLAN</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      <ion-header>
        <ion-toolbar>
          <ion-buttons slot="start">
            <ion-button class="button-yellow" @click="cancel">Cancel</ion-button>
          </ion-buttons>
          <ion-title>Create Plan</ion-title>
          <ion-buttons slot="end">
            <ion-button class="button-red" @click="save">Save</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>

      <div class="builder-shell">
        <ion-item lines="none" class="field">
          <ion-input v-model="name" placeholder="Plan name" />
        </ion-item>

        <ion-item lines="none" class="field field--area">
          <ion-textarea v-model="goal" placeholder="Goal (optional)" :rows="2" />
        </ion-item>

        <ion-item lines="none" class="field">
          <ion-label position="stacked">Start</ion-label>
          <ion-input type="date" v-model="startDate" :min="today" />
        </ion-item>

        <div class="slider-block">
          <div class="slider-head">
            <span class="nt-kicker">Length</span>
            <strong class="slider-value">{{ lengthWeeks }} weeks</strong>
          </div>
          <ion-range v-model="lengthWeeks" :min="8" :max="26" :step="1" snaps />
        </div>

        <div class="slider-block">
          <div class="slider-head">
            <span class="nt-kicker">Deload every</span>
            <strong class="slider-value">{{ deloadEvery === 0 ? 'off' : `${deloadEvery} weeks` }}</strong>
          </div>
          <ion-range v-model="deloadEvery" :min="0" :max="6" :step="1" snaps />
        </div>

        <div class="slider-block">
          <div class="slider-head">
            <span class="nt-kicker">Deload intensity</span>
            <strong class="slider-value">{{ Math.round(deloadFactor * 100) }}%</strong>
          </div>
          <ion-range v-model="deloadFactor" :min="0.5" :max="0.9" :step="0.025" />
        </div>

        <div class="card">
          <p class="nt-kicker">Templates</p>
          <template v-if="templates.length > 0">
            <button
              v-for="t in templates"
              :key="t.id"
              class="tpl-row nt-press"
              :class="{ 'tpl-row--selected': selectedIds.has(t.id) }"
              @click="toggleTemplate(t.id)"
            >
              <span>{{ t.name }}</span>
              <ion-icon v-if="selectedIds.has(t.id)" :icon="checkmarkOutline" />
            </button>
          </template>
          <p v-else class="nt-empty">No templates yet — create one first</p>
        </div>

        <p class="preview-line">
          {{ previewText }}
        </p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonLabel,
  IonInput, IonTextarea, IonButton, IonButtons, IonRange, IonIcon, onIonViewWillEnter,
} from '@ionic/vue';
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { checkmarkOutline } from 'ionicons/icons';
import { getTemplates, createPlan } from '@/shared/db/app_db';
import { addDays } from '@/shared/utils/planCalendar';
import { localDateISO } from '@/shared/utils/timeFormat';
import { reloadPlan } from '@/features/gym/planStore';
import { hapticLight, hapticMedium, hapticSuccess } from '@/shared/utils/haptics';
import { showToast } from '@/shared/utils/toast';

const router = useRouter();

const today = localDateISO();
const name = ref('');
const goal = ref('');
const startDate = ref(today);
const lengthWeeks = ref(12);
const deloadEvery = ref(3);
const deloadFactor = ref(0.675);

const templates = ref<Array<{ id: number; name: string }>>([]);
const selectedIds = ref<Set<number>>(new Set());

const toggleTemplate = (id: number) => {
  hapticLight();
  const next = new Set(selectedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selectedIds.value = next;
};

const endDate = computed(() => addDays(startDate.value, lengthWeeks.value * 7 - 1));

const previewText = computed(() =>
  `${startDate.value} → ${endDate.value} · ${deloadEvery.value === 0 ? 'no deloads' : `deloads every ${deloadEvery.value} wks @ ${Math.round(deloadFactor.value * 100)}%`}`
);

const cancel = () => router.push('/tabs/Plan');

const save = async () => {
  if (!name.value.trim()) {
    showToast('name required');
    return;
  }
  if (endDate.value <= startDate.value) {
    showToast('end must be after start');
    return;
  }
  if (selectedIds.value.size === 0) {
    showToast('pick at least one template');
    return;
  }
  hapticMedium();
  const id = await createPlan({
    name: name.value.trim(),
    goal: goal.value.trim() || null,
    start_date: startDate.value,
    end_date: endDate.value,
    deload_every_weeks: deloadEvery.value,
    deload_factor: deloadFactor.value,
    template_ids: [...selectedIds.value],
  });
  if (!id) {
    showToast('create failed');
    return;
  }
  await reloadPlan();
  hapticSuccess();
  showToast('plan created', 'success');
  router.push('/tabs/Plan');
};

onIonViewWillEnter(async () => {
  const data = await getTemplates();
  templates.value = (data ?? []).map((t: any) => ({ id: Number(t.id), name: String(t.name) }));
});
</script>

<style scoped>
.builder-shell {
  padding: 16px;
  display: grid;
  gap: 14px;
  max-width: 760px;
  margin: 0 auto;
}

.field {
  --background: rgba(var(--nt-ink), 0.05);
  border: 1px solid var(--nt-border);
  border-radius: var(--nt-radius-sm);
  margin: 0;
}

.field--area {
  align-items: flex-start;
}

.slider-block {
  display: grid;
  gap: 2px;
}

.slider-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 0 4px;
}

.slider-head .nt-kicker {
  margin: 0;
}

.slider-value {
  font-family: var(--nt-font-display);
  font-weight: 700;
}

.card {
  background: var(--ion-color-primary);
  border-radius: var(--nt-radius-md);
  padding: 18px;
  display: grid;
  gap: 10px;
}

.card .nt-kicker {
  margin: 0;
}

.tpl-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 14px;
  background: rgba(var(--nt-ink), 0.05);
  border: 1px solid transparent;
  border-radius: 10px;
  text-align: left;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  color: rgba(var(--nt-ink), 0.9);
}

.tpl-row--selected {
  border-color: var(--ion-color-accent-red);
}

.preview-line {
  margin: 0;
  font-size: 0.78rem;
  color: var(--nt-text-dim);
  font-variant-numeric: tabular-nums;
}
</style>
