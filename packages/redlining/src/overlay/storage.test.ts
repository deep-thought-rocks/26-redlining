// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from 'vitest'
import type { Entry } from './session'
import { loadEntries, saveEntries, storageKey } from './storage'

const entry = (id: string, index: number): Entry => ({
  id,
  index,
  action: 'change',
  anchor: {
    tag: 'p',
    owners: [],
    selector: 'p',
    rect: { x: 0, y: 0, w: 1, h: 1 },
    resolved: 'selector-only',
  },
  note: 'n',
  createdAt: 't',
  element: document.createElement('p'),
})

describe('session storage', () => {
  beforeEach(() => localStorage.clear())

  test('round-trips entries per route without the element handle', () => {
    saveEntries(localStorage, '/a', [entry('x', 1), entry('y', 2)])
    saveEntries(localStorage, '/b', [entry('z', 1)])
    const a = loadEntries(localStorage, '/a')
    expect(a.map((e) => [e.id, e.index, e.element])).toEqual([
      ['x', 1, null],
      ['y', 2, null],
    ])
    expect(loadEntries(localStorage, '/b')).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem(storageKey('/a'))!)[0]).not.toHaveProperty('element')
    const multi = {
      ...entry('m', 1),
      anchors: [entry('m', 1).anchor, entry('m', 1).anchor],
      extraElements: [document.createElement('i')],
    }
    saveEntries(localStorage, '/m', [multi])
    const stored = JSON.parse(localStorage.getItem(storageKey('/m'))!)[0]
    expect(stored).not.toHaveProperty('extraElements')
    expect(stored.anchors).toHaveLength(2)
  })

  test('an empty session removes the key', () => {
    saveEntries(localStorage, '/a', [entry('x', 1)])
    saveEntries(localStorage, '/a', [])
    expect(localStorage.getItem(storageKey('/a'))).toBeNull()
  })

  test('ignores garbage and malformed entries', () => {
    localStorage.setItem(storageKey('/a'), '{not json')
    expect(loadEntries(localStorage, '/a')).toEqual([])
    localStorage.setItem(
      storageKey('/a'),
      JSON.stringify([{ id: 1 }, { ...entry('ok', 1), element: undefined }]),
    )
    expect(loadEntries(localStorage, '/a').map((e) => e.id)).toEqual(['ok'])
  })
})
