import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getCachedGrades,
  syncGrades,
  countNewAndMarkSeen,
  averageGrade,
  type GradeRow,
} from '@/shared/sync/gradesStore'
import { getCachedBriefing, syncBriefing, briefingIsToday, type Briefing } from '@/shared/sync/briefingStore'

const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => void store.clear(),
})

// CapacitorHttp must exist before receiverSync imports it.
;(globalThis as Record<string, unknown>).Capacitor = { isNativePlatform: false }
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: false },
  CapacitorHttp: {
    get: vi.fn(async ({ url }: { url: string }) => {
      // Simulated receiver: grades store reflects what the test last loaded.
      if (url.includes('type=school_grade')) return { data: mockGradeRows.value }
      if (url.includes('type=briefing')) return { data: mockBriefRows.value }
      return { data: [] }
    }),
    post: vi.fn(async () => ({ status: 200 })),
  },
}))

const mockGradeRows = { value: [] as unknown[] }
const mockBriefRows = { value: [] as unknown[] }

const row = (subject: string, grade: number, date: string, received_at: number, term: string | null = null) => ({
  received_at,
  data: [{ subject, grade, date, term }],
})

beforeEach(() => {
  store.clear()
  mockGradeRows.value = []
  mockBriefRows.value = []
})

describe('gradesStore', () => {
  it('pulls, caches, and counts new grades', async () => {
    mockGradeRows.value = [row('Mat', 5, '2026-09-20', 1000)]
    expect(await syncGrades()).toBe(1)
    expect(getCachedGrades()).toHaveLength(1)
    // Same rows again (overlap window) → nothing new
    expect(await syncGrades()).toBe(0)
  })

  it('dedupes identical grades across pulls', async () => {
    mockGradeRows.value = [row('Mat', 5, '2026-09-20', 1000)]
    await syncGrades()
    mockGradeRows.value = [row('Mat', 5, '2026-09-20', 1001), row('Slo', 4, '2026-09-21', 1002)]
    expect(await syncGrades()).toBe(1)
    expect(getCachedGrades()).toHaveLength(2)
  })

  it('newest first ordering', async () => {
    mockGradeRows.value = [row('A', 5, '2026-09-20', 2000), row('B', 4, '2026-09-21', 1000)]
    await syncGrades()
    const grades = getCachedGrades()
    expect(grades[0].receivedAt).toBe(2000)
    expect(grades[1].receivedAt).toBe(1000)
  })

  it('countNewAndMarkSeen drains', async () => {
    mockGradeRows.value = [row('Mat', 5, '2026-09-20', 1000)]
    await syncGrades()
    expect(countNewAndMarkSeen()).toBe(1)
    expect(countNewAndMarkSeen()).toBe(0)
  })

  it('averageGrade over trailing n', () => {
    const rows: GradeRow[] = [
      { subject: 'A', grade: 5, date: 'd', term: null, receivedAt: 3 },
      { subject: 'B', grade: 4, date: 'd', term: null, receivedAt: 2 },
      { subject: 'C', grade: 3, date: 'd', term: null, receivedAt: 1 },
    ]
    expect(averageGrade(rows, 2)).toBe(4.5)
    expect(averageGrade(rows, 3)).toBe(4)
    expect(averageGrade([], 5)).toBeNull()
  })

  it('rejects malformed rows without crashing the cache', async () => {
    mockGradeRows.value = [
      { received_at: 1000, data: [{ subject: 'X', grade: 'bad', date: '2026-09-20' }] },
      row('Mat', 5, '2026-09-20', 1001),
    ]
    expect(await syncGrades()).toBe(1)
    expect(getCachedGrades()[0].subject).toBe('Mat')
  })
})

describe('briefingStore', () => {
  it('caches latest briefing and upgrades only on newer', async () => {
    mockBriefRows.value = [{ received_at: 1000, data: [{ title: 'D1', body: 'one' }] }]
    const first = await syncBriefing()
    expect(first?.title).toBe('D1')
    expect(getCachedBriefing()?.title).toBe('D1')

    // Same/solder arrival → null
    expect(await syncBriefing()).toBeNull()

    // Newer → upgrade
    mockBriefRows.value = [
      { received_at: 1000, data: [{ title: 'D1', body: 'one' }] },
      { received_at: 2000, data: [{ title: 'D2', body: 'two' }] },
    ]
    const up = await syncBriefing()
    expect(up?.title).toBe('D2')
    expect(getCachedBriefing()?.title).toBe('D2')
  })

  it('briefingIsToday uses local day', () => {
    const now = new Date()
    const todaySec = Math.floor(now.getTime() / 1000)
    const yesterday = new Date(now.getTime() - 86400_000)
    expect(briefingIsToday({ receivedAt: todaySec, title: '', body: '' }, now)).toBe(true)
    expect(briefingIsToday({ receivedAt: Math.floor(yesterday.getTime() / 1000), title: '', body: '' }, now)).toBe(false)
  })
})
