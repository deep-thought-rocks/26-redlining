import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { Redlining } from './Redlining'

test('renders nothing', () => {
  expect(renderToStaticMarkup(<Redlining />)).toBe('')
})
