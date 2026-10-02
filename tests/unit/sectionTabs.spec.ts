import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { IonSegment } from '@ionic/vue'
import SectionTabs from '@/shared/components/SectionTabs.vue'
import { hapticLight } from '@/shared/utils/haptics'

// Haptics no-op in tests.
vi.mock('@/shared/utils/haptics', () => ({ hapticLight: vi.fn() }))

// jsdom doesn't run Ionic's framework loaders, so the ion-segment stub never
// renders its `value` as a DOM attribute — assert via the component's prop.
const activeSegmentValue = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findComponent(IonSegment).props('value')

const segments = [
  // exact: the overview root — '/analytics/gym' contains '/analytics', so the
  // root entry must match exactly, never by substring.
  { value: 'overview', label: 'Overview', path: '/analytics', exact: true },
  { value: 'gym', label: 'Gym', path: '/analytics/gym' },
  { value: 'review', label: 'Review', path: '/analytics/review' },
]

const makeRouter = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/analytics', component: { template: '<div />' } },
      { path: '/analytics/gym', component: { template: '<div />' } },
      { path: '/analytics/review', component: { template: '<div />' } },
      { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
    ],
  })

const mountTabs = async (initial = '/analytics') => {
  const router = makeRouter()
  await router.push(initial)
  await router.isReady()
  const wrapper = mount(SectionTabs, {
    props: { segments },
    global: { plugins: [router] },
  })
  await flushPromises()
  return { wrapper, router }
}

const changeSegment = async (wrapper: ReturnType<typeof mount>, value: string) => {
  await wrapper.find('ion-segment').trigger('ionChange', { detail: { value } })
  await flushPromises()
}

describe('SectionTabs — route matching and navigation', () => {
  test('derives the active segment from a nested route', async () => {
    const { wrapper } = await mountTabs('/analytics/gym')
    expect(activeSegmentValue(wrapper)).toBe('gym')
  })

  test('falls back to the overview entry on an unknown route', async () => {
    const { wrapper } = await mountTabs('/somewhere/else')
    expect(activeSegmentValue(wrapper)).toBe('overview')
  })

  test('changing segment pushes the mapped path once and fires hapticLight', async () => {
    const { wrapper, router } = await mountTabs('/analytics')
    const pushSpy = vi.spyOn(router, 'push')
    await changeSegment(wrapper, 'review')
    expect(pushSpy).toHaveBeenCalledTimes(1)
    expect(pushSpy).toHaveBeenCalledWith('/analytics/review')
    expect(hapticLight).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.path).toBe('/analytics/review')
  })

  test('selecting the current path performs no navigation', async () => {
    const { wrapper, router } = await mountTabs('/analytics')
    const pushSpy = vi.spyOn(router, 'push')
    await changeSegment(wrapper, 'overview')
    expect(pushSpy).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/analytics')
  })

  test('renders one button per segment with its label', async () => {
    const { wrapper } = await mountTabs()
    const buttons = wrapper.findAll('ion-segment-button')
    expect(buttons.length).toBe(3)
    expect(buttons[0].text()).toBe('Overview')
    expect(buttons[1].text()).toBe('Gym')
    expect(buttons[2].text()).toBe('Review')
  })
})
