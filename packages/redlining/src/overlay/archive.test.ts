// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from 'vitest'
import {
  archiveEntries,
  clearArchive,
  deleteArchived,
  loadArchive,
  MAX_ITEMS,
  restorable,
  toAnnotation,
} from './archive'
import type { Entry } from './session'

const entry = (id: string, index: number, over: Partial<Entry> = {}): Entry => ({
  id,
  index,
  action: 'change',
  anchor: {
    tag: 'p',
    owners: [],
    selector: 'p',
    rect: { x: 0, y: 0, w: 1, h: 1 },
    resolved: 'exact',
  },
  note: `note ${id}`,
  createdAt: 't',
  element: document.createElement('p'),
  refs: ['data:image/png;base64,AA'],
  preview: { cssText: '', text: null },
  ...over,
})

describe('archive', () => {
  beforeEach(() => localStorage.clear())

  test('archives newest first, stripped of handles, previews and images, with reason and extras', () => {
    archiveEntries(
      localStorage,
      '/a',
      [entry('x', 1)],
      'archived',
      () => ({}),
      new Date('2026-09-10T10:00:00Z'),
    )
    const items = archiveEntries(
      localStorage,
      '/b',
      [entry('y', 1)],
      'applied',
      () => ({ verdict: 'applied', reply: 'done — moved it' }),
      new Date('2026-09-10T11:00:00Z'),
    )
    expect(items.map((i) => i.id)).toEqual(['y', 'x'])
    expect(items[0]).toMatchObject({
      route: '/b',
      reason: 'applied',
      verdict: 'applied',
      reply: 'done — moved it',
    })
    expect(items[0]).not.toHaveProperty('element')
    expect(items[0]).not.toHaveProperty('preview')
    expect(items[0]).not.toHaveProperty('refs')
    expect(loadArchive(localStorage)).toEqual(items)
    // Re-archiving the same id replaces the older copy.
    expect(
      archiveEntries(localStorage, '/a', [entry('x', 2)], 'archived').filter((i) => i.id === 'x'),
    ).toHaveLength(1)
  })

  test('caps the archive by count', () => {
    const many = Array.from({ length: MAX_ITEMS + 5 }, (_, i) => entry(`e${i}`, i + 1))
    expect(archiveEntries(localStorage, '/a', many, 'archived')).toHaveLength(MAX_ITEMS)
  })

  test('delete, clear, restorable and toAnnotation', () => {
    archiveEntries(localStorage, '/a', [entry('x', 1), entry('y', 2)], 'archived')
    expect(deleteArchived(localStorage, ['x']).map((i) => i.id)).toEqual(['y'])
    const item = loadArchive(localStorage)[0]!
    expect(restorable(item, '/a')).toBe(true)
    expect(restorable(item, '/b')).toBe(false)
    const back = toAnnotation(item)
    expect(back).not.toHaveProperty('route')
    expect(back).not.toHaveProperty('archivedAt')
    expect(back.note).toBe('note y')
    clearArchive(localStorage)
    expect(loadArchive(localStorage)).toEqual([])
  })

  test('ignores garbage in storage', () => {
    localStorage.setItem('redlining:archive', '{"nope":1}')
    expect(loadArchive(localStorage)).toEqual([])
  })
})
