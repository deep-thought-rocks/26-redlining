import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

test('the loader anchors every fixture element @webpack', async ({ page }) => {
  await page.goto('/spike')
  const rows = await page
    .locator('[data-spike]')
    .evaluateAll((els) =>
      els.map((el) => [el.getAttribute('data-spike'), el.getAttribute('data-rl')]),
    )
  expect(rows).toHaveLength(20)
  for (const [n, rl] of rows) expect(rl, `element ${n}`).toMatch(/^app\/spike\/\w+\.tsx:\d+:\d+$/)
})

test('select mode: hover badge, click, note, pin, list, save to project @webpack', async ({
  page,
}) => {
  await openOverlay(page)
  const at = await stampsOf(page)

  const nav = page.locator('[data-spike="4"]')
  await nav.hover()
  await expect(page.locator('.rl-badge')).toContainText(at['4']!)
  await nav.click()

  const popover = page.getByTestId('rl-popover')
  await expect(popover).toBeVisible()
  await expect(popover).toContainText(at['4']!)
  // A change needs a note: Enter on an empty one says so instead of silently doing nothing.
  await expect(page.getByTestId('rl-note-label')).toContainText('required')
  await expect(page.getByTestId('rl-note-save')).toBeDisabled()
  await page.keyboard.press('Enter')
  await expect(popover).toContainText('Write what should change first')
  await page.getByTestId('rl-note').fill('Turn this into a horizontal top nav.')
  await expect(page.getByTestId('rl-note-save')).toBeEnabled()
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
  expect(md).toMatch(/^# Redlining \d+\.\d+\.\d+ — \/spike/)
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
  // A synthetic keydown without a key (extensions, test tooling) must not throw in the overlay.
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  await page.evaluate(() => window.dispatchEvent(new Event('keydown')))
  await expect(page.getByRole('toolbar', { name: 'Redlining' })).toBeVisible()
  expect(errors).toEqual([])
  await page.locator('[data-spike="8"]').click()
  await expect(page.getByTestId('rl-popover')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('rl-popover')).toBeHidden()
  await page.keyboard.press('l')
  await expect(page.getByTestId('rl-panel')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('rl-panel')).toBeHidden()
  // The toolbar can be moved to another corner; the choice survives a reload.
  await expect(page.getByTestId('rl-toolbar')).toHaveAttribute('data-pos', 'bottom-right')
  await page.getByRole('button', { name: 'Move toolbar to another corner' }).click()
  await expect(page.getByTestId('rl-toolbar')).toHaveAttribute('data-pos', 'bottom-left')
  await page.reload()
  await expect(page.getByTestId('rl-toolbar')).toHaveAttribute('data-pos', 'bottom-left')
  await page.evaluate(() => localStorage.removeItem('redlining:position'))
  await page.keyboard.press('Alt+r')
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

  await page.getByRole('button', { name: 'Archive session' }).click() // in the panel header
  // The overlay's own dialog, not the browser's alert; Escape only closes the dialog.
  await expect(page.getByTestId('rl-confirm')).toContainText('Archive 1 annotation on this page?')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('rl-confirm')).toHaveCount(0)
  await expect(page.getByRole('toolbar', { name: 'Redlining' })).toBeVisible()
  await page.getByRole('button', { name: 'Archive session' }).click()
  await page.getByTestId('rl-confirm').getByRole('button', { name: 'Archive' }).click()
  await expect(page.getByTestId('rl-pin')).toHaveCount(0)
  await page.reload()
  await openOverlay(page)
  await expect(page.getByTestId('rl-pin')).toHaveCount(0)
  // Nothing is lost: the session went to the archive, where it can be restored or deleted.
  await page.keyboard.press('l')
  await page.getByTestId('rl-archive-toggle').click()
  await expect(page.getByTestId('rl-panel')).toContainText('Archive (1)')
  const row = page.getByTestId('rl-archive-row')
  await expect(row).toContainText('/spike')
  await expect(row).toContainText('Shorter copy.')
  await expect(row).toHaveAttribute('data-reason', 'archived')
  await row.getByRole('button', { name: /^Restore/ }).click()
  await expect(page.getByTestId('rl-panel')).toContainText('Archive (0)')
  await page.getByTestId('rl-archive-toggle').click()
  await expect(page.getByTestId('rl-panel')).toContainText('Annotations (1)')
  await expect(page.getByTestId('rl-pin')).toHaveText('1')
  // The row × archives too; deleting from the archive is final.
  await page.getByRole('button', { name: 'Archive annotation 1' }).click()
  await expect(page.getByTestId('rl-pin')).toHaveCount(0)
  await page.getByTestId('rl-archive-toggle').click()
  await page
    .getByTestId('rl-archive-row')
    .getByRole('button', { name: /^Delete archived/ })
    .click()
  await expect(page.getByTestId('rl-archive')).toContainText('Nothing archived yet')
  expect(await page.evaluate(() => localStorage.getItem('redlining:archive'))).toBeNull()
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
  // A move needs no note: From/To carry the intent.
  await expect(page.getByTestId('rl-note-label')).toContainText('optional')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('rl-pin')).toHaveText('1')
  await expect(page.locator('.rl-pin--target')).toHaveText('→1')

  await page.getByRole('button', { name: 'Copy prompt (⌘⇧C)' }).click()
  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboard).toContain('## 1 · MOVE — "aside" aside')
  expect(clipboard).not.toContain('- Note:')
  expect(clipboard).toContain(`- From: \`<aside>\` · ${at['14']}`)
  expect(clipboard).toContain(`- To: after \`<nav>\` · ${at['4']}`)
})

