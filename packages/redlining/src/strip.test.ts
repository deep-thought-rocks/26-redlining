import { expect, test } from 'vitest'
import { stripRedlining } from './strip'

test('stripRedlining removes every data-rl attribute and nothing else', () => {
  const html =
    '<main data-rl="app/page.tsx:6:5" class="x"><a data-rl="a.tsx:1:1" href="#">y</a></main>'
  expect(stripRedlining(html)).toBe('<main class="x"><a href="#">y</a></main>')
  expect(stripRedlining('<p>no attrs</p>')).toBe('<p>no attrs</p>')
})
