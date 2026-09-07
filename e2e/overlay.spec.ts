import { existsSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const OUT = path.resolve('examples/next-app/.redlining')

/** `file:line` per fixture element, read from the loader's own stamps, so nothing here hard-codes line numbers. */
async function stampsOf(page: Page): Promise<Record<string, string>> {
  const rows = await page
    .locator('[data-spike]')
    .evaluateAll((els) =>
      els.map((el) => [el.getAttribute('data-spike')!, el.getAttribute('data-rl')!]),
    )
  return Object.fromEntries(rows.map(([n, rl]) => [n, rl!.replace(/:\d+$/, '')]))
}

/** The overlay lives in a shadow root; Playwright pierces it with plain locators. */
async function openOverlay(page: Page) {
  await page.goto('/spike')
  // The toggle is client-rendered after hydration; the hotkey listener registers with it.
  await expect(page.getByRole('button', { name: 'Redlining (Alt+R)' })).toBeVisible()
  await page.keyboard.press('Alt+r')
  await expect(page.getByRole('toolbar', { name: 'Redlining' })).toBeVisible()
}

test.beforeEach(() => rmSync(OUT, { recursive: true, force: true }))

test('the loader anchors every fixture element', async ({ page }) => {
  await page.goto('/spike')
  const rows = await page
    .locator('[data-spike]')
    .evaluateAll((els) =>
      els.map((el) => [el.getAttribute('data-spike'), el.getAttribute('data-rl')]),
    )
  expect(rows).toHaveLength(20)
  for (const [n, rl] of rows) expect(rl, `element ${n}`).toMatch(/^app\/spike\/\w+\.tsx:\d+:\d+$/)
})

test('select mode: hover badge, click, note, pin, list, save to project', async ({ page }) => {
  await openOverlay(page)
  const at = await stampsOf(page)

  const nav = page.locator('[data-spike="4"]')
  await nav.hover()
  await expect(page.locator('.rl-badge')).toContainText(at['4']!)
  await nav.click()

  const popover = page.getByTestId('rl-popover')
  await expect(popover).toBeVisible()
  await expect(popover).toContainText(at['4']!)
  await page.getByTestId('rl-note').fill('Turn this into a horizontal top nav.')
  await page.keyboard.press('Enter')
  await expect(popover).toBeHidden()
  await expect(page.getByTestId('rl-pin')).toHaveText('1')

  await page.keyboard.press('l')
  const panel = page.getByTestId('rl-panel')
  await expect(panel).toContainText('Annotations (1)')
  await expect(panel.getByTestId('rl-row')).toContainText('change')
  await expect(panel.getByTestId('rl-row')).toContainText('Turn this into a horizontal top nav.')

  await page.getByRole('button', { name: 'Save to project (⌘⏎)' }).click()
  await expect(page.getByTestId('rl-toast')).toContainText('Saved')
  const md = readFileSync(path.join(OUT, 'annotations.md'), 'utf8')
  expect(md).toContain('# Redlining — /spike')
  expect(md).toContain('## 1 · CHANGE — "DashboardReports" nav')
  expect(md).toContain(`- Anchor: \`<nav>\` · ${at['4']}`)
  expect(md).toContain('- Note: Turn this into a horizontal top nav.')
  expect(existsSync(path.join(OUT, 'annotations.json'))).toBe(true)
  // Screenshot with burned-in pins, on by default.
  expect(md).toContain('Screenshot: .redlining/screenshot.png (pins numbered as below)')
  const png = readFileSync(path.join(OUT, 'screenshot.png'))
  expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  expect(png.length).toBeGreaterThan(1000)
})

test('draw mode: a dragged box resolves its container and exports an ADD with a position', async ({
  page,
}) => {
  await openOverlay(page)
  await page.keyboard.press('d')
  const section = page.locator('[data-spike="1"]')
  const box = (await section.boundingBox())!
  // Drag across the lower half of the layout section; it covers ≥ 60 % of the box.
  await page.mouse.move(box.x + 20, box.y + box.height - 60)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 20, box.y + box.height - 10, { steps: 8 })
  await page.mouse.up()
  const popover = page.getByTestId('rl-popover')
  await expect(popover).toContainText('Add inside')
  await page.getByRole('button', { name: 'Table' }).click()
  await page.getByTestId('rl-note').fill('Sortable results table.')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('rl-pin')).toHaveText('1')

  await page.getByRole('button', { name: 'Copy prompt (⌘⇧C)' }).click()
  await expect(page.getByTestId('rl-toast')).toContainText('Copied')
  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboard).toContain('## 1 · ADD — inside <section>')
  expect(clipboard).toMatch(
    /- Position: (at end|at start|after child \d+) · full width · ≈ \d+ px tall/,
  )
  expect(clipboard).toContain('- Note: Table: Sortable results table.')
})