test('the note popover stays on screen for an element near the bottom', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: 'Redlining (Alt+R)' })).toBeVisible()
  await page.keyboard.press('Alt+r')
  const rows = page.locator('.report')
  const last = rows.last()
  // Scroll so the last row sits just above the bottom edge, where "below" cannot fit.
  await last.evaluate((el) => el.scrollIntoView({ block: 'end' }))
  await last.locator('h3').click()
  const popover = page.getByTestId('rl-popover')
  await expect(popover).toBeVisible()
  const viewport = page.viewportSize()!
  // The popover measures itself after the first paint and may move once; wait for it to settle.
  await expect
    .poll(async () => {
      const box = (await popover.boundingBox())!
      return box.y >= 0 && box.y + box.height <= viewport.height - 80 + 1
    })
    .toBe(true)
  await expect(page.getByTestId('rl-note-save')).toBeInViewport()
})

test('clicks inside the overlay are not "outside" clicks for the page\'s dismissable UI', async ({
  page,
}) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: 'Redlining (Alt+R)' })).toBeVisible()
  const menu = page.locator('.main-nav')
  await menu.locator('summary').click()
  await expect(menu).toHaveAttribute('open', '')
  // The toggle sits in the overlay's host in <body>; the menu's document handler must not see it.
  await page.getByRole('button', { name: 'Redlining (Alt+R)' }).click()
  await expect(page.getByRole('toolbar', { name: 'Redlining' })).toBeVisible()
  await expect(menu).toHaveAttribute('open', '')
  await page.getByRole('button', { name: 'Close (Esc)' }).click()
  await expect(menu).toHaveAttribute('open', '')
  // A pointer down on the page itself still closes it (the avatar is never under the open list).
  await page.locator('.avatar').click()
  await expect(menu).not.toHaveAttribute('open', '')
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
  // Copy one annotation as its own prompt, and everything from the panel header.
  await page.getByRole('button', { name: 'Copy annotation 1' }).click()
  const one = await page.evaluate(() => navigator.clipboard.readText())
  expect(one).toMatch(/^# Redlining/)
  expect(one).toContain('## 1 · REMOVE')
  expect(one).not.toContain('## 2 ·')
  expect(one).toContain('Apply in order.')
  await page.getByRole('button', { name: 'Copy all annotations' }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('## 1 · REMOVE')
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

  // Sections start collapsed and summarise their values: `.btn { padding: 7px 12px }`.
  await expect(page.getByTestId('rl-section-padding')).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByTestId('rl-section-padding')).toContainText('7 12 7 12')
  await expect(page.getByRole('button', { name: 'Font size +1' })).toHaveCount(0)
  // Free 1px steps for this scenario; snapping to the stylesheet's scale is tested below.
  await page.getByTestId('rl-snap').click()
  await page.getByTestId('rl-section-type').click()
  await expect(page.getByTestId('rl-section-type')).toHaveAttribute('aria-expanded', 'true')
  // Every value says where it comes from: `button { font: inherit }` wins for font-size.
  await expect(inspector).toContainText('from button')
  await page.getByRole('button', { name: 'Font size +1' }).click()
  await page.getByRole('button', { name: 'Font size +1' }).click()
  await page.getByTestId('rl-section-box').click()
  await expect(inspector).toContainText('auto · from flex')
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
  expect(clipboard).toContain(
    `  - font-size: ${before.size} → ${parseFloat(before.size) + 2}px (from \`button\`; add class text-lg)`,
  )
  // Steppers snap to their grid (width: 4px). Nobody sets the width, so the export says so.
  const snapped = Math.round((parseFloat(before.width) + 4) / 4) * 4
  expect(clipboard).toContain(
    `  - width: auto (${parseFloat(before.width)}px, laid out by the parent flex) → ${snapped}px`,
  )
  expect(clipboard).toContain('prefer changing the layout')
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
  await page.getByRole('button', { name: 'Archive annotation 1' }).click()
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
  await expect(card).toHaveCSS('translate', '2px 10px')
  await expect(page.getByTestId('rl-tweak-changes')).toContainText(
    'visual nudge: +2px right, +10px down',
  )

  await page.getByTestId('rl-tweak-done').click()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Copy prompt (⌘⇧C)' }).click()
  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboard).toContain(
    `  - width: auto (${parseFloat(before)}px, laid out by the parent flex) → ${expected}`,
  )
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
  await expect(page.getByTestId('rl-section-layout')).toContainText('gap 8')
  await page.getByTestId('rl-snap').click() // free 2px steps rather than the stylesheet's gap values
  await page.getByTestId('rl-section-layout').click()
  await page.getByRole('button', { name: 'Gap +2' }).click()
  await expect(chips).toHaveCSS('gap', '10px')
  await page.getByRole('button', { name: 'space-between', exact: true }).click()
  await expect(chips).toHaveCSS('justify-content', 'space-between')
  await expect(page.getByTestId('rl-section-colour')).toContainText('none')
  await page.getByTestId('rl-section-colour').click()
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

