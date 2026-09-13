import { getCurrency } from '@/shared/utils/userSettings'

// One formatter for all finance UI so the currency setting applies everywhere.
// Device locale decides separators; whole units keep tiles compact — except
// small values, which would round to "$0" (sub-$1 crypto holdings).
export function formatCurrency(value: number): string {
  const safe = Number.isFinite(value) ? value : 0
  const needsCents = Math.abs(safe) < 1000 && safe % 1 !== 0
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: getCurrency(),
    maximumFractionDigits: needsCents ? 2 : 0,
    minimumFractionDigits: needsCents ? 2 : 0,
  }).format(safe)
}
