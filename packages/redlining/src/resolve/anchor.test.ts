// @vitest-environment jsdom
import { describe, expect, test } from 'vitest'
import type { Rect } from '../types'
import { anchorFor, parseRl } from './anchor'
import type { Layout } from './layout'

const rect: Rect = { x: 1, y: 2, w: 30, h: 40 }
const layout: Layout = { rectOf: () => rect, elementsFromPoint: () => [] }

describe('parseRl', () => {
  test('parses file:line:col and file:line, keeping colons inside the path', () => {
    expect(parseRl('app/(app)/layout.tsx:42:7')).toEqual({
      file: 'app/(app)/layout.tsx',
      line: 42,
      column: 7,
    })
    expect(parseRl('src/a:b.tsx:3')).toEqual({ file: 'src/a:b.tsx', line: 3, column: undefined })
  })
  test('rejects malformed values', () => {
    expect(parseRl('')).toBeNull()
    expect(parseRl('nope')).toBeNull()
    expect(parseRl(':12')).toBeNull()
  })
})

describe('anchorFor', () => {
  test('exact: the element carries data-rl', () => {
    document.body.innerHTML = '<nav data-rl="app/layout.tsx:42:5">  Dashboard   Reports </nav>'
    const a = anchorFor(document.querySelector('nav')!, layout)
    expect(a.display).toBe('block')
    expect(a.classes).toBeUndefined()
    delete a.display
    expect(a).toEqual({
      file: 'app/layout.tsx',
      line: 42,
      column: 5,
      tag: 'nav',
      owners: [],
      selector: 'nav',
      text: 'Dashboard Reports',
      rect,
      resolved: 'exact',
    })
  })

  test('classes are recorded, capped at 20', () => {
    document.body.innerHTML = `<div class="${Array.from({ length: 25 }, (_, i) => 'c' + i).join(' ')}" data-rl="a.tsx:1"></div>`
    const a = anchorFor(document.querySelector('div')!, layout)
    expect(a.classes).toHaveLength(20)
    expect(a.classes![0]).toBe('c0')
  })

  test('ancestor: only a parent carries data-rl', () => {
    document.body.innerHTML =
      '<section data-rl="app/page.tsx:9"><div><button>Go</button></div></section>'
    const a = anchorFor(document.querySelector('button')!, layout)
    expect(a.resolved).toBe('ancestor')
    expect(a.file).toBe('app/page.tsx')
    expect(a.line).toBe(9)
    expect(a.tag).toBe('button')
    expect(a.selector).toBe('section > div > button')
  })

  test('selector-only: nothing decorated, and a malformed data-rl on the element itself counts as undecorated', () => {
    document.body.innerHTML = '<div><span data-rl="garbage"></span></div>'
    const a = anchorFor(document.querySelector('span')!, layout)
    expect(a.resolved).toBe('selector-only')
    expect(a.file).toBeUndefined()
    expect(a.text).toBeUndefined()
  })

  test('context: the nearest decorated ancestor from another file, with the branch index', () => {
    document.body.innerHTML = `
      <section data-rl="app/page.tsx:10">
        <h2 data-rl="app/page.tsx:11">Training</h2>
        <div data-rl="components/card.tsx:33"><b data-rl="components/card.tsx:34">A</b></div>
        <div data-rl="components/card.tsx:33"><b data-rl="components/card.tsx:34">B</b></div>
      </section>`
    const [, second] = Array.from(document.querySelectorAll('b'))
    const a = anchorFor(second!, layout)
    expect(a.file).toBe('components/card.tsx')
    expect(a.context).toEqual({
      file: 'app/page.tsx',
      line: 10,
      column: undefined,
      tag: 'section',
      index: 3,
      count: 3,
    })
    // Same-file ancestors are skipped; nothing from another file means no context.
    expect(anchorFor(document.querySelector('h2')!, layout).context).toBeUndefined()
  })

  test('text is whitespace-collapsed and capped at 80 characters with an ellipsis', () => {
    document.body.innerHTML = `<p data-rl="a.tsx:1">${'word '.repeat(30)}</p>`
    const a = anchorFor(document.querySelector('p')!, layout)
    expect(a.text!.length).toBe(80)
    expect(a.text!.endsWith('…')).toBe(true)
  })
})