test('tweak: snapping steps through the stylesheet scale and names the class; free steps still suggest', async ({
  page,
}) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: 'Redlining (Alt+R)' })).toBeVisible()
  await page.keyboard.press('Alt+r')
  await page.keyboard.press('t')
  const title = page.locator('.report h3').first()
  await expect(title).toHaveCSS('font-size', '15px')
  await title.click()
  await page.getByTestId('rl-section-type').click()
  const inspector = page.getByTestId('rl-inspector')
  await expect(inspector).toContainText('from .text-base')
  // Snap to scale is on: one step jumps to the next class (.text-lg = 17px), not to 16px.
  await expect(page.getByTestId('rl-snap')).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Font size up' }).click()
  await expect(title).toHaveCSS('font-size', '17px')
  await expect(page.getByTestId('rl-tweak-changes')).toContainText(
    'font-size: 15px → 17px (class text-base → text-lg)',
  )
  await page.getByRole('button', { name: 'Font size up' }).click()
  await expect(title).toHaveCSS('font-size', '20px')
  await page.getByRole('button', { name: 'Font size down' }).click()
  await expect(title).toHaveCSS('font-size', '17px')
  // Off: free 1px steps, and a value between classes only names its source.
  await page.getByTestId('rl-snap').click()
  await page.getByRole('button', { name: 'Font size −1' }).click()
  await expect(page.getByTestId('rl-tweak-changes')).toContainText(
    'font-size: 15px → 16px (from class text-base)',
  )
  await page.getByTestId('rl-snap').click()
  await page.getByRole('button', { name: 'Font size up' }).click()
  await expect(title).toHaveCSS('font-size', '17px')
  await page.getByTestId('rl-tweak-done').click()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Copy prompt (⌘⇧C)' }).click()
  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboard).toContain('- Classes: `text-base`')
  expect(clipboard).toContain('  - font-size: 15px → 17px (class text-base → text-lg)')
})

