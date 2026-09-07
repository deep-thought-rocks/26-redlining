// Records the README demo: the overlay flow on examples/next-app /spike (dev server on :3123).
// Usage: pnpm build && pnpm --filter next-app dev -p 3123 & node scripts/record-demo.mjs && ffmpeg … (see docs/images).
import { chromium } from '@playwright/test'
const dir = new URL('../test-results/demo-video/', import.meta.url).pathname
const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1100, height: 660 },
  recordVideo: { dir, size: { width: 1100, height: 660 } },
  permissions: ['clipboard-read', 'clipboard-write'],
})
const page = await context.newPage()
await page.goto('http://localhost:3123/spike')
await page.getByRole('button', { name: 'Redlining (Alt+R)' }).waitFor()
await page.waitForTimeout(800)
await page.keyboard.press('Alt+r')
await page.waitForTimeout(600)
const nav = page.locator('[data-spike="4"]')
await nav.hover()
await page.waitForTimeout(900)
await nav.click()
await page.waitForTimeout(500)
await page
  .getByTestId('rl-note')
  .pressSequentially('Turn this into a horizontal top nav. Active item underlined.', { delay: 28 })
await page.waitForTimeout(400)
await page.keyboard.press('Enter')
await page.waitForTimeout(700)
await page.keyboard.press('d')
await page.waitForTimeout(400)
const sec = await page.locator('[data-spike="7"]').boundingBox()
await page.mouse.move(sec.x + 10, sec.y + sec.height - 40)
await page.mouse.down()
await page.mouse.move(sec.x + sec.width - 10, sec.y + sec.height + 90, { steps: 20 })
await page.mouse.up()
await page.waitForTimeout(500)
await page.getByRole('button', { name: 'Table' }).click()
await page.waitForTimeout(300)
await page
  .getByTestId('rl-note')
  .pressSequentially('Sortable results, columns Name / Status / Updated.', { delay: 28 })
await page.waitForTimeout(400)
await page.keyboard.press('Enter')
await page.waitForTimeout(700)
await page.keyboard.press('l')
await page.waitForTimeout(1200)
await page.getByRole('button', { name: 'Save to project (⌘⏎)' }).click()
await page.getByTestId('rl-toast').waitFor()
await page.waitForTimeout(1600)
await context.close()
await browser.close()
console.log('recorded to', dir)
