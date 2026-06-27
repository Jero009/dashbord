import { describe, expect, test } from 'vitest'
import { buildRestFrame } from '@/shared/utils/restTimerGlyph'

const SIDE = 13 // Nothing Phone (4a) Pro: 13x13 = 169 LEDs

function litCount(frame: number[]): number {
  return frame.reduce((n, v) => (v > 0 ? n + 1 : n), 0)
}

describe('buildRestFrame', () => {
  test('returns a full-length, all-off frame for a non-positive grid', () => {
    expect(buildRestFrame(0, 30, 60)).toEqual([])
  })

  test('frame is side*side long with brightness in 0..255', () => {
    const frame = buildRestFrame(SIDE, 30, 60)
    expect(frame).toHaveLength(SIDE * SIDE)
    for (const v of frame) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(255)
    }
  })

  test('the depleting ring shrinks as time runs out', () => {
    const full = buildRestFrame(SIDE, 60, 60)
    const half = buildRestFrame(SIDE, 30, 60)
    const empty = buildRestFrame(SIDE, 0, 60)

    // Count only border (ring) LEDs so the centre digits don't skew the totals.
    const ringLit = (frame: number[]) => {
      let n = 0
      for (let r = 0; r < SIDE; r++) {
        for (let c = 0; c < SIDE; c++) {
          const onBorder = r === 0 || c === 0 || r === SIDE - 1 || c === SIDE - 1
          if (onBorder && frame[r * SIDE + c] > 0) n++
        }
      }
      return n
    }

    expect(ringLit(full)).toBeGreaterThan(ringLit(half))
    expect(ringLit(half)).toBeGreaterThan(ringLit(empty))
  })

  test('a full timer lights the entire perimeter', () => {
    const frame = buildRestFrame(SIDE, 60, 60)
    const perimeter = SIDE * 4 - 4
    let n = 0
    for (let r = 0; r < SIDE; r++) {
      for (let c = 0; c < SIDE; c++) {
        const onBorder = r === 0 || c === 0 || r === SIDE - 1 || c === SIDE - 1
        if (onBorder && frame[r * SIDE + c] > 0) n++
      }
    }
    expect(n).toBe(perimeter)
  })

  test('renders the remaining seconds as centred digits (1-, 2- and 3-digit)', () => {
    // Each comparison uses the same total so only the digit count differs.
    const oneDigit = buildRestFrame(SIDE, 5, 300)
    const twoDigit = buildRestFrame(SIDE, 45, 300)
    const threeDigit = buildRestFrame(SIDE, 120, 300)

    // Centre interior LEDs (away from the border ring) must light for the digits.
    const interiorLit = (frame: number[]) => {
      let n = 0
      for (let r = 2; r < SIDE - 2; r++) {
        for (let c = 2; c < SIDE - 2; c++) {
          if (frame[r * SIDE + c] > 0) n++
        }
      }
      return n
    }

    expect(interiorLit(oneDigit)).toBeGreaterThan(0)
    expect(interiorLit(twoDigit)).toBeGreaterThan(0)
    expect(interiorLit(threeDigit)).toBeGreaterThan(0)
  })

  test('digits use the brightest level (255) above the dimmer ring', () => {
    const frame = buildRestFrame(SIDE, 8, 60)
    expect(Math.max(...frame)).toBe(255)
    expect(litCount(frame)).toBeGreaterThan(0)
  })
})
