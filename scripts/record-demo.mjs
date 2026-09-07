// Records the README demo: the PRD §9.1 scenario on examples/next-app /dashboard.
// Usage: pnpm build && (pnpm --filter next-app dev -p 3123 &) && node scripts/record-demo.mjs
//        ffmpeg -i test-results/demo-video/*.webm -vf "fps=10,scale=1000:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5" docs/images/overlay.gif
import { chromium } from '@playwright/test'

const dir = new URL('../test-results/demo-video/', import.meta.url).pathname
const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1200, height: 720 },
  recordVideo: { dir, size: { width: 1200, height: 720 } },
  permissions: ['clipboard-read', 'clipboard-write'],
})
const page = await context.newPage()
const pause = (ms) => page.waitForTimeout(ms)
const type = (text) => page.getByTestId('rl-note').pressSequentially(text, { delay: 22 })
const center = async (sel, dx = 0.5, dy = 0.5) => {
  const b = await page.locator(sel).first().boundingBox()
  return { x: b.x + b.width * dx, y: b.y + b.height * dy }
}

await page.goto('http://localhost:3123/dashboard')
await page.getByRole('button', { name: 'Redlining (Alt+R)' }).waitFor()
await pause(900)
await page.keyboard.press('Alt+r')
await pause(700)

// 1 · CHANGE — MainNav: hover the dropdown, walk up to the <details>, note.
const nav = await center('.main-nav summary')
await page.mouse.move(nav.x, nav.y)
await pause(700)
await page.keyboard.press('[')
await pause(900)
await page.mouse.click(nav.x, nav.y)
await pause(500)
await type(
  'Replace the dropdown with a horizontal top nav. Same items, same order. Active item underlined.',
)
await pause(400)
await page.keyboard.press('Enter')
await pause(700)

// 2 · ADD — inside FilterPanel: draw a box below the chips.
await page.keyboard.press('d')
await pause(400)
const search = await page.locator('.filters .search').boundingBox()
const body = await page.locator('.filters').boundingBox()
await page.mouse.move(search.x + 4, search.y + search.height + 4)
await page.mouse.down()
await page.mouse.move(search.x + search.width - 4, body.y + body.height - 4, { steps: 24 })
await page.mouse.up()
await pause(500)
await page.getByRole('button', { name: 'Table' }).click()
await pause(250)
await type('Sortable table. Columns: Name, Status, Updated. Reuse our DataTable if present.')
await pause(400)
await page.keyboard.press('Enter')
await pause(700)

// 3 · REMOVE — the Export CSV button.
await page.keyboard.press('s')
await pause(300)
const exp = await center('button:has-text("Export CSV")')
await page.mouse.move(exp.x, exp.y)
await pause(700)
await page.mouse.click(exp.x, exp.y)
await pause(400)
await page.getByRole('button', { name: 'Remove' }).click()
await pause(250)
await type("Remove; the action moves into the new table's row menu.")
await pause(400)
await page.keyboard.press('Enter')
await pause(700)

// 4 · MOVE — QuickStats above the main column.
await page.keyboard.press('m')
await pause(300)
const stats = await center('.stats', 0.5, 0.97)
await page.mouse.move(stats.x, stats.y)
await pause(500)
await page.keyboard.press('[')
await pause(700)
await page.mouse.click(stats.x, stats.y)
await pause(500)
const head = await center('.page-head', 0.9, 0.5)
await page.mouse.move(head.x, head.y)
await pause(700)
await page.mouse.click(head.x, head.y)
await pause(500)
await page.getByRole('button', { name: 'after', exact: true }).click()
await pause(250)
await type('Show quick stats above the main content on this page only.')
await pause(400)
await page.keyboard.press('Enter')
await pause(700)

// Review and save.
await page.keyboard.press('l')
await pause(1600)
await page.getByRole('button', { name: 'Save to project (⌘⏎)' }).click()
await page.getByTestId('rl-toast').waitFor()
await pause(1800)
await context.close()
await browser.close()
console.log('recorded to', dir)
