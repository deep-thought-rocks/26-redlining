import { describe, expect, test } from 'vitest'
import { placeNear } from './placement'

const viewport = { w: 1280, h: 720 }
const size = { w: 340, h: 300 }

describe('placeNear', () => {
  test('below when it fits above the toolbar reserve', () => {
    expect(placeNear({ x: 100, y: 100, w: 200, h: 40 }, size, viewport)).toEqual({
      left: 100,
      top: 148,
    })
  })
  test('above when below would run into the toolbar', () => {
    expect(placeNear({ x: 100, y: 600, w: 200, h: 40 }, size, viewport)).toEqual({
      left: 100,
      top: 292,
    })
  })
  test('above an element inside the toolbar band still clears the band', () => {
    // Above would end at 682, inside the bottom 80px; the element is below the popover either way.
    expect(placeNear({ x: 100, y: 690, w: 200, h: 20 }, size, viewport)).toEqual({
      left: 100,
      top: 720 - 80 - 300,
    })
  })
  test('beside for a tall element that fills the height', () => {
    expect(placeNear({ x: 500, y: 20, w: 200, h: 680 }, size, viewport)).toEqual({
      left: 152,
      top: 20,
    })
    expect(placeNear({ x: 20, y: 20, w: 200, h: 680 }, size, viewport)).toEqual({
      left: 228,
      top: 20,
    })
  })
  test('clamps as the last resort and at the right edge', () => {
    expect(placeNear({ x: 10, y: 20, w: 1260, h: 680 }, size, viewport)).toEqual({
      left: 10,
      top: 720 - 80 - 300,
    })
    expect(placeNear({ x: 1200, y: 100, w: 60, h: 40 }, size, viewport).left).toBe(1280 - 340 - 8)
  })
  test('options change the gap and the reserve', () => {
    expect(
      placeNear({ x: 0, y: 0, w: 10, h: 10 }, size, viewport, { margin: 16, reserveBottom: 0 }),
    ).toEqual({
      left: 16,
      top: 26,
    })
  })
})
