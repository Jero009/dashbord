// Pure geometry helpers shared by TrendChart (and any future hand-rolled
// chart). No Vue/DOM deps so this is unit-testable.

/** Min/max of values padded by padRatio of the range, so lines never touch
 *  the plot edge. Single/flat series gets a ±10% (min ±1) window. */
export function padExtent(values: number[], padRatio = 0.08): [number, number] {
  if (!values.length) return [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    const pad = Math.max(Math.abs(min) * 0.1, 1);
    return [min - pad, max + pad];
  }
  const pad = (max - min) * padRatio;
  return [min - pad, max + pad];
}

/** Catmull-Rom → cubic bezier path through all points. Tension 0 = straight
 *  segments, 1 = standard Catmull-Rom. Path starts exactly at the first point
 *  and ends exactly at the last. */
export function smoothPath(xs: number[], ys: number[], tension = 0.8): string {
  const n = xs.length;
  if (n === 0) return '';
  if (n === 1) return `M ${xs[0].toFixed(2)} ${ys[0].toFixed(2)}`;
  if (n === 2) return `M ${xs[0].toFixed(2)} ${ys[0].toFixed(2)} L ${xs[1].toFixed(2)} ${ys[1].toFixed(2)}`;
  let d = `M ${xs[0].toFixed(2)} ${ys[0].toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const x0 = xs[i - 1] ?? xs[i], y0 = ys[i - 1] ?? ys[i];
    const x1 = xs[i], y1 = ys[i];
    const x2 = xs[i + 1], y2 = ys[i + 1];
    const x3 = xs[i + 2] ?? xs[i + 1], y3 = ys[i + 2] ?? ys[i + 1];
    const c1x = x1 + ((x2 - x0) / 6) * tension;
    const c1y = y1 + ((y2 - y0) / 6) * tension;
    const c2x = x2 - ((x3 - x1) / 6) * tension;
    const c2y = y2 - ((y3 - y1) / 6) * tension;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }
  return d;
}

/** Index of the x closest to px (linear scan — series are ≤ a few hundred). */
export function nearestXIndex(xs: number[], px: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < xs.length; i++) {
    const d = Math.abs(xs[i] - px);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
