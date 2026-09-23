<template>
  <ion-page>
    <ion-header collapse="condense">
      <ion-toolbar>
        <ion-title size="large">{{ title }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="pause-shell">
        <p class="nt-kicker">{{ title }}</p>

        <div class="chips">
          <button
            v-for="r in REASONS"
            :key="r"
            class="chip nt-press"
            :class="{ 'chip--selected': reason === r }"
            @click="selectReason(r)"
          >
            {{ r }}
          </button>
        </div>

        <ion-item lines="none" class="field">
          <ion-input
            v-model="note"
            :placeholder="notePlaceholder"
            aria-label="Note"
          />
        </ion-item>

        <ion-item lines="none" class="field">
          <ion-label position="stacked">Start</ion-label>
          <ion-input type="date" v-model="startDate" :max="today" />
        </ion-item>

        <ion-item v-if="showSeverity" lines="none" class="field">
          <ion-label position="stacked">Severity</ion-label>
          <ion-select v-model="severity" interface="action-sheet" :interface-options="{ cssClass: 'app-action-sheet' }">
            <ion-select-option value="mild">Mild</ion-select-option>
            <ion-select-option value="knocked_out">Knocked out</ion-select-option>
          </ion-select>
        </ion-item>

        <ion-item v-if="showOngoing" lines="none" class="field">
          <ion-checkbox v-model="ongoing">Still ongoing</ion-checkbox>
        </ion-item>

        <ion-item v-if="showOngoing && !ongoing" lines="none" class="field">
          <ion-label position="stacked">End</ion-label>
          <ion-input type="date" v-model="endDate" :max="today" />
        </ion-item>

        <ion-button expand="block" class="confirm-btn" :disabled="!canConfirm" @click="confirm">
          Confirm
        </ion-button>
      </div>
    </ion-content>
  </ion-page>
</template>

<!--
  Reason/severity sheet shared by the plan pause flow (PlanPage) and the
  standalone life-event logger (HealthHeatmap section). Confirm resolves with
  { reason, note, startDate, endDate?, severity? } via role 'confirm'.
-->
<script setup lang="ts">
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonLabel,
  IonInput, IonButton, IonSelect, IonSelectOption, IonCheckbox, modalController,
} from '@ionic/vue';
import { ref, computed } from 'vue';
import { localDateISO } from '@/shared/utils/timeFormat';
import { hapticLight, hapticMedium } from '@/shared/utils/haptics';

const props = withDefaults(defineProps<{
  title?: string;
  /** Sick events get severity chips; life-event logging gets end-date/ongoing. */
  mode?: 'pause' | 'life-event';
  /** Default when the reason chips don't already imply it (life-event mode). */
  defaultType?: string;
}>(), { title: 'Pause plan', mode: 'pause', defaultType: 'other' });

const REASONS = ['Sick', 'Recovery', 'School', 'Travel', 'Other'] as const;
const REASON_KEY: Record<string, string> = {
  sick: 'sick', recovery: 'recovery', school: 'school', travel: 'travel', other: 'other',
};

const today = localDateISO();
const reason = ref<string>('Sick');
const note = ref('');
const startDate = ref(today);
const severity = ref('mild');
const ongoing = ref(true);
const endDate = ref(today);

const showSeverity = computed(() => props.mode === 'life-event');
const showOngoing = computed(() => props.mode === 'life-event');

const notePlaceholder = computed(() =>
  props.mode === 'pause' ? 'Note (optional)' : 'Note (optional — symptoms, meds, …)'
);

const canConfirm = computed(() => {
  if (!reason.value) return false;
  if (props.mode === 'life-event' && !ongoing.value && !endDate.value) return false;
  return true;
});

const selectReason = (r: string) => {
  hapticLight();
  reason.value = r;
};

const confirm = () => {
  hapticMedium();
  const key = REASON_KEY[reason.value] ?? 'other';
  modalController.dismiss(
    {
      reason: key,
      note: note.value.trim() || null,
      startDate: startDate.value || today,
      endDate: props.mode === 'life-event' && !ongoing.value ? (endDate.value || null) : null,
      severity: props.mode === 'life-event' && key === 'sick' ? severity.value : null,
    },
    'confirm'
  );
};
</script>

<style scoped>
.pause-shell {
  display: grid;
  gap: 16px;
  padding: 20px 16px 32px;
  max-width: 500px;
  margin: 0 auto;
}

.pause-shell .nt-kicker {
  margin: 0;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  padding: 8px 14px;
  border-radius: var(--nt-radius-pill);
  border: 1px solid var(--nt-border);
  background: transparent;
  color: rgba(var(--nt-ink), 0.8);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--nt-dur-micro) var(--nt-ease-decel);
}

.chip--selected {
  background: var(--ion-color-accent-red);
  border-color: var(--ion-color-accent-red);
  color: var(--nt-on-accent);
}

.field {
  --background: rgba(var(--nt-ink), 0.05);
  border: 1px solid var(--nt-border);
  border-radius: var(--nt-radius-sm);
  margin: 0;
}

.confirm-btn {
  --background: var(--ion-color-accent-red);
  --border-radius: 8px;
}
</style>
