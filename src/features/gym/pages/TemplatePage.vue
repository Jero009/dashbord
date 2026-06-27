<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title class="title">TEMPLATE</ion-title>
        <ion-buttons slot="end">
          <ion-button class="button-red" @click="goToTemplateBuilder">
            <ion-icon :icon="add"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true" class="template-content">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Template</ion-title>
        </ion-toolbar>
      </ion-header>
      <!-- templates -->
          <ion-refresher slot="fixed" @ionRefresh="handleRefresh($event)">
            <ion-refresher-content></ion-refresher-content>
          </ion-refresher>
              <div class="template-shell">
                <ion-card class="card-template" :class="{ 'card-template--archived': template.archived }" v-for="template in templates" :key="template.id">
                    <ion-card-header class="card-header">
                        <div class="card-header__copy">
                          <ion-card-title class="card-title">
                            {{ template.name }}
                            <span v-if="template.archived" class="archived-chip">Archived</span>
                          </ion-card-title>
                          <ion-card-subtitle class="card-subtitle">{{ template.created_at }}</ion-card-subtitle>
                        </div>
                        <div class="card-header__actions">
                          <ion-button class="button-red" @click="deleteTemp(template.id)">Delete</ion-button>
                          <ion-button class="button-yellow" @click="editTemp(template.id)">Edit</ion-button>
                          <ion-button class="button-yellow" @click="toggleArchive(template)">{{ template.archived ? 'Unarchive' : 'Archive' }}</ion-button>
                        </div>
                    </ion-card-header>
                    <ion-card-content>

                      <ion-list class="template-exercise-list" lines="none">
                        <ion-item
                          class="template-exercise-item"
                          v-for="ex in template.exercises"
                          :key="ex.id"
                          lines="none"
                        > 
                          <div class="template-exercise-item__content">
                            <div class="template-exercise-item__name">{{ ex.name }}</div>
                            <div class="template-exercise-item__meta">{{ ex.set_number }} sets {{ ex.rep_number }} reps</div>
                          </div>
                        </ion-item>
                      </ion-list>
                    </ion-card-content>
                </ion-card>
              </div>
    </ion-content>
  </ion-page>
</template>
<style>
.template-content {
  --padding-top: 16px;
  --padding-bottom: 24px;
  scrollbar-gutter: stable;
}

.template-shell {
  padding: 16px;
  display: grid;
  gap: 18px;
  max-width: 760px;
  margin: 0 auto;
  width: min(100%, 760px);
  justify-items: stretch;
}

.card-template{
  margin: 0;
  width: 100%;
  min-height: 180px;
  border-radius: var(--ion-border-radius, 10px);
  background: var(--ion-card-background);
  color: var(--ion-card-color);
  box-shadow: none;
}

.card-template--archived {
  opacity: 0.55;
}

.archived-chip {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: var(--nt-radius-pill, 999px);
  border: 1px solid var(--nt-border-strong, rgba(var(--nt-ink), 0.12));
  font-family: var(--nt-font-head, inherit);
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--nt-text-dim, rgba(var(--nt-ink), 0.5));
  vertical-align: middle;
}

.card-header{
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 18px 12px;
}

.card-header__copy {
  display: grid;
  gap: 6px;
}

.card-header__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.card-title{
  font-size: 1.4rem;
  color:var(--ion-color-light);
  font-weight: bold;
  margin: 0;
}

.card-subtitle{
  font-size: 0.9em;
  color: rgba(var(--nt-ink), 0.58);
  margin: 0;
}

.card-template ion-card-content {
  padding: 0 18px 18px;
  display: grid;
  justify-items: center;
}

.template-exercise-list {
  display: grid;
  gap: 8px;
  background: transparent;
  padding: 0;
  width: 100%;
}

.template-exercise-item {
  --background: transparent;
  --inner-border-width: 0;
  --padding-start: 0;
  --padding-end: 0;
  margin-top: 0;
  border: none;
  width: min(100%, 96%);
  justify-self: center;
}

.template-exercise-item__content {
  width: 100%;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(var(--nt-ink), 0.035);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.template-exercise-item__name {
  color: var(--ion-color-light);
  font-weight: 600;
  text-align: left;
  flex: 1;
}

.template-exercise-item__meta {
  color: rgba(var(--nt-ink), 0.84);
  font-size: 0.9rem;
  white-space: nowrap;
  text-align: right;
  flex-shrink: 0;
}

@media (max-width: 700px) {
  .card-header {
    flex-direction: column;
  }

  .card-header__actions {
    justify-content: flex-start;
  }
}
</style>

<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, IonCardContent, IonCardSubtitle, IonCardTitle, IonList, IonItem, IonButton, IonIcon, IonButtons, IonRefresher, IonRefresherContent, onIonViewWillEnter, alertController } from '@ionic/vue';
import type { RefresherCustomEvent } from '@ionic/vue';
import { add } from 'ionicons/icons';
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getTemplates, getTemplateExercises, deleteTemplate, setTemplateArchived } from '@/shared/db/app_db';
import { hapticLight } from '@/shared/utils/haptics';

const router = useRouter();


const goToTemplateBuilder = () => {

  router.push({ name: 'TemplateBuilder' });
};

const editTemp = (id: number) => {
  router.push({ name: 'TemplateEditor', params: { id } });
};


// displaying templates
const templates = ref<Template[]>([]);

type Template = {
  id: number;
  name: string;
  created_at: string;
  archived?: number;
  exercises?: TemplateExercise[];
};

const loadTemplates = async () => {
  // Include archived here so they can be un-archived from this management screen.
  const data = await getTemplates(true);

  if (!data) {
    templates.value = [];
    return;
  }

  for (const template of data) {
    const exercises = await getTemplateExercises(template.id);
    template.exercises = exercises || [];
  }

  templates.value = data;
};


type TemplateExercise = {
  id: number;
  name: string;
  set_number: number;
  rep_number: number;
};



// delete template and template exercise
const deleteTemp = async (id: number) => {
  const template = templates.value.find(t => t.id === id);
  const templateName = template?.name || 'this template';

  const alert = await alertController.create({
    header: 'Delete template?',
    message: `"${templateName}" — can't be undone`,
    cssClass: 'app-confirm-alert',
    buttons: [
      {
        text: 'Cancel',
        role: 'cancel'
      },
      {
        text: 'Delete',
        role: 'destructive',
        handler: async () => {
          await deleteTemplate(id);
          await loadTemplates();
        }
      }
    ]
  });

  await alert.present();
};



// archive / unarchive — hides the template from the gym homepage + recommendations
const toggleArchive = async (template: Template) => {
  await hapticLight();
  await setTemplateArchived(template.id, !template.archived);
  await loadTemplates();
};

//refresh

const handleRefresh = async (event: RefresherCustomEvent) => {
  await loadTemplates();
  event.target.complete();
};


onMounted(() => {
    loadTemplates();
});

onIonViewWillEnter(() => {
  loadTemplates();
});
</script>



