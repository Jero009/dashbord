import { createRouter, createWebHistory } from '@ionic/vue-router';
import { gymRoutes } from '@/features/gym/routes';
import { homeRoutes } from '@/features/home/routes';
import { financeRoutes } from '@/features/finance/routes';
import { healthRoutes } from '@/features/health/routes';
import { settingsRoutes } from '@/features/settings/routes';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/home',
    },
    ...homeRoutes,
    ...financeRoutes,
    ...healthRoutes,
    ...gymRoutes,
    ...settingsRoutes,
  ],
})

export default router
