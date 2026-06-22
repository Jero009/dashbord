// Drives the rest-timer countdown on the Nothing Glyph Matrix (back LED grid).
// Thin orchestration layer over the glyphMatrix bridge + glyphFrames geometry:
// WorkoutPage just calls glyphRestDraw()/glyphRestEnd()/glyphRestStop() and this
// handles binding the matrix once and tolerating non-Nothing devices (all calls
// no-op when the matrix isn't available).

import { glyphInit, glyphDraw, glyphClear, glyphDeinit } from './glyphMatrix'
import { restRingFrame, fullFrame, blankFrame } from './glyphFrames'

// One lazy bind per page session. `ready` is null until the first attempt
// resolves, then true (bound) or false (no matrix — stop trying).
let initPromise: Promise<boolean> | null = null
let ready: boolean | null = null

async function ensureReady(): Promise<boolean> {
  if (ready !== null) return ready
  if (!initPromise) initPromise = glyphInit()
  ready = await initPromise
  return ready
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// Draw the depleting dial for `fraction` of rest remaining (0..1). Safe to call
// every tick — binding happens once, later calls are a single draw.
export async function glyphRestDraw(fraction: number): Promise<void> {
  if (!(await ensureReady())) return
  await glyphDraw(restRingFrame(fraction))
}

// End-of-rest flourish: a couple of full-grid flashes (companion to the audible
// ding), then hand the matrix back to the system.
export async function glyphRestEnd(): Promise<void> {
  if (ready !== true) return
  for (let i = 0; i < 2; i++) {
    await glyphDraw(fullFrame())
    await sleep(140)
    await glyphDraw(blankFrame())
    await sleep(120)
  }
  await glyphClear()
}

// Stop drawing immediately (skip/stop) and hand the matrix back.
export async function glyphRestStop(): Promise<void> {
  if (ready !== true) return
  await glyphClear()
}

// Blank the matrix and release the binding when leaving the workout page (also
// covers ending/cancelling a workout while a rest timer is still counting down).
export async function glyphRestRelease(): Promise<void> {
  if (ready === true) {
    await glyphClear()
    await glyphDeinit()
  }
  initPromise = null
  ready = null
}
