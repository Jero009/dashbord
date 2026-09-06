const SLEEP_GOAL_KEY = 'setting_sleep_goal_hours'
const STEP_GOAL_KEY = 'setting_step_goal'

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
  return v ? parseFloat(v) : null
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
