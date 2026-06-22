import { describe, expect, test } from 'vitest'
import { restRingFrame, fullFrame, blankFrame, GLYPH_SIDE } from '@/shared/utils/glyphFrames'

const ARC = 255
const TRACK = 36

// Count LEDs lit at the bright "remaining arc" level.
const arcCount = (frame: number[]) => frame.filter((v) => v === ARC).length
// Count ring LEDs total (bright arc + dim track), i.e. anything lit.
const ringCount = (frame: number[]) => frame.filter((v) => v > 0).length

// Visual aid: render a frame as ASCII so the dial geometry can be eyeballed.
const render = (frame: number[], side = GLYPH_SIDE) => {
  let out = '\n'
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const v = frame[y * side + x]
      out += v === ARC ? '#' : v > 0 ? '.' : ' '
    }
    out += '\n'
  }
  return out
}

describe('restRingFrame', () => {
  test('returns one brightness per LED (169 on the 4a Pro)', () => {
    expect(restRingFrame(1).length).toBe(GLYPH_SIDE * GLYPH_SIDE)
  })

  test('all values are valid brightness 0..255', () => {
    const f = restRingFrame(0.5)
    expect(f.every((v) => v >= 0 && v <= 255)).toBe(true)
  })

  test('full dial lights the whole ring bright', () => {
    const f = restRingFrame(1)
    // At fraction 1 every ring LED is part of the remaining arc.
    expect(arcCount(f)).toBe(ringCount(f))
    expect(arcCount(f)).toBeGreaterThan(20) // a real ring, not a few stray pixels
  })

  test('empty dial leaves only the dim track', () => {
    const f = restRingFrame(0)
    expect(arcCount(f)).toBe(0)
    expect(f.some((v) => v === TRACK)).toBe(true)
  })

  test('arc shrinks monotonically as the dial drains', () => {
    const fractions = [1, 0.75, 0.5, 0.25, 0]
    const counts = fractions.map((fr) => arcCount(restRingFrame(fr)))
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeLessThan(counts[i - 1])
    }
  })

  test('the ring count is constant regardless of fraction (track + arc)', () => {
    expect(ringCount(restRingFrame(1))).toBe(ringCount(restRingFrame(0.3)))
  })

  test('arc starts at 12 o\'clock (top-centre lit, bottom-centre dim) when nearly full', () => {
    const f = restRingFrame(0.95)
    const side = GLYPH_SIDE
    const mid = Math.floor(side / 2)
    // Find the topmost lit ring LED in the centre column — it should be bright.
    let topY = -1
    for (let y = 0; y < side; y++) {
      if (f[y * side + mid] > 0) { topY = y; break }
    }
    expect(topY).toBeGreaterThanOrEqual(0)
    expect(f[topY * side + mid]).toBe(ARC)
  })

  test('clamps out-of-range fractions', () => {
    expect(arcCount(restRingFrame(5))).toBe(arcCount(restRingFrame(1)))
    expect(arcCount(restRingFrame(-2))).toBe(arcCount(restRingFrame(0)))
  })

  test('renders a recognisable dial (visual)', () => {
    // Not an assertion of pixels — just exercises the path and documents shape.
    expect(render(restRingFrame(0.5))).toContain('#')
  })
})

describe('fullFrame / blankFrame', () => {
  test('fullFrame is all-on', () => {
    expect(fullFrame().every((v) => v === ARC)).toBe(true)
  })
  test('blankFrame is all-off', () => {
    expect(blankFrame().every((v) => v === 0)).toBe(true)
  })
})
