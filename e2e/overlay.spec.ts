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
  // The nav lives in page.tsx; its usage site is the layout's <section>, where <main> is the 2nd of 2 children.
  expect(md).toContain(
    `- Anchor: \`<nav>\` · ${at['4']} · instance 2 of 2 in \`<section>\` · ${at['1']}`,
  )
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
  expect(clipboard).toContain('- Anchors:\n')
  expect(clipboard).toContain(`  1. \`<a>\` · ${at['5']}`)
  expect(clipboard).toContain(`  2. \`<a>\` · ${at['6']}`)
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
  await page.getByTestId('rl-note').fill('Move into the row menu. '.repeat(8).trim())
  await page.keyboard.press('Enter')

  // The list row expands to the full anchor, owners, usage site and note.
  await page.keyboard.press('l')
  const row = page.getByTestId('rl-row')
  await expect(row.locator('.rl-row-note--clamp')).toBeVisible()
  await expect(page.getByTestId('rl-row-details')).toHaveCount(0)
  await page.getByRole('button', { name: 'Expand annotation 1' }).click()
  const details = page.getByTestId('rl-row-details')
  await expect(details).toContainText('components/toolbar.tsx:')
  await expect(details).toContainText('owners: Toolbar')
  await expect(details).toContainText('instance')
  await expect(details).toContainText('“Export CSV”')
  await expect(row.locator('.rl-row-note--clamp')).toHaveCount(0)
  await page.getByRole('button', { name: 'Collapse annotation 1' }).click()
  await expect(page.getByTestId('rl-row-details')).toHaveCount(0)
  await page.keyboard.press('l')
  await page.getByRole('button', { name: 'Copy prompt (⌘⇧C)' }).click()
  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboard).toContain('## 1 · REMOVE — "Export CSV" button')
  expect(clipboard).toMatch(/- Anchor: `<button>` · components\/toolbar\.tsx:\d+ · owners: Toolbar/)
})

test('tweak mode: steppers and text edit preview live, export deltas with classes, and survive a reload', async ({
  page,
}) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: 'Redlining (Alt+R)' })).toBeVisible()
  await page.keyboard.press('Alt+r')
  await page.keyboard.press('t')
  // A structural locator: the accessible name changes once the text is edited.
  const button = page.locator('.toolbar button').first()
  await expect(button).toHaveText('Export CSV')
  const before = await button.evaluate((el) => ({
    size: getComputedStyle(el).fontSize,
    width: getComputedStyle(el).width,
  }))
  await button.click()
  const inspector = page.getByTestId('rl-inspector')
  await expect(inspector).toContainText('Tweak Toolbar')

  await page.getByRole('button', { name: 'Font size +1' }).click()
  await page.getByRole('button', { name: 'Font size +1' }).click()
  await page.getByRole('button', { name: 'Width +4' }).click()
  await page.getByTestId('rl-tweak-text').fill('Download CSV')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('rl-tweak-changes')).toContainText(
    `font-size: ${before.size} → ${parseFloat(before.size) + 2}px`,
  )
  await expect(button).toHaveText('Download CSV')
  await expect(button).toHaveCSS('font-size', `${parseFloat(before.size) + 2}px`)

  // Undo removes only the last change (the text edit).
  await page.keyboard.press('Meta+z')
  await expect(button).toHaveText('Export CSV')
  await page.getByTestId('rl-tweak-text').fill('Download CSV')
  await page.keyboard.press('Enter')

  await page.getByTestId('rl-tweak-done').click()
  const popover = page.getByTestId('rl-popover')
  await expect(popover.getByTestId('rl-note-changes')).toContainText(
    'text: "Export CSV" → "Download CSV"',
  )
  await page.keyboard.press('Enter') // empty note is fine for a tweak
  await expect(page.getByTestId('rl-pin')).toHaveText('1')
  await expect(page.locator('.rl-pin--tweak')).toHaveCount(1)

  await page.getByRole('button', { name: 'Copy prompt (⌘⇧C)' }).click()
  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboard).toContain('## 1 · CHANGE — Toolbar')
  expect(clipboard).toContain('- Classes: `btn`')
  expect(clipboard).toContain(`  - font-size: ${before.size} → ${parseFloat(before.size) + 2}px`)
  // Steppers snap to their grid (width: 4px).
  const snapped = Math.round((parseFloat(before.width) + 4) / 4) * 4
  expect(clipboard).toContain(`  - width: ${before.width} → ${snapped}px`)
  expect(clipboard).toContain('  - text: "Export CSV" → "Download CSV"')
  expect(clipboard).not.toContain('- Note:')
  expect(clipboard).toContain('not as inline styles.')

  // Reload: the preview is re-applied to the re-found element.
  await page.reload()
  await expect(page.getByRole('button', { name: 'Redlining (Alt+R)' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download CSV' })).toHaveCSS(
    'font-size',
    `${parseFloat(before.size) + 2}px`,
  )
  await page.keyboard.press('Alt+r')
  await page.keyboard.press('l')
  await page.getByRole('button', { name: 'Expand annotation 1' }).click()
  await expect(page.getByTestId('rl-row-details')).toContainText(
    'text: "Export CSV" → "Download CSV"',
  )
  // Deleting the annotation resets the element.
  await page.getByRole('button', { name: 'Delete annotation 1' }).click()
  await expect(page.getByRole('button', { name: 'Export CSV' })).toHaveCSS('font-size', before.size)
})

