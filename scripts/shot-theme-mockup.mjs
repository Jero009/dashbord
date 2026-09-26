// Screenshot the theme comparison mockup with Playwright's bundled headless
// Chromium (headless shell found at ~/.cache/ms-playwright). Usage:
//   node scripts/shot-theme-mockup.mjs
// Writes docs/design/theme-comparison.png (all four variants in one image)
// plus per-variant PNGs for the design doc.
import { chromium } from 'playwright-core'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '../docs/design')
mkdirSync(outDir, { recursive: true })

// Find the headless shell playwright-core knows about.
const exe = process.env.PLAYWRIGHT_CHROMIUM || undefined

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1560, height: 820 }, deviceScaleFactor: 2 })

const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto('file://' + resolve(outDir, 'theme-mockup.html'))
await page.waitForTimeout(600) // fonts + backdrop-filter settle

await page.screenshot({ path: resolve(outDir, 'theme-comparison.png'), fullPage: true })

// Per-variant crops for the design doc
for (const id of ['classic-dark', 'os5-dark', 'classic-light', 'os5-light']) {
  const el = page.locator('#' + id)
  await el.screenshot({ path: resolve(outDir, `variant-${id}.png`) })
}

await browser.close()

if (errors.length) {
  console.error('PAGE ERRORS:\n' + errors.join('\n'))
  process.exit(1)
}
console.log('OK — screenshots written to', outDir)
