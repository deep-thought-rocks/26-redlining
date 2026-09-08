// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from 'vitest'
import { detectFramework, isModuleClass } from './framework'

function css(text: string) {
  const style = document.createElement('style')
  style.textContent = text
  document.head.appendChild(style)
}

beforeEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

describe('detectFramework', () => {
  test('Tailwind 4 from its theme tokens, even inside @layer', () => {
    css(
      '@layer theme { :root, :host { --spacing: .25rem; --text-sm: .875rem; --color-red-500: red } }',
    )
    expect(detectFramework(document)).toEqual({
      kind: 'tailwind4',
      evidence: '--spacing and --text-* tokens',
    })
  })

  test('Tailwind 3 from the --tw-* preflight variables', () => {
    css(
      '*, ::before, ::after { --tw-border-spacing-x: 0; --tw-ring-offset-width: 0px } .text-sm { font-size: .875rem }',
    )
    expect(detectFramework(document)).toEqual({
      kind: 'tailwind3',
      evidence: '--tw-* variables in the preflight',
    })
  })

  test('CSS Modules from hashed class names on decorated elements', () => {
    document.body.innerHTML =
      '<div data-rl="a:1:1" class="card_root__Ab12C"><h2 data-rl="a:2:3" class="card_title__9xYz1 bold"></h2><p data-rl="b:1:1" class="_text_1a2b3_4"></p></div>'
    expect(detectFramework(document)).toEqual({
      kind: 'css-modules',
      evidence: '3 of 4 class names are hashed',
    })
  })

  test('plain CSS otherwise', () => {
    css(':root { --accent: blue } .card { padding: 4px }')
    document.body.innerHTML = '<div data-rl="a:1:1" class="card"></div>'
    expect(detectFramework(document).kind).toBe('css')
  })
})

test('isModuleClass recognises Next and Vite hashes only', () => {
  expect(isModuleClass('card_root__Ab12C')).toBe(true)
  expect(isModuleClass('_root_1a2b3_1')).toBe(true)
  expect(isModuleClass('text-lg')).toBe(false)
  expect(isModuleClass('btn')).toBe(false)
})
