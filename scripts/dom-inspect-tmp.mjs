import { chromium } from 'playwright-core'
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell'
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
await page.goto('http://localhost:5199/finance', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
// screenshot pixels were 2x: band at y=152..164 device px = CSS 76..82
const info = await page.evaluate(() => {
  const out = []
  for (const y of [70, 76, 79, 82, 88, 100, 111]) {
    const els = document.elementsFromPoint(195, y).slice(0, 4).map(e => {
      const cs = getComputedStyle(e)
      return `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.split(' ').slice(0,2).join('.') : ''} bg=${cs.backgroundColor} bb=${cs.borderBottom} sh=${cs.boxShadow !== 'none' ? 'SHADOW' : 'none'}`
    })
    out.push(`y=${y}: ` + els.join(' | '))
  }
  // header + content geometry
  const header = document.querySelector('ion-header')
  const content = document.querySelector('ion-content')
  const inner = content?.shadowRoot?.querySelector('.inner-scroll')
  const hr = header?.getBoundingClientRect(), cr = content?.getBoundingClientRect(), ir = inner?.getBoundingClientRect()
  return out.concat([
    `header rect: ${JSON.stringify(hr)}`,
    `content rect: ${JSON.stringify(cr)}`,
    `inner-scroll rect: ${JSON.stringify(ir)}`,
    `content shadow-html: ${content?.shadowRoot?.innerHTML.slice(0, 400)}`,
  ])
})
console.log(info.join('\n'))
await browser.close()
