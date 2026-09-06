import { expect, test } from 'vitest'
import { transform } from './index'

test('returns the source unchanged until implemented', () => {
  const source = 'export const A = () => <nav />'
  expect(transform(source, 'app/page.tsx')).toEqual({ code: source, map: null })
})
