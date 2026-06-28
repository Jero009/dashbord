import { describe, expect, test, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

// Mock the DB layer so we drive the component purely through return values.
vi.mock('@/shared/db/app_db', () => ({
  getSessionLoads: vi.fn(() => Promise.resolve([])),
  getHealthMetricDailySeries: vi.fn(() => Promise.resolve([])),
}))

// Stub Ionic + haptics so the component mounts in jsdom without the framework.
vi.mock('@ionic/vue', () => ({
  IonIcon: { template: '<i class="ion-icon" />' },
  IonSelect: { template: '<div class="ion-select"><slot /></div>' },
  IonSelectOption: { template: '<div><slot /></div>' },
  onIonViewWillEnter: () => {},
}))
vi.mock('@/shared/utils/haptics', () => ({ hapticSelect: () => {} }))

import TrainingLoadOverlay from '@/features/analytics/components/TrainingLoadOverlay.vue'
import { getSessionLoads, getHealthMetricDailySeries } from '@/shared/db/app_db'

const todayKey = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})()

beforeEach(() => {
  vi.mocked(getSessionLoads).mockResolvedValue([])
  vi.mocked(getHealthMetricDailySeries).mockResolvedValue([])
})

describe('TrainingLoadOverlay — no data', () => {
  test('renders only the empty state, no banner / chart, and does not throw', async () => {
    const wrapper = mount(TrainingLoadOverlay)
    await flushPromises()

    expect(wrapper.text()).toContain('Log workouts to build the overlay')
    expect(wrapper.find('.status').exists()).toBe(false)
    expect(wrapper.find('svg').exists()).toBe(false)
    expect(wrapper.findAll('.tile').length).toBe(0)
  })
})

describe('TrainingLoadOverlay — workouts but no recovery signal', () => {
  test('shows the chart with a neutral "unknown" status, no recovery line', async () => {
    vi.mocked(getSessionLoads).mockResolvedValue([
      { workout_id: 1, date: todayKey, time_end: `${todayKey}T10:00:00.000Z`, duration_minutes: 60, session_rpe: null, volume: 5000 },
    ])
    // recovery (rhr + hrv) stays empty.

    const wrapper = mount(TrainingLoadOverlay)
    await flushPromises()

    expect(wrapper.find('.empty-copy').exists()).toBe(false)
    expect(wrapper.find('svg').exists()).toBe(true)
    // Neutral state, not a falsely confident green.
    expect(wrapper.find('.status--unknown').exists()).toBe(true)
    expect(wrapper.find('.status--green').exists()).toBe(false)
    expect(wrapper.text()).toContain('Load tracked')
    // No recovery readings → no plotted recovery points.
    expect(wrapper.findAll('circle').length).toBe(0)
    // A logged session still yields a recovery-time estimate (no recovery/sleep
    // modifiers needed — it degrades to the load-only base).
    expect(wrapper.text()).toContain('Recovery time')
  })
})
