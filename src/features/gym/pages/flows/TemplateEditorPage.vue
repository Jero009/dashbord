<template>
  <ion-page>
        <ion-header>
          <ion-toolbar>
            <ion-buttons slot="start">
              <ion-button class="button-red" @click="cancel()">Cancel</ion-button>
            </ion-buttons>
            <ion-title>EDIT TEMPLATE</ion-title>
            <ion-buttons slot="end">
              <ion-button class="button-yellow" @click="confirm()">Save</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
  <ion-content :fullscreen="true">
          <!-- Template name -->
           <div class="template-top">
            <ion-item class="template-top">
              <ion-input
                v-model="TemplateName"
                placeholder="Name"
                :clear-on-edit="true"
              />
            </ion-item>
              <ion-item class="template-top">
                <ion-button class="button-red" @click="goToExercisePicker">Add exercise</ion-button>
              </ion-item>
            </div>
            
                <Draggable v-model="exercises" item-key="id_exercise" @end="onDragEnd">
                  <template #item="{ element: ex, index }">
                    <ion-item-sliding>
                      <ion-item class="exercise-item">
                        <div style="flex: 1;">
                          {{ ex.name }}
                        </div>
                        <ion-input
                        label="Sets"  label-placement="floating"
                        :clear-on-edit="true"
                          type="number"
                          v-model.number="ex.set_number"
                          style="width: 60px"
                        ></ion-input>

                        <ion-input
                        label="Reps" label-placement="floating"
                        :clear-on-edit="true"
                          type="number"
                          v-model.number="ex.rep_number"
                          style="width: 60px"
                        ></ion-input>
                        <ion-select
                          label="RPE"
                          label-placement="floating"
                          interface="action-sheet"
                          :interface-options="{ cssClass: 'app-action-sheet', header: 'Target RPE' }"
                          v-model="ex.rpe"
                          style="width: 72px"
                          placeholder="—"
                        >
                          <ion-select-option v-for="opt in RPE_OPTIONS" :key="opt.value" :value="opt.value">
                            {{ opt.value }} — {{ opt.detail }} · {{ opt.feel }}
                          </ion-select-option>
                        </ion-select>
                      </ion-item>
                      <ion-item-options side="end">
                        <ion-item-option color="danger" @click="removeExercise(index)">Remove</ion-item-option>
                      </ion-item-options>
                    </ion-item-sliding>
                  </template>
                </Draggable>
        </ion-content>
  </ion-page>
</template>
<style scoped>
.card-template{
  margin: 10px auto ;
  width: 90%;
}

.sortable-chosen {
  background: var(--ion-color-primary-medium) !important; /* Light blue */
  transition: background 0.2s;
}

.card-template{
  margin: 10px auto ;
  width: 90%;
}
.template-top {
  width: 100%;
  background-color: var(--ion-color-primary);
}

</style>
<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonButton, IonButtons, IonInput, IonSelect, IonSelectOption, IonItemSliding, IonItemOptions, IonItemOption, onIonViewWillEnter, toastController } from '@ionic/vue';
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import Draggable from 'vuedraggable';
import { getTemplateById, getTemplateExercisesByTemplateId, renameTemplate, editTemplateExercises, addExerciseToTemplate, deleteTemplateExercise } from '@/shared/db/app_db';
import { RPE_OPTIONS } from '@/features/gym/types/rpe';

const router = useRouter();
const route = useRoute();

// Toast helper
const showToast = async (message: string, color: string = 'danger') => {
  const toast = await toastController.create({
    message,
    duration: 2000,
    position: 'top',
    color,
  });
  await toast.present();
};

// exercise picker 
const goToExercisePicker = () => {
  router.push({
    name: 'ExercisePicker',
    query: {
      templateId: route.params.id // REQUIRED
    }
  });
};

const onDragEnd = () => {
};


const cancel = () => {
  isLoaded.value = false;
  router.push({ name: 'Template' });
};

const TemplateName = ref('');
const removedExerciseRowIds = ref<number[]>([]);

