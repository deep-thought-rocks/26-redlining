import { describe, expect, test } from 'vitest'
import { classFor, themeScale, toPx, type ThemeContext } from './theme'

const tw4: ThemeContext = {
  remPx: 16,
  tokens: new Map([
    ['--spacing', '.25rem'],
    ['--text-lg', '1.125rem'],
    ['--text-lg--line-height', 'calc(1.75 / 1.125)'],
    ['--text-hero', '3.5rem'],
    ['--radius-lg', '.5rem'],
    ['--color-brand-500', 'oklch(62% 0.2 250)'],
  ]),
}
const tw3: ThemeContext = { remPx: 16, tokens: new Map() }

test('toPx converts rem and px', () => {
  expect(toPx('.25rem', 16)).toBe(4)
  expect(toPx('12px', 16)).toBe(12)
  expect(toPx('0', 16)).toBe(0)
  expect(toPx('calc(1 / 2)', 16)).toBeUndefined()
})

describe('classFor on Tailwind 4', () => {
  test('spacing properties divide by --spacing; half steps are exact, others arbitrary', () => {
    expect(classFor('tailwind4', 'padding-left', '24px', tw4)).toEqual({
      className: 'pl-6',
      exact: true,
    })
    expect(classFor('tailwind4', 'padding-left', '2px', tw4)).toEqual({
      className: 'pl-0.5',
      exact: true,
    })
    expect(classFor('tailwind4', 'padding-left', '1px', tw4)).toEqual({
      className: 'pl-px',
      exact: true,
    })
    expect(classFor('tailwind4', 'padding-left', '52px', tw4)).toEqual({
      className: 'pl-13',
      exact: true,
    })
    expect(classFor('tailwind4', 'padding-left', '13px', tw4)).toEqual({
      className: 'pl-[13px]',
      exact: false,
    })
    expect(classFor('tailwind4', 'margin-top', '-8px', tw4)).toEqual({
      className: '-mt-2',
      exact: true,
    })
    expect(classFor('tailwind4', 'gap', '16px', tw4)).toEqual({ className: 'gap-4', exact: true })
    expect(classFor('tailwind4', 'width', '192px', tw4)).toEqual({ className: 'w-48', exact: true })
  })

  test('type scale from tokens, then defaults', () => {
    expect(classFor('tailwind4', 'font-size', '18px', tw4)).toEqual({
      className: 'text-lg',
      exact: true,
    })
    expect(classFor('tailwind4', 'font-size', '56px', tw4)).toEqual({
      className: 'text-hero',
      exact: true,
    })
    expect(classFor('tailwind4', 'font-size', '20px', tw4)).toEqual({
      className: 'text-xl',
      exact: true,
    })
    expect(classFor('tailwind4', 'font-size', '17px', tw4)).toEqual({
      className: 'text-[17px]',
      exact: false,
    })
  })

  test('line height, radius, weight, tracking', () => {
    expect(classFor('tailwind4', 'line-height', '28px', tw4)).toEqual({
      className: 'leading-7',
      exact: true,
    })
    expect(classFor('tailwind4', 'line-height', '22px', tw4)).toEqual({
      className: 'leading-[22px]',
      exact: false,
    })
    expect(classFor('tailwind4', 'border-radius', '8px', tw4)).toEqual({
      className: 'rounded-lg',
      exact: true,
    })
    expect(classFor('tailwind4', 'border-radius', '9999px', tw4)).toEqual({
      className: 'rounded-full',
      exact: true,
    })
    expect(classFor('tailwind4', 'font-weight', '600', tw4)).toEqual({
      className: 'font-semibold',
      exact: true,
    })
    expect(classFor('tailwind4', 'font-weight', '650', tw4)).toBeUndefined()
    expect(classFor('tailwind4', 'letter-spacing', '0px', tw4)).toEqual({
      className: 'tracking-normal',
      exact: true,
    })
  })

  test('colours use the --color-* token name, else an arbitrary hex', () => {
    expect(classFor('tailwind4', 'color', 'rgb(1, 2, 3)', tw4, '--color-brand-500')).toEqual({
      className: 'text-brand-500',
      exact: true,
    })
    expect(
      classFor('tailwind4', 'background-color', 'rgb(1, 2, 3)', tw4, '--color-brand-500'),
    ).toEqual({ className: 'bg-brand-500', exact: true })
    expect(classFor('tailwind4', 'background-color', 'rgb(37, 99, 235)', tw4)).toEqual({
      className: 'bg-[#2563eb]',
      exact: false,
    })
    expect(classFor('tailwind4', 'border-color', 'rgb(37, 99, 235)', tw4, '--accent')).toEqual({
      className: 'border-[#2563eb]',
      exact: false,
    })
  })
})

describe('classFor on Tailwind 3', () => {
  test('uses the static default theme; off-list spacing is arbitrary', () => {
    expect(classFor('tailwind3', 'font-size', '20px', tw3)).toEqual({
      className: 'text-xl',
      exact: true,
    })
    expect(classFor('tailwind3', 'padding-left', '24px', tw3)).toEqual({
      className: 'pl-6',
      exact: true,
    })
    expect(classFor('tailwind3', 'padding-left', '52px', tw3)).toEqual({
      className: 'pl-[52px]',
      exact: false,
    })
    expect(classFor('tailwind3', 'border-radius', '4px', tw3)).toEqual({
      className: 'rounded',
      exact: true,
    })
    expect(classFor('tailwind3', 'line-height', '28px', tw3)).toEqual({
      className: 'leading-7',
      exact: true,
    })
  })
})

test('plain CSS and CSS Modules get no class hints or scale', () => {
  expect(classFor('css', 'padding-left', '24px', tw3)).toBeUndefined()
  expect(classFor('css-modules', 'font-size', '18px', tw3)).toBeUndefined()
  expect(themeScale('css', 'font-size', tw3)).toEqual([])
})

test('themeScale lists ascending steps with class names', () => {
  const fs = themeScale('tailwind4', 'font-size', tw4)
  expect(fs.slice(0, 4)).toEqual([
    { className: 'text-xs', px: 12 },
    { className: 'text-sm', px: 14 },
    { className: 'text-base', px: 16 },
    { className: 'text-lg', px: 18 },
  ])
  expect(fs.find((s) => s.className === 'text-hero')).toEqual({ className: 'text-hero', px: 56 })
  expect(themeScale('tailwind4', 'padding-left', tw4).slice(0, 3)).toEqual([
    { className: 'pl-0', px: 0 },
    { className: 'pl-0.5', px: 2 },
    { className: 'pl-1', px: 4 },
  ])
  expect(themeScale('tailwind3', 'border-radius', tw3).map((s) => s.className)).toContain('rounded')
  expect(themeScale('tailwind4', 'opacity', tw4)).toEqual([])
})
