// Body-text composition for the smart digest notifications (morning summary +
// weekly digest). Shared by App.vue (startup rescheduling) and SettingsPage
// (immediate scheduling when toggled on) so the wording stays in one place.
import { formatCurrency } from '@/shared/utils/currency'
import { getLatestReadinessScore, getHabitsWithStatus, getCalendarEventsForDate, getReviewDigest } from '@/shared/db/app_db'

export async function buildMorningBody(today: string): Promise<string> {
  const [readiness, habits, events] = await Promise.all([
    getLatestReadinessScore().catch(() => null),
    getHabitsWithStatus(today).catch(() => [] as any[]),
    getCalendarEventsForDate(today).catch(() => [] as any[]),
  ])
  const parts: string[] = []
  if (readiness?.score != null) parts.push(`Readiness ${Math.round(Number(readiness.score))}`)
  const due = habits.filter((h: any) => h.completed !== 1).length
  if (due > 0) parts.push(`${due} habit${due === 1 ? '' : 's'} to do`)
  const nextTimed = events
    .filter((e: any) => e.time_start)
    .sort((a: any, b: any) => String(a.time_start).localeCompare(String(b.time_start)))[0]
  if (nextTimed) parts.push(`Next: ${nextTimed.title} ${nextTimed.time_start}`)
  return parts.length ? parts.join(' · ') : 'Tap to start your day.'
}

export async function buildWeeklyBody(): Promise<string> {
  const d = await getReviewDigest('week').catch(() => null)
  if (!d) return 'Tap to see your week in review.'
  const parts: string[] = [`${d.workoutCount} workout${d.workoutCount === 1 ? '' : 's'}`]
  if (d.avgSleepScore != null) parts.push(`sleep ${d.avgSleepScore}`)
  if (d.habitRate != null) parts.push(`habits ${Math.round(d.habitRate * 100)}%`)
  if (d.netWorthDelta != null) parts.push(`net ${d.netWorthDelta > 0 ? '+' : ''}${formatCurrency(d.netWorthDelta)}`)
  return parts.join(' · ')
}