test('help: ? and the toolbar button open the in-package help; Escape closes it first', async ({
  page,
}) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: 'Redlining (Alt+R)' })).toBeVisible()
  await page.keyboard.press('Alt+r')
  await page.keyboard.press('?')
  const help = page.getByTestId('rl-help')
  await expect(help).toBeVisible()
  await expect(help).toContainText('Select · Draw · Move · Tweak')
  await expect(help.getByRole('link', { name: 'Guide' })).toHaveAttribute(
    'href',
    'https://redlining.deep-thought.rocks/guide',
  )
  await page.keyboard.press('Escape')
  await expect(help).toHaveCount(0)
  await expect(page.getByRole('toolbar', { name: 'Redlining' })).toBeVisible()
  await page.getByRole('button', { name: 'Help (?)' }).click()
  await expect(help).toBeVisible()
  // Help and settings are exclusive.
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(help).toHaveCount(0)
  await expect(page.getByTestId('rl-settings')).toBeVisible()
})

test('settings: the styling idiom is detected, can be overridden, persists, and maps values to utilities', async ({
  page,
}) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: 'Redlining (Alt+R)' })).toBeVisible()
  await page.keyboard.press('Alt+r')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const settings = page.getByTestId('rl-settings')
  await expect(settings).toContainText('no Tailwind tokens, no hashed class names')
  await expect(page.getByTestId('rl-setting-framework')).toHaveValue('auto')
  // The version row; under automation the registry is never asked.
  await expect(page.getByTestId('rl-version')).toContainText(/Version \d+\.\d+\.\d+/)
  await expect(page.getByTestId('rl-version')).toContainText('latest not checked yet')
  await expect(page.getByTestId('rl-setting-framework').locator('option[value="auto"]')).toHaveText(
    'Auto — Plain CSS (detected)',
  )
  await page.getByTestId('rl-setting-framework').selectOption('tailwind4')
  await page.keyboard.press('Escape') // closes the settings, not the overlay
  await expect(settings).toHaveCount(0)
  await expect(page.getByRole('toolbar', { name: 'Redlining' })).toBeVisible()

  // Under Tailwind 4 the padding stepper snaps to the spacing scale and names the utility.
  await page.keyboard.press('t')
  const button = page.locator('.toolbar button').first()
  await button.click()
  await page.getByTestId('rl-section-padding').click()
  await page.getByRole('button', { name: 'Padding left up' }).click()
  await expect(button).toHaveCSS('padding-left', '14px')
  await expect(page.getByTestId('rl-tweak-changes')).toContainText(
    'padding-left: 12px → 14px (from class btn; add class pl-3.5)',
  )
  await page.getByTestId('rl-tweak-done').click()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Copy prompt (⌘⇧C)' }).click()
  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboard).toContain('\nStyling: Tailwind 4 (set by hand)\n')
  expect(clipboard).toContain('  - padding-left: 12px → 14px (from class btn; add class pl-3.5)')
  expect(clipboard).toContain('theme values live in the `@theme` block')

  // The choice is remembered per browser.
  await page.reload()
  await expect(page.getByRole('button', { name: 'Redlining (Alt+R)' })).toBeVisible()
  await page.keyboard.press('Alt+r')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByTestId('rl-setting-framework')).toHaveValue('tailwind4')
})

