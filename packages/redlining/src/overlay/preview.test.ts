// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from 'vitest'
import type { Change } from '../types'
import { describe as describeChange, summarise } from '../export/changes'
import {
  apply,
  canEditText,
  colorTokens,
  computed,
  isInline,
  relativeTo,
  reset,
  resetTokenCache,
  snapshot,
  toHex,
  toRgb,
  tokenFor,
} from './preview'

const style = (property: string, from: string, to: string): Change => ({
  kind: 'style',
  property,
  from,
  to,
})

describe('apply / reset', () => {
  test('applies longhands on top of the snapshot, idempotently, and reset restores everything', () => {
    document.body.innerHTML = '<button style="color: red">Export CSV</button>'
    const el = document.querySelector('button')!
    apply(el, [
      style('font-size', '14px', '16px'),
      { kind: 'text', property: 'text', from: 'Export CSV', to: 'Download CSV' },
    ])
    expect(el.style.fontSize).toBe('16px')
    expect(el.style.color).toBe('red')
    expect(el.textContent).toBe('Download CSV')
    expect(el.hasAttribute('data-rl-preview')).toBe(true)

    // Re-applying a shorter list drops the earlier change (undo = pop + apply).
    apply(el, [style('font-size', '14px', '16px')])
    expect(el.textContent).toBe('Export CSV')
    expect(el.style.fontSize).toBe('16px')

    reset(el)
    expect(el.style.cssText).toBe('color: red;')
    expect(el.textContent).toBe('Export CSV')
    expect(el.hasAttribute('data-rl-preview')).toBe(false)
  })

  test('nudge writes the translate property and visibility toggles display', () => {
    document.body.innerHTML = '<div>x</div>'
    const el = document.querySelector('div')!
    apply(el, [
      {
        kind: 'nudge',
        property: 'transform',
        from: 'none',
        to: '12px -4px',
        input: '+12px right, −4px up',
      },
      { kind: 'visibility', property: 'display', from: 'block', to: 'none' },
    ])
    expect(el.style.getPropertyValue('translate')).toBe('12px -4px')
    expect(el.style.display).toBe('none')
  })

  test('snapshot is taken once and survives later inline changes', () => {
    document.body.innerHTML = '<p style="margin: 0">t</p>'
    const el = document.querySelector('p')!
    expect(snapshot(el)).toEqual({ cssText: 'margin: 0px;', text: 't' })
    el.style.margin = '8px'
    expect(snapshot(el).cssText).toBe('margin: 0px;')
  })
})

describe('guards', () => {
  test('text is editable only with a single text node and no React-controlled props', () => {
    document.body.innerHTML = '<b>one</b><i>a<em>b</em>c</i><input value="x"><span> </span>'
    expect(canEditText(document.querySelector('b')!)).toBe(true)
    expect(canEditText(document.querySelector('i')!)).toBe(false) // two text nodes
    expect(canEditText(document.querySelector('input')!)).toBe(false)
    expect(canEditText(document.querySelector('span')!)).toBe(false) // whitespace only
    const controlled = document.querySelector('b')! as unknown as Record<string, unknown>
    controlled['__reactProps$x'] = { onChange: () => {} }
    expect(canEditText(document.querySelector('b')!)).toBe(false)
  })

  test('isInline and relativeTo read computed values', () => {
    document.body.innerHTML =
      '<div style="width: 400px"><span>a</span><section style="display:block;width:100px"></section></div>'
    expect(isInline(document.querySelector('span')!)).toBe(true)
    expect(isInline(document.querySelector('section')!)).toBe(false)
    expect(relativeTo(document.querySelector('section')!, 'width', 100)).toBe('≈ 25 % of parent')
    expect(computed(document.querySelector('section')!, 'width')).toBe('100px')
  })
})

describe('tokens', () => {
  beforeEach(() => resetTokenCache())

  test('finds a :root custom property by value, including colour forms', () => {
    document.head.innerHTML =
      '<style>:root { --accent: #2563eb; --gap-4: 16px; } .x { --local: 1px }</style>'
    document.body.innerHTML = ''
    expect(tokenFor('16px')).toBe('--gap-4')
    expect(tokenFor('#2563eb')).toBe('--accent')
    expect(tokenFor('rgb(37, 99, 235)')).toBe('--accent')
    expect(tokenFor('99px')).toBeUndefined()
    expect(tokenFor('1px')).toBeUndefined() // not on :root
  })

  test('colorTokens lists only colour-valued tokens, and hex/rgb convert both ways', () => {
    document.head.innerHTML =
      '<style>:root { --accent: #2563eb; --gap-4: 16px; --ink: rgb(15, 23, 42) }</style>'
    expect(colorTokens()).toEqual([
      { name: '--accent', value: 'rgb(37, 99, 235)' },
      { name: '--ink', value: 'rgb(15, 23, 42)' },
    ])
    expect(toHex('rgb(37, 99, 235)')).toBe('#2563eb')
    expect(toHex('rgba(0, 0, 0, 0)')).toBe('#000000')
    expect(toHex('#ABCDEF')).toBe('#abcdef')
    expect(toRgb('#2563eb')).toBe('rgb(37, 99, 235)')
  })
})

