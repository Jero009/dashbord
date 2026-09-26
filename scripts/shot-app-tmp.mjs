import { chromium } from 'playwright-core'
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell'
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', e => errors.push(String(e)))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

const combos = [
  ['classic-dark', ''],
  ['os5-dark', 'theme-os5'],
  ['classic-light', 'theme-light'],
  ['os5-light', 'theme-os5 theme-light'],
]
for (const [name, cls] of combos) {
  await page.goto('http://localhost:5199/finance', { waitUntil: 'networkidle' })
  await page.evaluate((c) => {
    document.documentElement.classList.remove('theme-light', 'theme-os5')
    if (c) for (const k of c.split(' ')) document.documentElement.classList.add(k)
  }, cls)
  await page.waitForTimeout(900)
  await page.screenshot({ path: `/tmp/app-${name}.png` })
  console.log('shot', name)
}
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.slice(0,5).join('\n')); process.exit(1) }
await browser.close()
console.log('DONE')
