// @vitest-environment jsdom
import { expect, test } from 'vitest'
import { isEditable, matchesHotkey } from './hotkey'

test('matchesHotkey requires exactly the listed modifiers', () => {
  const ev = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init)
  expect(matchesHotkey(ev({ key: 'r', altKey: true }), 'Alt+R')).toBe(true)
  expect(matchesHotkey(ev({ key: 'R', altKey: true, shiftKey: true }), 'Alt+R')).toBe(false)
  expect(matchesHotkey(ev({ key: 'r' }), 'Alt+R')).toBe(false)
  expect(matchesHotkey(ev({ key: 'k', ctrlKey: true, shiftKey: true }), 'Ctrl+Shift+K')).toBe(true)
  expect(matchesHotkey(ev({ key: 'Enter', metaKey: true }), 'Meta+Enter')).toBe(true)
  // macOS: Option+R types '®'; the physical key still matches.
  expect(matchesHotkey(ev({ key: '®', code: 'KeyR', altKey: true }), 'Alt+R')).toBe(true)
})

test('a keydown without a key neither throws nor matches; a code alone still matches a letter', () => {
  expect(matchesHotkey(new Event('keydown') as KeyboardEvent, 'Alt+R')).toBe(false)
  const codeOnly = { code: 'KeyR', altKey: true, ctrlKey: false, metaKey: false, shiftKey: false }
  expect(matchesHotkey(codeOnly as KeyboardEvent, 'Alt+R')).toBe(true)
  expect(matchesHotkey({ ...codeOnly, key: undefined } as unknown as KeyboardEvent, 'Alt+R')).toBe(
    true,
  )
})

test('isEditable recognises form fields and contenteditable', () => {
  document.body.innerHTML =
    '<textarea></textarea><div contenteditable="true"><b>x</b></div><p>t</p>'
  expect(isEditable(document.querySelector('textarea'))).toBe(true)
  expect(isEditable(document.querySelector('b'))).toBe(true)
  expect(isEditable(document.querySelector('p'))).toBe(false)
  expect(isEditable(null)).toBe(false)
})
