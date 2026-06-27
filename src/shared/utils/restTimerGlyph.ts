import { glyphInit, glyphDraw, glyphTurnOff, glyphDeinit, glyphMatrixLength } from './glyphMatrix'

// Draws the rest-timer countdown on the Nothing Glyph Matrix (the back LED grid)
// while the app is in the foreground.
//
// IMPORTANT: app-matrix mode is foreground-only — the system reclaims the matrix
// when the app is backgrounded, so this can only ever drive the display while
// the WorkoutPage is open. The backgrounded countdown is covered by the ongoing
// notification chronometer + the scheduled OS ding, NOT by this. When the app
// returns to the foreground the timer re-renders here.
//
// Visual: a depleting progress ring around the border (the at-a-glance "counter")
// plus the remaining whole seconds centered. 1–2 digits use a bold 5x7 font; 3
// digits fall back to a compact 3x5 font. Everything is size-agnostic: the grid
// side length is sqrt(matrix length) (13 on the Phone (4a) Pro, 25 on Phone (3)).

const RING_BRIGHTNESS = 110
const DIGIT_BRIGHTNESS = 255

// 5x7 bold font (rows top→bottom), used when 1–2 digits fit comfortably.
const FONT_5x7: Record<string, string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
}

// 3x5 compact font, used when 3 digits are needed (>= 100 s remaining).
const FONT_3x5: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
}

// Perimeter coordinates clockwise, starting from the top-centre LED, so the ring
// depletes symmetrically from the top as time runs out.
function perimeterClockwise(side: number): Array<[number, number]> {
  const coords: Array<[number, number]> = []
  for (let c = 0; c < side; c++) coords.push([0, c]) // top, left→right
  for (let r = 1; r < side; r++) coords.push([r, side - 1]) // right, top→bottom
  for (let c = side - 2; c >= 0; c--) coords.push([side - 1, c]) // bottom, right→left
  for (let r = side - 2; r >= 1; r--) coords.push([r, 0]) // left, bottom→top
  const start = Math.floor(side / 2) // index of the top-centre LED in `coords`
  return coords.slice(start).concat(coords.slice(0, start))
}

// Blit the digit string into the centre of `frame` using the given font.
function blitDigits(frame: number[], side: number, text: string, font: Record<string, string[]>) {
  const rows = font['0'].length
  const glyphW = font['0'][0].length
  const gap = 1
  const totalW = text.length * glyphW + (text.length - 1) * gap
  const startCol = Math.floor((side - totalW) / 2)
  const startRow = Math.floor((side - rows) / 2)

  for (let d = 0; d < text.length; d++) {
    const glyph = font[text[d]]
    if (!glyph) continue
    const colOffset = startCol + d * (glyphW + gap)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < glyphW; c++) {
        if (glyph[r][c] !== '1') continue
        const rr = startRow + r
        const cc = colOffset + c
        if (rr < 0 || rr >= side || cc < 0 || cc >= side) continue
        frame[rr * side + cc] = DIGIT_BRIGHTNESS
      }
    }
  }
}

// Build the full per-LED brightness frame for a given remaining/total. Pure —
// unit-tested in tests/unit/restTimerGlyph.spec.ts.
export function buildRestFrame(side: number, remaining: number, total: number): number[] {
  const frame = new Array<number>(side * side).fill(0)
  if (side <= 0) return frame

  const secs = Math.max(0, Math.ceil(remaining))

  // Depleting ring: fraction of time left, lit clockwise from the top.
  const fraction = total > 0 ? Math.min(1, Math.max(0, remaining / total)) : 0
  const ring = perimeterClockwise(side)
  const lit = Math.round(fraction * ring.length)
  for (let i = 0; i < lit; i++) {
    const [r, c] = ring[i]
    frame[r * side + c] = RING_BRIGHTNESS
  }

  // Centre number: always whole seconds remaining (no unit ambiguity). Use the
  // bold font for 1–2 digits, the compact font once we need 3.
  const text = String(secs)
  blitDigits(frame, side, text, text.length >= 3 ? FONT_3x5 : FONT_5x7)
  return frame
}

// side: -1 = not yet probed, 0 = unavailable (web / non-Nothing), >0 = grid side.
let side = -1
let initInFlight: Promise<void> | null = null

async function ensureReady(): Promise<void> {
  if (side >= 0) return
  if (!initInFlight) {
    initInFlight = (async () => {
      const ready = await glyphInit()
      side = ready ? Math.round(Math.sqrt(await glyphMatrixLength())) || 0 : 0
    })()
  }
  await initInFlight
}

// Draw one frame of the countdown. Safe to call every tick; no-ops off-device.
export async function showRestGlyph(remaining: number, total: number): Promise<void> {
  await ensureReady()
  if (side <= 0) return
  await glyphDraw(buildRestFrame(side, remaining, total))
}

// Blank the matrix when the timer ends or is skipped.
export async function hideRestGlyph(): Promise<void> {
  if (side <= 0) return
  await glyphTurnOff()
}

// Release the matrix binding (call when leaving the workout page).
export async function releaseRestGlyph(): Promise<void> {
  if (side > 0) await glyphTurnOff()
  await glyphDeinit()
  side = -1
  initInFlight = null
}
