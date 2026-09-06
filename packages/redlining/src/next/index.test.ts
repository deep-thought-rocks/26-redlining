import { expect, test } from 'vitest'
import { withRedlining } from './index'

test('returns the given config', () => {
  const config = { reactStrictMode: true }
  expect(withRedlining(config)).toEqual(config)
})

test('defaults to an empty config', () => {
  expect(withRedlining()).toEqual({})
})
