import { getCurrency } from '@/shared/utils/userSettings'

// One formatter for all finance UI so the currency setting applies everywhere.
// Device locale decides separators; whole units keep tiles compact.
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: getCurrency(),
    maximumFractionDigits: 0,
  }).format(value)
}