test('client-side navigation swaps the session: each route keeps its own annotations', async ({
  page,
}) => {
  await openOverlay(page)
  await page.locator('nav').first().click()
  await page.getByTestId('rl-note').fill('Spike note.')
  await page.getByTestId('rl-note').press('Enter')
  await expect(page.getByTestId('rl-pin')).toHaveCount(1)

  // A Next <Link>: the page changes, the overlay component stays mounted. While the overlay
  // is active a click is a pick, so close it around the navigation.
  await page.keyboard.press('Escape')
  await page.locator('.fixture-nav').getByRole('link', { name: 'Dashboard' }).click()
  await expect(page.locator('.page-head h1')).toBeVisible()
  await page.keyboard.press('Alt+r')
  await expect(page.getByRole('toolbar', { name: 'Redlining' })).toBeVisible()
  await expect(page.getByTestId('rl-pin')).toHaveCount(0)
  await page.locator('.page-head h1').click()
  await page.getByTestId('rl-note').fill('Dashboard note.')
  await page.getByTestId('rl-note').press('Enter')
  await expect(page.getByTestId('rl-pin')).toHaveCount(1)
  await page.keyboard.press('l')
  await expect(page.getByTestId('rl-panel')).toContainText('Annotations (1)')
  // Other pages' open sessions live in the history view, not beside the visible ones.
  await page.getByTestId('rl-archive-toggle').click()
  await expect(page.getByTestId('rl-panel-routes')).toContainText('/spike (1)')
  await expect(page.getByTestId('rl-panel-routes')).toContainText('Not copied or saved')
  await page.getByTestId('rl-archive-toggle').click()
  await page.keyboard.press('l')

  // Back again: the spike session returns, the dashboard one is listed as another route.
  await page.keyboard.press('Escape')
  await page.locator('.fixture-nav').getByRole('link', { name: 'Spike' }).click()
  await expect(page.locator('[data-spike="1"]')).toBeVisible()
  await page.keyboard.press('Alt+r')
  await expect(page.getByTestId('rl-pin')).toHaveCount(1)
  await page.keyboard.press('l')
  await expect(page.getByTestId('rl-panel')).toContainText('Spike note.')
  await page.getByTestId('rl-archive-toggle').click()
  await expect(page.getByTestId('rl-panel-routes')).toContainText('/dashboard (1)')
  await page.getByTestId('rl-archive-toggle').click()
  const stored = await page.evaluate(() => ({
    spike: JSON.parse(localStorage.getItem('redlining:/spike') ?? '[]').length,
    dashboard: JSON.parse(localStorage.getItem('redlining:/dashboard') ?? '[]').length,
  }))
  expect(stored).toEqual({ spike: 1, dashboard: 1 })
})

