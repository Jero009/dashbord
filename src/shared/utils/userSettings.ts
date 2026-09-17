const SLEEP_GOAL_KEY = 'setting_sleep_goal_hours'
const STEP_GOAL_KEY = 'setting_step_goal'

const WEEKLY_WORKOUT_GOAL_KEY = 'homeWeeklyGoal'

// Weekly workout goal (workouts/week). Kept the legacy `homeWeeklyGoal` key so
// existing users' settings survive.
export function getWeeklyWorkoutGoal(): number {
  const n = Number(localStorage.getItem(WEEKLY_WORKOUT_GOAL_KEY))
  return Number.isFinite(n) && n > 0 ? n : 4
}

export function setWeeklyWorkoutGoal(goal: number): void {
  localStorage.setItem(WEEKLY_WORKOUT_GOAL_KEY, String(goal))
}

export function getSleepGoalHours(): number {
  const v = localStorage.getItem(SLEEP_GOAL_KEY)
  const n = v ? parseFloat(v) : NaN
  return Number.isFinite(n) ? n : 8.0
}

export function setSleepGoalHours(h: number): void {
  localStorage.setItem(SLEEP_GOAL_KEY, String(h))
}

export function getStepGoal(): number {
  const v = localStorage.getItem(STEP_GOAL_KEY)
  const n = v ? parseInt(v, 10) : NaN
  return Number.isFinite(n) ? n : 10000
}

export function setStepGoal(steps: number): void {
  localStorage.setItem(STEP_GOAL_KEY, String(steps))
}

const GOAL_WEIGHT_KEY = 'setting_goal_weight_kg'

export function getGoalWeightKg(): number | null {
  const v = localStorage.getItem(GOAL_WEIGHT_KEY)
  if (!v) return null
  const n = parseFloat(v)
  // Guard like the other numeric accessors: 'abc'/String(NaN) in storage must
  // never leak NaN into delta math or the AI export.
  return Number.isFinite(n) && n > 0 ? n : null
}

export function setGoalWeightKg(kg: number): void {
  localStorage.setItem(GOAL_WEIGHT_KEY, String(kg))
}

const CURRENCY_KEY = 'setting_currency'

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'CHF'

export function getCurrency(): CurrencyCode {
  const v = localStorage.getItem(CURRENCY_KEY)
  return v === 'EUR' || v === 'GBP' || v === 'CHF' ? v : 'USD'
}

export function setCurrency(code: CurrencyCode): void {
  localStorage.setItem(CURRENCY_KEY, code)
}

const LAST_HC_SYNC_KEY = 'setting_last_hc_sync_at'

export function getLastHcSyncAt(): number | null {
  const v = Number(localStorage.getItem(LAST_HC_SYNC_KEY))
  return Number.isFinite(v) && v > 0 ? v : null
}

export function setLastHcSyncAt(epochMs: number): void {
  localStorage.setItem(LAST_HC_SYNC_KEY, String(epochMs))
}

// Notification settings — all backed by localStorage
export function getNotifWeightEnabled(): boolean { return localStorage.getItem('notif_weight_enabled') === '1' }
export function setNotifWeightEnabled(v: boolean): void { localStorage.setItem('notif_weight_enabled', v ? '1' : '0') }
export function getNotifWeightTime(): string { return localStorage.getItem('notif_weight_time') ?? '08:00' }
export function setNotifWeightTime(t: string): void { localStorage.setItem('notif_weight_time', t) }

export function getNotifSleepEnabled(): boolean { return localStorage.getItem('notif_sleep_enabled') === '1' }
export function setNotifSleepEnabled(v: boolean): void { localStorage.setItem('notif_sleep_enabled', v ? '1' : '0') }
export function getNotifSleepTime(): string { return localStorage.getItem('notif_sleep_time') ?? '22:30' }
export function setNotifSleepTime(t: string): void { localStorage.setItem('notif_sleep_time', t) }

export function getNotifBillAlertEnabled(): boolean { return localStorage.getItem('notif_bill_enabled') === '1' }
export function setNotifBillAlertEnabled(v: boolean): void { localStorage.setItem('notif_bill_enabled', v ? '1' : '0') }
export function getNotifBillAlertTime(): string { return localStorage.getItem('notif_bill_time') ?? '20:00' }
export function setNotifBillAlertTime(t: string): void { localStorage.setItem('notif_bill_time', t) }

export function getCoinGeckoApiKey(): string { return localStorage.getItem('coingecko_api_key') ?? '' }
export function setCoinGeckoApiKey(key: string): void { localStorage.setItem('coingecko_api_key', key.trim()) }
