import { describe, expect, test, vi, beforeEach } from 'vitest'

// Deterministic dates relative to "today" (the module uses the real clock).
const key = (offset: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const T = key(0)
const Y = key(-1)

const metricSeries: Record<string, { date: string; value: number }[]> = {
  resting_heart_rate: [{ date: Y, value: 56 }, { date: T, value: 58 }],
  hrv: [],
  respiratory_rate: [{ date: Y, value: 14.2 }, { date: T, value: 14.5 }],
  steps: [{ date: Y, value: 9000 }, { date: T, value: 12000 }],
  sleep_score: [{ date: Y, value: 80 }, { date: T, value: 72 }],
}

vi.mock('@/shared/db/app_db', () => ({
  queryReadinessHistory: vi.fn(() => Promise.resolve([{ date: Y, score: 78 }, { date: T, score: 65 }])),
  getRecentSleepSessions: vi.fn(() => Promise.resolve([
    { date: Y, bedtime: `${key(-2)}T23:30:00`, waketime: `${Y}T07:30:00`, time_asleep_hours: 7.5, time_in_bed_hours: 8, efficiency: 0.93, score: 80, sleep_hr: 54, respiratory_rate: 14.2, stage_deep_min: 90, stage_light_min: 240, stage_rem_min: 110, stage_awake_min: 20, stage_asleep_min: 0, hr_timeline_json: null, stage_timeline_json: null, source: 'health-connect' },
    { date: T, bedtime: `${Y}T00:30:00`, waketime: `${T}T07:00:00`, time_asleep_hours: 6.2, time_in_bed_hours: 6.8, efficiency: 0.91, score: 72, sleep_hr: 57, respiratory_rate: 14.5, stage_deep_min: 60, stage_light_min: 220, stage_rem_min: 80, stage_awake_min: 30, stage_asleep_min: 0, hr_timeline_json: null, stage_timeline_json: null, source: 'health-connect' },
  ])),
  getHealthMetricDailySeries: vi.fn((type: string) => Promise.resolve(metricSeries[type] ?? [])),
  getBodyLogs: vi.fn(() => Promise.resolve([
    { id: 1, date: key(-10), weight_kg: 80.5, notes: null, photo_path: null, waist_cm: 84, chest_cm: null, hips_cm: null, arm_cm: 38, thigh_cm: null, body_fat_pct: 16.2 },
    { id: 2, date: T, weight_kg: 79.8, notes: null, photo_path: null, waist_cm: 83, chest_cm: null, hips_cm: null, arm_cm: 38.5, thigh_cm: null, body_fat_pct: 15.8 },
  ])),
  getSessionLoads: vi.fn(() => Promise.resolve([
    { workout_id: 1, date: Y, time_end: `${Y}T18:30:00`, duration_minutes: 60, session_rpe: 8, volume: 6000 },
  ])),
  getAllHabits: vi.fn(() => Promise.resolve([
    { id: 1, name: 'Read', days_of_week: null, created_at: `${key(-30)} 00:00:00` },
  ])),
  getHabitLogsForRange: vi.fn(() => Promise.resolve([
    { habit_id: 1, date: Y, completed: 1 },
    { habit_id: 1, date: T, completed: 1 },
  ])),
  getGoals: vi.fn(() => Promise.resolve([
    { id: 1, name: 'Bench 100kg', target_value: 100, current_value: 85, status: 'active', due_date: key(60) },
  ])),
  getAllExercisePRs: vi.fn(() => Promise.resolve([
    { exercise_id: 1, exercise_name: 'Bench Press', pr_weight: 85, pr_reps: 3, one_rep_max: 93, date_achieved: `${Y}T18:00:00` },
  ])),
  getRecentCircadianLogs: vi.fn(() => Promise.resolve([
    { id: 1, date: Y, day_type: 'work', energy_wake: 3, energy_noon: 4, energy_evening: 2, meal_first: '08:00', meal_last: '20:00', morning_light: 1, notes: null },
    { id: 2, date: T, day_type: 'work', energy_wake: 2, energy_noon: 3, energy_evening: 2, meal_first: '08:30', meal_last: '21:00', morning_light: 0, notes: null },
  ])),
  getFinanceAccounts: vi.fn(() => Promise.resolve([{ id: 1, name: 'Checking', balance: 2500 }])),
  getFinanceInvestments: vi.fn(() => Promise.resolve([{ id: 1, name: 'Index', value: 10000 }])),
  getFinanceBudgets: vi.fn(() => Promise.resolve([{ id: 1, category: 'food', monthly_limit: 400 }])),
  getFinanceSubscriptions: vi.fn(() => Promise.resolve([{ id: 1, name: 'Music', amount: 10, cadence: 'monthly', direction: 'expense', status: 'active' }])),
  queryMonthlySpending: vi.fn(() => Promise.resolve([{ month: T.slice(0, 7), expense: 1200, income: 3000 }])),
  queryCategorySpending: vi.fn(() => Promise.resolve([{ category: 'food', amount: 450 }])),
}))

vi.mock('@/shared/utils/userSettings', () => ({
  getSleepGoalHours: () => 8,
  getStepGoal: () => 10000,
  getGoalWeightKg: () => 78,
  getCurrency: () => 'USD',
}))

vi.mock('@/shared/utils/currency', () => ({
  formatCurrency: (v: number) => `$${Math.round(v)}`,
}))

import { buildAiExport } from '@/shared/utils/aiExport'

describe('buildAiExport', () => {
  let text = ''
  beforeEach(async () => {
    text = await buildAiExport({ days: 30 })
  })

  test('includes all section headers', () => {
    for (const h of [
      'PERSONAL TRACKING DATA EXPORT',
      '=== PROFILE & TARGETS ===',
      '=== CIRCADIAN PROFILE ===',
      '=== TRAINING LOAD & RECOVERY (latest) ===',
      '=== DAILY TIMELINE (CSV) ===',
      '=== PERSONAL RECORDS (strength) ===',
      '=== HABITS ===',
      '=== GOALS ===',
      '=== BODY ===',
      '=== FINANCE ===',
      '=== END OF EXPORT ===',
    ]) {
      expect(text).toContain(h)
    }
  })

  test('daily CSV has the documented header and a today row with merged metrics', () => {
    expect(text).toContain('date,readiness,sleep_h,eff,sleep_score,bedtime,wake,')
    const todayRow = text.split('\n').find((l) => l.startsWith(`${T},`))
    expect(todayRow).toBeTruthy()
    const cells = todayRow!.split(',')
    expect(cells[0]).toBe(T)
    expect(cells[1]).toBe('65')   // readiness
    expect(cells[2]).toBe('6.2')  // sleep_h
    expect(cells[3]).toBe('91')   // efficiency %
    expect(cells[13]).toBe('58')  // rhr
    expect(cells[14]).toBe('12000') // steps
    expect(cells[15]).toBe('79.8') // weight
  })

  test('surfaces profile, targets, PRs, habits, goals and finance', () => {
    expect(text).toContain('Sleep goal: 8 h/night')
    expect(text).toContain('Bench Press: 85')
    expect(text).toContain('Read (daily): current streak')
    expect(text).toContain('Bench 100kg: 85/100 (85%)')
    expect(text).toContain('Accounts balance: $2500')
    expect(text).toContain('food: $450 / $400 (OVER)')
  })

  test('weight change over the window is reported', () => {
    expect(text).toContain('Weight: 79.8 kg')
    expect(text).toContain('change over window: -0.7 kg')
  })
})