test("multi-route: other routes' sessions ride along on Save and can be cleared from the panel", async ({
  page,
}) => {
  await page.goto('/spike')
  await expect(page.getByRole('button', { name: 'Redlining (Alt+R)' })).toBeVisible()
  await page.keyboard.press('Alt+r')
  await page.locator('nav').first().click()
  await page.getByTestId('rl-note').fill('Horizontal nav.')
  await page.getByTestId('rl-note').press('Enter')
  await expect(page.getByTestId('rl-pin')).toHaveText('1')

  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: 'Redlining (Alt+R)' })).toBeVisible()
  await page.keyboard.press('Alt+r')
  await page.locator('.page-head h1').click()
  await page.getByTestId('rl-note').fill('Shorter title.')
  await page.getByTestId('rl-note').press('Enter')
  // Off by default: Copy and Save carry exactly what the panel shows. Opt in for this scenario.
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByTestId('rl-setting-routes').check()
  await page.keyboard.press('Escape')
  await page.keyboard.press('l')
  await page.getByTestId('rl-archive-toggle').click()
  await expect(page.getByTestId('rl-panel-routes')).toContainText('/spike (1)')
  await expect(page.getByTestId('rl-panel-routes')).toContainText(
    'Copied and saved with this page too',
  )
  await page.getByTestId('rl-archive-toggle').click()

  await page.getByRole('button', { name: 'Save to project (⌘⏎)' }).click()
  await expect(page.getByTestId('rl-toast')).toContainText('Saved')
  const md = readFileSync(path.join(OUT, 'annotations.md'), 'utf8')
  expect(md).toMatch(/# Redlining \d+\.\d+\.\d+ — \/dashboard/)
  expect(md).toContain('# Redlining — /spike  (1 annotation, made earlier in the same browser)')
  expect(md).toContain('- Note: Horizontal nav.')
  expect(md.split('Apply in order.')).toHaveLength(2)
  const json = JSON.parse(readFileSync(path.join(OUT, 'annotations.json'), 'utf8')) as {
    others: { route: string }[]
  }
  expect(json.others.map((o) => o.route)).toEqual(['/spike'])

  await page.getByTestId('rl-archive-toggle').click()
  await page.getByRole('button', { name: 'Archive /spike' }).click()
  await expect(page.getByTestId('rl-panel-routes')).toHaveCount(0)
  await expect(page.getByTestId('rl-archive-row')).toHaveCount(1)
  await page.getByTestId('rl-archive-toggle').click()
  await page.goto('/spike')
  await expect(page.getByRole('button', { name: 'Redlining (Alt+R)' })).toBeVisible()
  await page.keyboard.press('Alt+r')
  await expect(page.getByTestId('rl-pin')).toHaveCount(0)
})

test('references: a pasted mockup rides along as ref-N-i, and every annotation gets a crop', async ({
  page,
}) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: 'Redlining (Alt+R)' })).toBeVisible()
  await page.keyboard.press('Alt+r')
  await page.locator('.page-head h1').click()
  const note = page.getByTestId('rl-note')
  await note.fill('Match the mockup: bolder, with a subtitle.')
  // Paste a generated PNG into the note.
  await note.evaluate(async (el) => {
    const canvas = document.createElement('canvas')
    canvas.width = 2400
    canvas.height = 600
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#2563eb'
    ctx.fillRect(0, 0, 2400, 600)
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/png'))
    const dt = new DataTransfer()
    dt.items.add(new File([blob], 'mock.png', { type: 'image/png' }))
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }))
  })
  const thumb = page.getByTestId('rl-refs').locator('img')
  await expect(thumb).toHaveCount(1)
  // Shrunk to 1600 on the long edge.
  await expect(thumb).toHaveJSProperty('naturalWidth', 1600)
  await note.press('Enter')
  await expect(page.getByTestId('rl-pin')).toHaveText('1')
  await page.keyboard.press('l')
  await page.getByRole('button', { name: 'Expand annotation 1' }).click()
  await expect(page.getByTestId('rl-row-details').locator('img')).toHaveCount(1)

  // Before Save the Markdown only counts them.
  await page.getByRole('button', { name: 'Copy prompt (⌘⇧C)' }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    '- Reference: 1 pasted image (written to .redlining/ on Save)',
  )
  await page.getByRole('button', { name: 'Save to project (⌘⏎)' }).click()
  await expect(page.getByTestId('rl-toast')).toContainText('Saved')
  const md = readFileSync(path.join(OUT, 'annotations.md'), 'utf8')
  expect(md).toContain(
    '- Reference: .redlining/ref-1-1.jpg — match this; it shows the intended result',
  )
  expect(md).toContain('- Crop: .redlining/crop-1.png — this element as it looks now')
  expect(existsSync(path.join(OUT, 'ref-1-1.jpg'))).toBe(true)
  expect(existsSync(path.join(OUT, 'crop-1.png'))).toBe(true)
  // The session survives a reload with the image.
  await page.reload()
  await expect(page.getByRole('button', { name: 'Redlining (Alt+R)' })).toBeVisible()
  await page.keyboard.press('Alt+r')
  await page.keyboard.press('l')
  await page.getByRole('button', { name: 'Expand annotation 1' }).click()
  await expect(page.getByTestId('rl-row-details').locator('img')).toHaveCount(1)
})

