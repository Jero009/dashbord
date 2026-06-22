import { registerPlugin, Capacitor } from '@capacitor/core'

// Native bridge to the Nothing Glyph Matrix — the dot-matrix LED display on the
// back of the Nothing Phone (3) and (4a) Pro. Wraps GlyphMatrix.java, which
// drives the matrix in "app matrix" mode (the foreground app pushes frames
// directly, no Glyph Toy registration needed).
//
// This is a pure transport layer: it connects and pushes raw per-LED brightness
// arrays. It does NOT decide what to draw — callers build the pixel array and
// pass it to draw(). The grid is square; size the array with matrixLength():
//   - Nothing Phone (4a) Pro: 13x13 = 169 LEDs
//   - Nothing Phone (3):      25x25 = 625 LEDs
// Pixels are row-major, each value a brightness 0–255.
//
// Everything no-ops (or returns a falsy "not ready") off-device so the app keeps
// working on web and on non-Nothing phones.
interface GlyphMatrixPlugin {
  init(): Promise<{ ready: boolean }>
  draw(options: { pixels: number[] }): Promise<void>
  clear(): Promise<void>
  turnOff(): Promise<void>
  getMatrixLength(): Promise<{ length: number }>
  isReady(): Promise<{ ready: boolean }>
  deinit(): Promise<void>
}

const GlyphMatrix = registerPlugin<GlyphMatrixPlugin>('GlyphMatrix')

// Bind to the matrix and register the device. Resolves true once the matrix is
// ready to receive frames, false on any non-Nothing device or if the service
// never connects (init has a native timeout, so this won't hang).
export async function glyphInit(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const { ready } = await GlyphMatrix.init()
    return ready
  } catch (e) {
    console.warn('GlyphMatrix.init failed:', e)
    return false
  }
}

// Push one frame. `pixels` is a row-major array of per-LED brightness (0–255),
// length matrixLength() for the current device. Returns true if the frame was
// sent. Call glyphInit() first.
export async function glyphDraw(pixels: number[]): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    await GlyphMatrix.draw({ pixels })
    return true
  } catch (e) {
    console.warn('GlyphMatrix.draw failed:', e)
    return false
  }
}

// Stop driving the matrix (hands control back to the system). The LEDs keep
// their last frame until the system reclaims them; use glyphTurnOff() to blank.
export async function glyphClear(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await GlyphMatrix.clear()
  } catch (e) {
    console.warn('GlyphMatrix.clear failed:', e)
  }
}

// Blank all LEDs.
export async function glyphTurnOff(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await GlyphMatrix.turnOff()
  } catch (e) {
    console.warn('GlyphMatrix.turnOff failed:', e)
  }
}

// LED count for the current device (169 on the 4a Pro, 625 on the 3). Returns 0
// off-device or before glyphInit() succeeds. The grid side length is sqrt(this).
export async function glyphMatrixLength(): Promise<number> {
  if (!Capacitor.isNativePlatform()) return 0
  try {
    const { length } = await GlyphMatrix.getMatrixLength()
    return length
  } catch (e) {
    console.warn('GlyphMatrix.getMatrixLength failed:', e)
    return 0
  }
}

// Whether the matrix is bound and registered (i.e. draw() will work).
export async function glyphIsReady(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const { ready } = await GlyphMatrix.isReady()
    return ready
  } catch {
    return false
  }
}

// Release the binding. Call when you're done driving the matrix.
export async function glyphDeinit(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await GlyphMatrix.deinit()
  } catch (e) {
    console.warn('GlyphMatrix.deinit failed:', e)
  }
}
