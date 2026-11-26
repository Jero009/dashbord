import { createRouter, createWebHistory } from '@ionic/vue-router';
import { gymRoutes } from '@/features/gym/routes';
import { homeRoutes } from '@/features/home/routes';
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
    ...healthRoutes,
    ...gymRoutes,
    ...settingsRoutes,
    // Removed sections (finance/analytics/hermes) — old deep links and
    // notifications redirect home instead of dead-ending.
    { path: '/finance/:pathMatch(.*)*', redirect: '/home' },
    { path: '/analytics/:pathMatch(.*)*', redirect: '/home' },
    { path: '/hermes/:pathMatch(.*)*', redirect: '/home' },
  ],
})

export default router
