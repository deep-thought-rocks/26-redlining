// @vitest-environment jsdom
import { expect, test } from 'vitest'
import { gapsBetween } from './TweakLayer'

test('gapsBetween measures edge-to-edge distances on each axis', () => {
  const a = { x: 100, y: 100, w: 50, h: 50 }
  expect(gapsBetween(a, { x: 200, y: 110, w: 20, h: 20 })).toEqual([
    { axis: 'x', x: 150, y: 120, length: 50 },
  ])
  expect(gapsBetween(a, { x: 110, y: 10, w: 20, h: 50 })).toEqual([
    { axis: 'y', x: 120, y: 60, length: 40 },
  ])
  expect(gapsBetween(a, { x: 0, y: 0, w: 50, h: 50 })).toEqual([
    { axis: 'x', x: 50, y: 75, length: 50 },
    { axis: 'y', x: 75, y: 50, length: 50 },
  ])
  expect(gapsBetween(a, { x: 110, y: 110, w: 10, h: 10 })).toEqual([])
})
