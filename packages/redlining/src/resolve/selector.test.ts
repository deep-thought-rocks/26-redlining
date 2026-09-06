// @vitest-environment jsdom
import { describe, expect, test } from 'vitest'
import { cssPath } from './selector'

describe('cssPath', () => {
  test('builds a tag path with nth-of-type only where siblings share a tag', () => {
    document.body.innerHTML =
      '<main><section></section><section><p></p><span></span><p id="skip-me-not"></p></section></main>'
    const p = document.querySelector('span')!
    expect(cssPath(p)).toBe('main > section:nth-of-type(2) > span')
  })

  test('short-circuits at the nearest id and escapes odd ids', () => {
    document.body.innerHTML =
      '<div id="root"><ul><li></li><li></li></ul></div><div id="a:b"><i></i></div>'
    expect(cssPath(document.querySelectorAll('li')[1]!)).toBe('#root > ul > li:nth-of-type(2)')
    expect(cssPath(document.querySelector('i')!)).toBe('[id="a:b"] > i')
  })

  test('returns the tag alone for a direct child of body', () => {
    document.body.innerHTML = '<header></header>'
    expect(cssPath(document.querySelector('header')!)).toBe('header')
  })
})
