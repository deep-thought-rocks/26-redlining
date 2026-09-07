// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from 'vitest'
import { provenance, specificity, suggestClass } from './cascade'

function css(text: string) {
  const style = document.createElement('style')
  style.textContent = text
  document.head.appendChild(style)
}

beforeEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

describe('specificity', () => {
  test('ranks ids over classes over elements', () => {
    expect(specificity('#a')).toBeGreaterThan(specificity('.a.b.c'))
    expect(specificity('.a')).toBeGreaterThan(specificity('div span p'))
    expect(specificity('.report h3')).toBe(101)
    expect(specificity('a:hover')).toBe(101)
    expect(specificity('li::before')).toBe(2)
  })
})

describe('provenance', () => {
  test('finds the winning rule by specificity, then order, and reports a single class', () => {
    css('.text-lg { font-size: 18px } h3 { font-size: 14px } .card h3 { font-size: 15px }')
    document.body.innerHTML = '<div class="card"><h3 class="text-lg">t</h3></div>'
    const h3 = document.querySelector('h3')!
    expect(provenance(h3, 'font-size')).toEqual({
      kind: 'rule',
      selector: '.card h3',
      value: '15px',
    })
    document.body.innerHTML = '<h3 class="text-lg">t</h3>'
    expect(provenance(document.querySelector('h3')!, 'font-size')).toEqual({
      kind: 'rule',
      selector: '.text-lg',
      value: '18px',
      className: 'text-lg',
    })
  })

  test('!important wins, grouped selectors are split, state pseudo-classes are skipped', () => {
    css('a:hover, .x { color: red } .btn, .other { color: blue !important } .last { color: green }')
    document.body.innerHTML = '<a class="x btn last">t</a>'
    const a = document.querySelector('a')!
    expect(provenance(a, 'color')).toMatchObject({
      kind: 'rule',
      selector: '.btn',
      className: 'btn',
      value: 'blue',
    })
  })

  test('inline style comes first and var() references become tokens', () => {
    css(':root { --lh: 24px } .p { line-height: var(--lh) }')
    document.body.innerHTML = '<p class="p" style="font-size: var(--fs)">t</p>'
    const p = document.querySelector('p')!
    expect(provenance(p, 'font-size')).toEqual({
      kind: 'inline',
      value: 'var(--fs)',
      token: '--fs',
    })
    expect(provenance(p, 'line-height')).toEqual({
      kind: 'rule',
      selector: '.p',
      value: 'var(--lh)',
      className: 'p',
      token: '--lh',
    })
  })

  test('inherited properties are traced to the ancestor that sets them', () => {
    css('.prose { font-size: 17px }')
    document.body.innerHTML = '<section class="prose"><div><b>t</b></div></section>'
    expect(provenance(document.querySelector('b')!, 'font-size')).toEqual({
      kind: 'inherited',
      from: 'section',
      selector: '.prose',
      value: '17px',
      className: 'prose',
    })
  })

  test('shorthands feed their longhands', () => {
    css('.card { padding: 4px 8px }')
    document.body.innerHTML = '<div class="card"></div>'
    expect(provenance(document.querySelector('div')!, 'padding-left')).toMatchObject({
      kind: 'rule',
      selector: '.card',
    })
  })

  test('sizes nobody sets are laid out by the parent', () => {
    css('.grid { display: grid } .flex { display: flex }')
    document.body.innerHTML =
      '<div class="grid"><article>a</article></div><div class="flex"><span>s</span></div><p>p</p>'
    expect(provenance(document.querySelector('article')!, 'width')).toEqual({
      kind: 'layout',
      from: 'grid',
    })
    expect(provenance(document.querySelector('span')!, 'width')).toEqual({
      kind: 'layout',
      from: 'flex',
    })
    expect(provenance(document.querySelector('p')!, 'width')).toEqual({
      kind: 'layout',
      from: 'block',
    })
    expect(provenance(document.querySelector('p')!, 'opacity')).toEqual({ kind: 'default' })
  })

  test('media queries are honoured when matchMedia exists, and missing matchMedia counts as matching', () => {
    css('@media (min-width: 1px) { .m { color: red } }')
    document.body.innerHTML = '<i class="m"></i>'
    expect(provenance(document.querySelector('i')!, 'color')).toMatchObject({ selector: '.m' })
  })
})

describe('suggestClass', () => {
  test('finds the sibling class whose value computes to the target, skipping the current one', () => {
    css(
      '.text-sm { font-size: 14px } .text-base { font-size: 16px } .text-lg { font-size: 18px } .text-xl { font-size: 20px } .w-48 { width: 192px }',
    )
    document.body.innerHTML = '<div><h3 class="text-lg">t</h3></div>'
    const h3 = document.querySelector('h3')!
    const source = provenance(h3, 'font-size')
    expect(suggestClass(h3, 'font-size', '20px', source)).toBe('text-xl')
    expect(suggestClass(h3, 'font-size', '19px', source)).toBeUndefined()
    expect(suggestClass(h3, 'font-size', '18px', source)).toBeUndefined() // the current class is not a suggestion
    expect(suggestClass(h3, 'width', '192px')).toBe('w-48')
    expect(document.querySelector('div')!.children).toHaveLength(1) // the probe is removed
  })
})
