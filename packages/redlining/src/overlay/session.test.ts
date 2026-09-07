// @vitest-environment jsdom
import { describe, expect, test } from 'vitest'
import type { Anchor } from '../types'
import { reduce, toSession, type Draft, type Entry } from './session'

const anchor: Anchor = {
  tag: 'div',
  owners: ['A'],
  selector: 'div',
  rect: { x: 100, y: 200, w: 300, h: 400 },
  resolved: 'exact',
  file: 'a.tsx',
  line: 1,
}
const el = () => document.createElement('div')
const add = (entries: Entry[], id: string, draft: Partial<Draft> = {}) =>
  reduce(entries, {
    type: 'add',
    draft: { kind: 'select', element: el(), anchor, ...draft },
    action: 'change',
    note: `n${id}`,
    id,
    createdAt: 't',
  })

describe('session reducer', () => {
  test('adds with a 1-based index and stores draw boxes relative to the container rect', () => {
    let s = add([], 'a')
    s = add(s, 'b', { kind: 'draw', box: { x: 150, y: 260, w: 100, h: 50, childIndex: 2 } })
    expect(s.map((e) => e.index)).toEqual([1, 2])
    expect(s[1]!.box).toEqual({ x: 50, y: 60, w: 100, h: 50, childIndex: 2 })
    expect(s[0]!.box).toBeUndefined()
  })

  test('edits notes, removes with reindexing, and clears', () => {
    let s = add(add(add([], 'a'), 'b'), 'c')
    s = reduce(s, { type: 'note', id: 'b', note: 'edited' })
    expect(s[1]!.note).toBe('edited')
    s = reduce(s, { type: 'remove', id: 'a' })
    expect(s.map((e) => [e.id, e.index])).toEqual([
      ['b', 1],
      ['c', 2],
    ])
    expect(reduce(s, { type: 'clear' })).toEqual([])
  })

  test('extra anchors from Shift+click become anchors[] with the primary first', () => {
    const second = { ...anchor, tag: 'li', selector: 'li' }
    const s = add([], 'multi', { extra: [{ element: el(), anchor: second }] })
    expect(s[0]!.anchors).toEqual([anchor, second])
    expect(s[0]!.extraElements).toHaveLength(1)
    const session = toSession(s, { pathname: '/', href: 'h' }, { w: 1, h: 1 })
    expect(session.annotations[0]).not.toHaveProperty('extraElements')
    expect(session.annotations[0]!.anchors).toHaveLength(2)
  })

  test('a move draft stores the target anchor with its position', () => {
    const target = { ...anchor, tag: 'nav', selector: 'nav' }
    const s = reduce([], {
      type: 'add',
      draft: { kind: 'move', element: el(), anchor, target: { element: el(), anchor: target } },
      action: 'move',
      note: 'n',
      id: 'm',
      createdAt: 't',
      position: 'after',
    })
    expect(s[0]!.target).toEqual({ ...target, position: 'after' })
  })

  test('a tweak draft stores changes and the snapshot; changes can be replaced; toSession strips the snapshot', () => {
    const changes = [{ kind: 'style' as const, property: 'font-size', from: '14px', to: '16px' }]
    let s = add([], 'tw', { changes, snapshot: { cssText: '', text: 'x' } })
    expect(s[0]!.changes).toEqual(changes)
    expect(s[0]!.preview).toEqual({ cssText: '', text: 'x' })
    s = reduce(s, { type: 'changes', id: 'tw', changes: [] })
    expect(s[0]!.changes).toEqual([])
    const session = toSession(s, { pathname: '/', href: 'h' }, { w: 1, h: 1 })
    expect(session.annotations[0]).not.toHaveProperty('preview')
  })

  test('load replaces the session and normalises indexes', () => {
    const loaded = reduce(add([], 'old'), {
      type: 'load',
      entries: [
        { ...add([], 'a')[0]!, index: 7 },
        { ...add([], 'b')[0]!, index: 9 },
      ],
    })
    expect(loaded.map((e) => [e.id, e.index])).toEqual([
      ['a', 1],
      ['b', 2],
    ])
  })

  test('toSession strips the element handle', () => {
    const s = add([], 'a')
    const session = toSession(s, { pathname: '/p', href: 'http://x/p' }, { w: 1, h: 2 })
    expect(session).toEqual({
      route: '/p',
      url: 'http://x/p',
      viewport: { w: 1, h: 2 },
      annotations: [{ id: 'a', index: 1, action: 'change', anchor, note: 'na', createdAt: 't' }],
    })
    expect('element' in session.annotations[0]!).toBe(false)
  })
})
