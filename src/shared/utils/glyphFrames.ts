// Pure pixel-frame generators for the Nothing Glyph Matrix (the square back LED
// grid). No Capacitor/Vue deps so they're unit-testable. Each function returns a
// row-major array of per-LED brightness (0–255), length `side * side`.
//
// The (4a) Pro grid is 13x13 (169 LEDs); the (3) is 25x25. Geometry is written
// in normalised radii so it scales to either — pass `side` from
// glyphMatrixLength() (sqrt of the LED count) if you ever target the (3).

export const GLYPH_SIDE = 13 // Nothing Phone (4a) Pro: 13x13 = 169 LEDs

const TWO_PI = Math.PI * 2

// Dim track always lit under the ring so the dial outline stays visible, and the
// bright value used for the "time remaining" arc.
const TRACK_BRIGHTNESS = 36
const ARC_BRIGHTNESS = 255

/**
 * A clock-style countdown dial. The full ring is drawn as a dim track; the
 * portion still remaining is lit bright, sweeping clockwise from 12 o'clock.
 * As `fraction` falls from 1→0 the bright arc shrinks back toward the top, so a
 * glance at the back of the phone reads as a draining dial.
 *
 * @param fraction time remaining, 0..1 (clamped)
 * @param side     grid side length (default 13 for the 4a Pro)
 */
export function restRingFrame(fraction: number, side = GLYPH_SIDE): number[] {
  const f = Math.min(1, Math.max(0, fraction))
  const frame = new Array<number>(side * side).fill(0)

  const center = (side - 1) / 2
  const half = side / 2
  // ~2px-thick ring hugging the outer edge, scaled to the grid.
  const rOuter = half - 0.3
  const rInner = half - 2.2

  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const dx = x - center
      const dy = y - center
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < rInner || dist > rOuter) continue

      // Angle measured from 12 o'clock, increasing clockwise, normalised 0..1.
      // atan2(dx, -dy): 0 at top, +PI/2 at right (clockwise on screen, where y
      // grows downward), wrapping to bottom/left.
      let angle = Math.atan2(dx, -dy) / TWO_PI
      if (angle < 0) angle += 1

      // Normalised angle is in [0, 1); strict `<` means f=0 lights nothing and
      // f=1 lights the whole ring.
      frame[y * side + x] = angle < f ? ARC_BRIGHTNESS : TRACK_BRIGHTNESS
    }
  }

  return frame
}

/** Every LED at full brightness — used for the end-of-rest flash. */
export function fullFrame(side = GLYPH_SIDE): number[] {
  return new Array<number>(side * side).fill(ARC_BRIGHTNESS)
}

/** All LEDs off. */
export function blankFrame(side = GLYPH_SIDE): number[] {
  return new Array<number>(side * side).fill(0)
}