test('Escape unwinds popover, panel and overlay; the host page is untouched when inactive', async ({
  page,
}) => {
  await openOverlay(page)
  await page.locator('[data-spike="8"]').click()
  await expect(page.getByTestId('rl-popover')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('rl-popover')).toBeHidden()
  await page.keyboard.press('l')
  await expect(page.getByTestId('rl-panel')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('rl-panel')).toBeHidden()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('toolbar', { name: 'Redlining' })).toBeHidden()
  // Inactive: a click reaches the page's own handler.
  await page.locator('[data-spike="18"]').click()
  await expect(page.locator('[data-spike="17"]')).toHaveValue('1')
})

test('the session survives a reload and can be cleared', async ({ page }) => {
  await openOverlay(page)
  await page.locator('[data-spike="9"]').click()
  await page.getByTestId('rl-note').fill('Shorter copy.')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('rl-pin')).toHaveText('1')

  await page.reload()
  await openOverlay(page)
  await expect(page.getByTestId('rl-pin')).toHaveText('1')
  await page.keyboard.press('l')
  await expect(page.getByTestId('rl-panel')).toContainText('Shorter copy.')

  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Clear session' }).click()
  await expect(page.getByTestId('rl-pin')).toHaveCount(0)
  await page.reload()
  await openOverlay(page)
  await expect(page.getByTestId('rl-pin')).toHaveCount(0)
})

test('move mode: source, target and a position produce a MOVE with from and to', async ({
  page,
}) => {
  await openOverlay(page)
  const at = await stampsOf(page)
  await page.keyboard.press('m')
  await page.locator('[data-spike="14"]').click()
  await expect(page.locator('.rl-outline--source')).toBeVisible()
  await page.locator('[data-spike="4"]').click()
  const popover = page.getByTestId('rl-popover')
  await expect(popover).toContainText('Move <aside>')
  await page.getByRole('button', { name: 'after', exact: true }).click()
  await page.getByTestId('rl-note').fill('Aside belongs under the nav.')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('rl-pin')).toHaveText('1')
  await expect(page.locator('.rl-pin--target')).toHaveText('→1')

  await page.getByRole('button', { name: 'Copy prompt (⌘⇧C)' }).click()
  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboard).toContain('## 1 · MOVE — "aside" aside')
  expect(clipboard).toContain(`- From: \`<aside>\` · ${at['14']}`)
  expect(clipboard).toContain(`- To: after \`<nav>\` · ${at['4']}`)
})

test('multi-select: Shift+click adds anchors to one note', async ({ page }) => {
  await openOverlay(page)
  const at = await stampsOf(page)
  await page.locator('[data-spike="5"]').click()
  await expect(page.getByTestId('rl-popover')).toContainText('⇧click adds more')
  await page.locator('[data-spike="6"]').click({ modifiers: ['Shift'] })
  await expect(page.getByTestId('rl-popover')).toContainText('+1')
  await page.getByTestId('rl-note').fill('Same padding on both.')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('rl-pin')).toHaveCount(2)
  await expect(page.getByTestId('rl-pin').nth(1)).toHaveText('1')

  await page.getByRole('button', { name: 'Copy prompt (⌘⇧C)' }).click()
  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboard).toContain('## 1 · CHANGE — "Dashboard" a (+1)')
  expect(clipboard).toContain(`- Anchors:\n  1. \`<a>\` · ${at['5']}\n  2. \`<a>\` · ${at['6']}`)
})

test('dashboard: the owner chain names client components and the anchor points into components/', async ({
  page,
}) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: 'Redlining (Alt+R)' })).toBeVisible()
  await page.keyboard.press('Alt+r')
  await expect(page.getByRole('toolbar', { name: 'Redlining' })).toBeVisible()
  const exportButton = page.getByRole('button', { name: 'Export CSV' })
  await exportButton.hover()
  const badge = page.locator('.rl-badge')
  await expect(badge).toContainText('Toolbar')
  await expect(badge).toContainText('components/toolbar.tsx:')
  await exportButton.click()
  await expect(page.getByTestId('rl-popover')).toContainText('Toolbar')
  await page.getByRole('button', { name: 'Remove' }).click()
  await page.getByTestId('rl-note').fill('Move into the row menu.')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Copy prompt (⌘⇧C)' }).click()
  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboard).toContain('## 1 · REMOVE — "Export CSV" button')
  expect(clipboard).toMatch(/- Anchor: `<button>` · components\/toolbar\.tsx:\d+ · owners: Toolbar/)
})
