import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

import { IonicVue } from '@ionic/vue'

// ✅ DB
import { initDB } from '@/shared/db/app_db'

/* Core CSS */
import '@ionic/vue/css/core.css'
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'
import '@ionic/vue/css/typography.css'

/* Optional CSS */
import '@ionic/vue/css/padding.css'
import '@ionic/vue/css/float-elements.css'
import '@ionic/vue/css/text-alignment.css'
import '@ionic/vue/css/text-transformation.css'
import '@ionic/vue/css/flex-utils.css'
import '@ionic/vue/css/display.css'



/* Fonts (SIL OFL 1.1) */
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/space-grotesk/400.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource/space-mono/400.css'
import '@fontsource/space-mono/700.css'

/* Theme */
import './theme/variables.css'
import { initTheme } from '@/shared/composables/useTheme'

// Apply the persisted light/dark theme before mount so there's no flash.
initTheme()

// ✅ Create app ONCE
const app = createApp(App)
  .use(IonicVue)
  .use(router)

// ✅ Wait for router + DB
router.isReady().then(async () => {
  try {
    await initDB()
  } catch (error) {
    console.error('Failed to initialize database, continuing without DB.', error)
  }
  app.mount('#app')
})