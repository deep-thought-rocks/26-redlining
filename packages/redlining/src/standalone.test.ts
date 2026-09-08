import { expect, test } from 'vitest'
import { optionsFrom } from './standalone'

test('optionsFrom reads the script tag data attributes; "off" means download', () => {
  expect(
    optionsFrom({ endpoint: 'off', hotkey: 'Alt+K', position: 'top-left', framework: 'css' }),
  ).toEqual({
    endpoint: false,
    hotkey: 'Alt+K',
    position: 'top-left',
    framework: 'css',
  })
  expect(optionsFrom({ endpoint: '/redline' })).toEqual({ endpoint: '/redline' })
  expect(optionsFrom({})).toEqual({})
})
