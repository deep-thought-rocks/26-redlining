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

  test('survives a form whose field is named "id"', () => {
    document.body.innerHTML = '<form><input name="id"><span></span></form>'
    // In browsers, named access on <form> shadows the id property with the input element
    // (form.id is the <input>, not a string). jsdom does not implement that override, so
    // the shadowing is simulated here.
    const form = document.querySelector('form')!
    Object.defineProperty(form, 'id', { value: form.querySelector('input'), configurable: true })
    expect(typeof form.id).toBe('object')
    expect(cssPath(document.querySelector('span')!)).toBe('form > span')
  })
})
