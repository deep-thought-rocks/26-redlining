import { describe, expect, test } from 'vitest'
import { transform } from './transform'

const FILE = 'app/(app)/layout.tsx'

function stamps(code: string): string[] {
  return [...code.matchAll(/data-rl="([^"]+)"/g)].map((m) => m[1]!)
}

describe('transform', () => {
  test('stamps host elements with file:line:col of the opening tag', () => {
    const src = [
      'export function A() {',
      '  return (',
      '    <nav className="x">',
      '      <a href="#">hi</a>',
      '    </nav>',
      '  )',
      '}',
    ].join('\n')
    const { code } = transform(src, FILE)
    expect(stamps(code)).toEqual([`${FILE}:3:5`, `${FILE}:4:7`])
    expect(code).toContain(`<nav data-rl="${FILE}:3:5" className="x">`)
    expect(code).toContain(`<a data-rl="${FILE}:4:7" href="#">hi</a>`)
  })

  test('stamps self-closing host elements', () => {
    const { code } = transform('const x = <input type="text" />', FILE)
    expect(code).toBe(`const x = <input data-rl="${FILE}:1:11" type="text" />`)
  })

  test('leaves components, member expressions and fragments alone', () => {
    const src = 'const x = <><Card title="t"><Ui.Button /><div /></Card></>'
    const { code } = transform(src, FILE)
    expect(stamps(code)).toEqual([`${FILE}:1:42`])
    expect(code).toContain('<Card title="t">')
    expect(code).toContain('<Ui.Button />')
  })

  test('handles spreads, conditionals and TSX generics', () => {
    const src = [
      "'use client'",
      'export function A<T extends object>(p: T) {',
      '  const rest = { id: "r" } as Partial<T>',
      '  return p ? <ul {...rest}>{[1].map((n) => <li key={n}>{n}</li>)}</ul> : null',
      '}',
    ].join('\n')
    const { code } = transform(src, FILE)
    expect(code.startsWith("'use client'")).toBe(true)
    expect(stamps(code)).toEqual([`${FILE}:4:14`, `${FILE}:4:44`])
    expect(code).toContain('Partial<T>')
  })

  test('is idempotent: an element that already carries data-rl is not stamped twice', () => {
    const once = transform('const x = <div />', FILE).code
    expect(transform(once, FILE).code).toBe(once)
  })

  test('returns the source untouched, without a map, when there is no JSX', () => {
    const src = 'export const n = 1 < 2\n'
    expect(transform(src, FILE)).toEqual({ code: src, map: null })
  })

  test('emits a source map that maps stamped code back to the original column', () => {
    const src = 'const x = <span>t</span>'
    const { map } = transform(src, FILE)
    expect(map).not.toBeNull()
    expect(map!.version).toBe(3)
    expect(map!.sources).toEqual([FILE])
    expect(map!.sourcesContent).toEqual([src])
    expect(map!.mappings.length).toBeGreaterThan(0)
  })

  test('normalises Windows separators in the stamp', () => {
    const { code } = transform('const x = <b />', 'app\\page.tsx')
    expect(stamps(code)).toEqual(['app/page.tsx:1:11'])
  })

  test('throws on a syntax error instead of passing the file through', () => {
    expect(() => transform('const = <div>', FILE)).toThrow()
  })
})