test("verify loop: the agent's reply.md opens the panel, differing values are named, applied ones can be removed", async ({
  page,
}) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: 'Redlining (Alt+R)' })).toBeVisible()
  await page.keyboard.press('Alt+r')
  await page.keyboard.press('t')
  const button = page.locator('.toolbar button').first()
  await button.click()
  await page.getByTestId('rl-snap').click()
  await page.getByTestId('rl-section-type').click()
  await page.getByRole('button', { name: 'Font size +1' }).click()
  await page.getByTestId('rl-tweak-done').click()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Save to project (⌘⏎)' }).click()
  await expect(page.getByTestId('rl-toast')).toContainText('Saved')

  // The agent answers; nothing in the code changed yet.
  await page.waitForTimeout(50)
  writeFileSync(
    path.join(OUT, 'reply.md'),
    '## 1 · done — text-sm → text-base (components/toolbar.tsx:31)\n',
  )
  await page.reload()
  await expect(page.getByRole('button', { name: 'Redlining (Alt+R)' })).toBeVisible()
  await page.keyboard.press('Alt+r')
  const panel = page.getByTestId('rl-panel')
  await expect(panel).toBeVisible()
  await expect(page.getByTestId('rl-verify-summary')).toContainText('0 of 1 applied')
  await expect(page.getByTestId('rl-verdict')).toContainText(
    'differs · font-size is 15px, expected 16px',
  )
  await expect(page.getByTestId('rl-agent')).toContainText('agent: done · text-sm → text-base')
  // The preview is back after the check.
  await expect(button).toHaveCSS('font-size', '16px')

  // Once the code carries the value, Verify says so and the entry can go.
  await page.addStyleTag({ content: '.toolbar button { font-size: 16px !important }' })
  await page.getByRole('button', { name: 'Verify against the page' }).click()
  await expect(page.getByTestId('rl-verify-summary')).toContainText('1 of 1 applied')
  await expect(page.getByTestId('rl-verdict')).toHaveAttribute('data-state', 'applied')
  await page.getByRole('button', { name: 'Remove applied' }).click()
  await expect(panel).toContainText('Annotations (0)')
  await expect(page.getByTestId('rl-pin')).toHaveCount(0)
  // The applied annotation is in the archive with its verdict and the agent's line.
  await page.getByTestId('rl-archive-toggle').click()
  const archived = page.getByTestId('rl-archive-row')
  await expect(archived).toHaveCount(1)
  await expect(archived).toHaveAttribute('data-reason', 'applied')
  await expect(archived).toContainText('agent: text-sm → text-base')
  // Restore is only offered on the item's own route; here we are on it.
  await expect(archived.getByRole('button', { name: /^Restore/ })).toBeEnabled()
})