test('tweak gestures: a handle drag resizes, arrow keys nudge, and both export', async ({
  page,
}) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: 'Redlining (Alt+R)' })).toBeVisible()
  await page.keyboard.press('Alt+r')
  await page.keyboard.press('t')
  const card = page.locator('.sidebar aside').first()
  const before = await card.evaluate((el) => getComputedStyle(el).width)
  // Hover the heading, walk up to the <aside> with [ twice, then click where the mouse is.
  const heading = card.locator('h2').first()
  await heading.hover()
  await expect(page.locator('.rl-badge')).toContainText('<h2>')
  await page.keyboard.press('[')
  await page.keyboard.press('[')
  await expect(page.locator('.rl-badge')).toContainText('<aside>')
  const hb = (await heading.boundingBox())!
  await page.mouse.click(hb.x + hb.width / 2, hb.y + hb.height / 2)
  await expect(page.getByTestId('rl-inspector')).toContainText('Tweak QuickStats')

  const handle = page.getByTestId('rl-handle-e')
  const box = (await handle.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 - 40, box.y + box.height / 2, { steps: 10 })
  await page.mouse.up()
  const expected = `${Math.round(parseFloat(before) - 40)}px`
  await expect(card).toHaveCSS('width', expected)

  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Shift+ArrowDown')
  await expect(card).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 2, 10)')
  await expect(page.getByTestId('rl-tweak-changes')).toContainText(
    'visual nudge: +2px right, +10px down',
  )

  await page.getByTestId('rl-tweak-done').click()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Copy prompt (⌘⇧C)' }).click()
  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboard).toContain(`  - width: ${before} → ${expected}`)
  expect(clipboard).toContain(
    '  - visual nudge: +2px right, +10px down — previewed with a transform; implement as spacing or alignment, never ship a transform',
  )
})

test('tweak: colour tokens, layout chips and the Alt-hover ruler', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: 'Redlining (Alt+R)' })).toBeVisible()
  await page.keyboard.press('Alt+r')
  await page.keyboard.press('t')
  const chips = page.locator('.chips').first()
  const chipsBox = (await chips.boundingBox())!
  // The chips row is a flex container: click its trailing gap so the row itself is picked.
  await page.mouse.click(chipsBox.x + chipsBox.width - 4, chipsBox.y + chipsBox.height / 2)
  const inspector = page.getByTestId('rl-inspector')
  await expect(inspector).toContainText('Layout (flex)')
  await page.getByRole('button', { name: 'Gap +2' }).click()
  await expect(chips).toHaveCSS('gap', '10px')
  await page.getByRole('button', { name: 'space-between', exact: true }).click()
  await expect(chips).toHaveCSS('justify-content', 'space-between')
  await page.getByTestId('rl-token-background-color').selectOption('--accent')
  await expect(chips).toHaveCSS('background-color', 'rgb(37, 99, 235)')
  await expect(page.getByTestId('rl-tweak-changes')).toContainText(
    'background-color: rgba(0, 0, 0, 0) → rgb(37, 99, 235) (token --accent)',
  )

  // Alt+hover another element shows the ruler; nothing is recorded.
  const search = page.locator('.filters .search').first()
  const sb = (await search.boundingBox())!
  await page.keyboard.down('Alt')
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2)
  await expect(page.getByTestId('rl-ruler')).toHaveCount(1)
  await expect(page.getByTestId('rl-ruler')).toContainText('px')
  await page.keyboard.up('Alt')
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2 + 1)
  await expect(page.getByTestId('rl-ruler')).toHaveCount(0)
  await expect(page.getByTestId('rl-tweak-changes')).not.toContainText('nudge')
})

test('viewport preset marks annotations and the before/after screenshot writes two files', async ({
  page,
}) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: 'Redlining (Alt+R)' })).toBeVisible()
  await page.keyboard.press('Alt+r')
  await page.getByTestId('rl-viewport').selectOption('768')
  await expect(page.locator('html')).toHaveAttribute('data-rl-viewport', '768')
  await expect(page.locator('html')).toHaveCSS('max-width', '768px')

  await page.keyboard.press('t')
  const button = page.locator('.toolbar button').first()
  await button.click()
  await page.getByRole('button', { name: 'Font size +1' }).click()
  await page.getByTestId('rl-tweak-done').click()
  await page.keyboard.press('Enter')

  await page
    .getByRole('button', { name: 'Also capture a before screenshot (previews reset)' })
    .click()
  await page.getByRole('button', { name: 'Save to project (⌘⏎)' }).click()
  await expect(page.getByTestId('rl-toast')).toContainText('Saved')
  const md = readFileSync(path.join(OUT, 'annotations.md'), 'utf8')
  expect(md).toContain('· preset ≤ 768px)')
  expect(md).toContain('- Applies at: ≤ 768px (approximate; viewport preset, not a media query)')
  expect(md).toContain('· before the tweaks: .redlining/screenshot-before.png')
  expect(existsSync(path.join(OUT, 'screenshot-before.png'))).toBe(true)
  expect(existsSync(path.join(OUT, 'screenshot.png'))).toBe(true)

  await page.getByTestId('rl-viewport').selectOption('')
  await expect(page.locator('html')).not.toHaveAttribute('data-rl-viewport', '768')
})
