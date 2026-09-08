import { existsSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const OUT = path.resolve('examples/vite-app/.redlining')

test.beforeEach(() => rmSync(OUT, { recursive: true, force: true }))

test('vite: the transform stamps anchors and the dev server serves the save endpoint', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Redlining (Alt+R)' })).toBeVisible()
  await expect(page.locator('h1')).toHaveAttribute('data-rl', /^src\/App\.tsx:\d+:\d+$/)
  await page.keyboard.press('Alt+r')
  await page.locator('h1').click()
  await page.getByTestId('rl-note').fill('Shorter title.')
  await page.getByTestId('rl-note').press('Enter')
  await expect(page.getByTestId('rl-pin')).toHaveText('1')
  await page.getByRole('button', { name: 'Save to project (⌘⏎)' }).click()
  await expect(page.getByTestId('rl-toast')).toContainText('Saved')
  expect(existsSync(path.join(OUT, 'annotations.md'))).toBe(true)
  const md = readFileSync(path.join(OUT, 'annotations.md'), 'utf8')
  expect(md).toMatch(/- Anchor: `<h1>` · src\/App\.tsx:\d+ · owners: App/)
  expect(md).toContain('- Note: Shorter title.')
})