test('standalone: the bundled overlay runs on a plain page, anchors by selector, and downloads the export', async ({
  page,
}) => {
  await page.goto('/standalone.html')
  await expect(page.getByRole('button', { name: 'Redlining (Alt+R)' })).toBeVisible()
  await page.keyboard.press('Alt+r')
  await page.locator('#title').click()
  await page.getByTestId('rl-note').fill('Shorter, and centred.')
  await page.getByTestId('rl-note').press('Enter')
  await expect(page.getByTestId('rl-pin')).toHaveText('1')
  // Draw needs no loader either: the box resolves to the undecorated <main> around it.
  await page.keyboard.press('d')
  const main = (await page.locator('main').boundingBox())!
  await page.mouse.move(main.x + 10, main.y + main.height - 30)
  await page.mouse.down()
  await page.mouse.move(main.x + main.width - 10, main.y + main.height - 4, { steps: 6 })
  await page.mouse.up()
  await expect(page.getByTestId('rl-popover')).toContainText('Add inside')
  await page.getByTestId('rl-note').fill('A footer note.')
  await page.getByTestId('rl-note').press('Enter')
  await expect(page.getByTestId('rl-pin').nth(1)).toHaveText('2')
  await page.getByRole('button', { name: 'Copy prompt (⌘⇧C)' }).click()
  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboard).toContain('## 1 · CHANGE — "A page without a framework" h1')
  expect(clipboard).toContain('- Resolved: unresolved — locate by selector `#title` and text')
  expect(clipboard).toContain('## 2 · ADD — inside <main>')
  expect(clipboard).toMatch(/- Position: (at end|after child \d+) · full width/)
  expect(clipboard).toContain('Styling: Plain CSS (detected')
  // No endpoint: Save hands the files to the browser.
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download export (⌘⏎)' }).click()
  expect((await download).suggestedFilename()).toBe('annotations.md')
  await expect(page.getByTestId('rl-toast')).toContainText('Downloaded annotations.md')
})

test('device frame: a real narrow viewport in an iframe; its annotations sync into the session', async ({
  page,
}) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: 'Redlining (Alt+R)' })).toBeVisible()
  await page.keyboard.press('Alt+r')
  await page.getByTestId('rl-viewport').selectOption('375')
  const frame = page.getByTestId('rl-device-frame')
  await expect(frame).toBeVisible()
  const inner = page.frameLocator('.rl-frame')
  // The page inside is a genuine 375px viewport and its overlay is already open.
  await expect(inner.locator('body')).toHaveJSProperty('clientWidth', 375)
  await expect(inner.getByRole('toolbar', { name: 'Redlining' })).toBeVisible()
  await expect(inner.locator('.rl-frame-badge')).toHaveText('375px')

  const heading = inner.locator('.page-head h1')
  await heading.click()
  await inner.getByTestId('rl-note').fill('Shorter title on phones.')
  await inner.getByTestId('rl-note').press('Enter')
  await expect(inner.getByTestId('rl-pin')).toHaveText('1')

  // The outer session picked it up through the storage event.
  await page.getByTestId('rl-viewport').selectOption('')
  await expect(frame).toHaveCount(0)
  await page.keyboard.press('l')
  await expect(page.getByTestId('rl-panel')).toContainText('Annotations (1)')
  await page.getByRole('button', { name: 'Copy prompt (⌘⇧C)' }).click()
  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboard).toContain('- Applies at: ≤ 375px (made in a 375px device frame)')
  expect(clipboard).toContain('- Note: Shorter title on phones.')
})

test('before/after screenshot writes two files', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: 'Redlining (Alt+R)' })).toBeVisible()
  await page.keyboard.press('Alt+r')
  await page.keyboard.press('t')
  const button = page.locator('.toolbar button').first()
  await button.click()
  await page.getByTestId('rl-section-type').click()
  await page.getByRole('button', { name: 'Font size up' }).click()
  await page.getByTestId('rl-tweak-done').click()
  await page.keyboard.press('Enter')
  await page
    .getByRole('button', { name: 'Also capture a before screenshot (previews reset)' })
    .click()
  await page.getByRole('button', { name: 'Save to project (⌘⏎)' }).click()
  await expect(page.getByTestId('rl-toast')).toContainText('Saved')
  const md = readFileSync(path.join(OUT, 'annotations.md'), 'utf8')
  expect(md).toContain('· before the tweaks: .redlining/screenshot-before.png')
  expect(existsSync(path.join(OUT, 'screenshot-before.png'))).toBe(true)
  expect(existsSync(path.join(OUT, 'screenshot.png'))).toBe(true)
})
