import type { RouteRecordRaw } from 'vue-router'

export const settingsRoutes: Array<RouteRecordRaw> = [
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('./pages/SettingsPage.vue')
  }
]