describe('summarise / describe', () => {
  test('collapses equal paired sides, drops no-op changes, keeps order', () => {
    const out = summarise([
      style('padding-left', '12px', '16px'),
      style('font-size', '14px', '14px'),
      style('padding-right', '12px', '16px'),
      style('margin-top', '0px', '8px'),
      style('margin-bottom', '0px', '4px'),
    ])
    expect(out.map((c) => c.property)).toEqual([
      'padding-left, padding-right',
      'margin-top',
      'margin-bottom',
    ])
  })

  test('describe names the source, a class suggestion, and warns for layout-derived sizes', () => {
    expect(
      describeChange({
        ...style('font-size', '18px', '20px'),
        source: { kind: 'rule', selector: '.text-lg', className: 'text-lg', value: '18px' },
        suggestion: 'text-xl',
      }),
    ).toBe('font-size: 18px → 20px (class text-lg → text-xl)')
    expect(
      describeChange({
        ...style('font-size', '18px', '19px'),
        source: { kind: 'rule', selector: '.text-lg', className: 'text-lg', value: '18px' },
      }),
    ).toBe('font-size: 18px → 19px (from class text-lg)')
    expect(
      describeChange({
        ...style('font-size', '15px', '17px'),
        source: { kind: 'rule', selector: 'button', value: 'inherit' },
        suggestion: 'text-lg',
      }),
    ).toBe('font-size: 15px → 17px (from `button`; add class text-lg)')
    // A utility from another family is added, not swapped in for a component class.
    expect(
      describeChange({
        ...style('padding-left', '12px', '14px'),
        source: { kind: 'rule', selector: '.btn', className: 'btn', value: '7px 12px' },
        suggestion: 'pl-3.5',
      }),
    ).toBe('padding-left: 12px → 14px (from class btn; add class pl-3.5)')
    expect(
      describeChange({
        ...style('line-height', '24px', '28px'),
        source: { kind: 'rule', selector: '.p', className: 'p', value: 'var(--lh)', token: '--lh' },
      }),
    ).toBe('line-height: 24px → 28px (from var(--lh) via class p)')
    expect(
      describeChange({
        ...style('font-size', '15px', '16px'),
        source: {
          kind: 'inherited',
          from: 'section',
          selector: '.prose',
          className: 'prose',
          value: '15px',
        },
      }),
    ).toBe('font-size: 15px → 16px (inherited from <section> via class prose)')
    expect(
      describeChange({
        ...style('width', '179.69px', '220px'),
        relative: '≈ 23 % of parent',
        source: { kind: 'layout', from: 'grid' },
      }),
    ).toBe(
      "width: auto (179.69px, laid out by the parent grid) → 220px (≈ 23 % of parent) — set by the parent's columns/gap, not by this element; prefer changing the layout",
    )
    expect(
      describeChange({
        ...style('color', 'rgb(0, 0, 0)', 'rgb(37, 99, 235)'),
        token: '--accent',
        source: { kind: 'rule', selector: '.btn', className: 'btn', value: '#000' },
      }),
    ).toBe('color: rgb(0, 0, 0) → rgb(37, 99, 235) (from class btn; token --accent)')
  })

  test('describe renders each kind for the export', () => {
    expect(
      describeChange({ ...style('width', '96px', '128px'), relative: '≈ 33 % of parent' }),
    ).toBe('width: 96px → 128px (≈ 33 % of parent)')
    expect(
      describeChange({ ...style('color', 'rgb(0, 0, 0)', 'rgb(37, 99, 235)'), token: '--accent' }),
    ).toBe('color: rgb(0, 0, 0) → rgb(37, 99, 235) (token --accent)')
    expect(describeChange({ kind: 'text', property: 'text', from: 'A', to: 'B' })).toBe(
      'text: "A" → "B"',
    )
    expect(
      describeChange({ kind: 'visibility', property: 'display', from: 'block', to: 'none' }),
    ).toBe('hide (display: none)')
    expect(
      describeChange({
        kind: 'nudge',
        property: 'transform',
        from: 'none',
        to: 'translate(8px, -4px)',
        input: '+8px right, −4px up',
      }),
    ).toMatch(/^visual nudge: \+8px right, −4px up — previewed with a transform/)
  })
})