const removeExercise = (index: number) => {
  const exercise = exercises.value[index];
  if (!exercise) return;

  if (exercise.id > 0 && !removedExerciseRowIds.value.includes(exercise.id)) {
    removedExerciseRowIds.value.push(exercise.id);
  }

  exercises.value.splice(index, 1);
};

const validateTemplate = (): boolean => {
  // Check template name
  if (!TemplateName.value || !TemplateName.value.trim()) {
    showToast('name required');
    return false;
  }

  // Check if exercises exist
  if (exercises.value.length === 0) {
    showToast('add an exercise');
    return false;
  }

  // Check for duplicates and validate each exercise
  const exerciseIds = new Set<number>();
  for (const ex of exercises.value) {
    // Check for duplicate exercises
    if (exerciseIds.has(ex.id_exercise)) {
      showToast(`"${ex.name}" is duplicated`);
      return false;
    }
    exerciseIds.add(ex.id_exercise);

    // Check sets > 0
    const sets = Number(ex.set_number);
    if (isNaN(sets) || sets <= 0) {
      showToast(`"${ex.name}": sets must be > 0`);
      return false;
    }

    // Check reps > 0
    const reps = Number(ex.rep_number);
    if (isNaN(reps) || reps <= 0) {
      showToast(`"${ex.name}": reps must be > 0`);
      return false;
    }
  }

  return true;
};

// saving changes doesnt work

const confirm = async () => {
  // Validate before saving
  if (!validateTemplate()) return;

  const templateId = Number(route.params.id)

  await renameTemplate(templateId, TemplateName.value.trim());

  // Delete exercises removed from the list.
  for (const rowId of removedExerciseRowIds.value) {
    await deleteTemplateExercise(rowId);
  }


  //add each selected exercise  
  for (let i = 0; i < exercises.value.length; i++) {
    const ex = exercises.value[i];

    if (ex.id === 0) {
      // NEW -> INSERT
      await addExerciseToTemplate(
        templateId,
        ex.id_exercise,
        Number(ex.set_number),
        Number(ex.rep_number),
        i,
        ex.rpe ?? null
      );
    } else {
      // EXISTING -> UPDATE
      await editTemplateExercises(
        ex.id,
        Number(ex.set_number),
        Number(ex.rep_number),
        i,
        ex.rpe ?? null
      );
    }
  }

  showToast('updated', 'success');
  exercises.value = [];
  removedExerciseRowIds.value = [];
  TemplateName.value = '';
  isLoaded.value = false;

  router.push({ name: 'Template' });

};
// exercises
const exercises = ref<TemplateExercise[]>([])
const isLoaded = ref(false);

type TemplateExercise = {
  id: number;
  name: string;
  id_exercise: number;
  set_number: number;
  rep_number: number;
  order_index: number;
  rpe?: number | null;
}
// refresh
onIonViewWillEnter(async () => {
  const id = Number(route.params.id);

  // Only reload from DB on first entry — not when returning from the exercise
  // picker, which would clobber any unsaved in-memory edits the user made.
  if (!isLoaded.value) {
    const template = await getTemplateById(id);
    if (template) {
      TemplateName.value = template.name;
    }
    const data = await getTemplateExercisesByTemplateId(id);
    exercises.value = data || [];
    isLoaded.value = true;
  }

  // Always check for a picker selection (present only when returning from picker).
  const selectedExerciseStr = localStorage.getItem('selectedExerciseForTemplate');
  if (selectedExerciseStr) {
    try {
      const ex = JSON.parse(selectedExerciseStr);
      const exists = exercises.value.some(e => e.id_exercise === ex?.id);
      if (ex && ex.id != null && !exists) {
        exercises.value.push({
          id: 0,
          id_exercise: ex.id,
          name: ex.name,
          set_number: 3,
          rep_number: 10,
          order_index: exercises.value.length,
          rpe: null,
        });
      }
    } catch (e) {
      console.error('Failed to parse selected exercise:', e);
    }
    localStorage.removeItem('selectedExerciseForTemplate');
  }
});



</script>
