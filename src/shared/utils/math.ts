// Small numeric helpers shared across the health-compute modules and UI so the
// same definitions aren't copy-pasted (and don't drift) per feature.

// Clamp `v` into the inclusive range [lo, hi]. Non-finite input (NaN/Infinity)
// collapses to the low bound so a stray value can never poison a score, a chart
// coordinate, or a battery drain.
export function clamp(v: number, lo: number, hi: number): number {
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
}

export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}
