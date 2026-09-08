// @vitest-environment jsdom
import { expect, test } from 'vitest'
import { gapsBetween, nudgeChange, parseNudge } from './TweakLayer'

test('parseNudge reads the translate property and the older transform form; nudges write translate values', () => {
  expect(parseNudge('2px 10px')).toEqual({ dx: 2, dy: 10 })
  expect(parseNudge('-4px 0px')).toEqual({ dx: -4, dy: 0 })
  expect(parseNudge('translate(12px, -4px)')).toEqual({ dx: 12, dy: -4 })
  expect(parseNudge(undefined)).toEqual({ dx: 0, dy: 0 })
  expect(parseNudge('none')).toEqual({ dx: 0, dy: 0 })
  const [c] = nudgeChange([], 3, -2, 'none')
  expect(c).toMatchObject({
    kind: 'nudge',
    property: 'transform',
    to: '3px -2px',
    input: '+3px right, −2px up',
  })
  expect(nudgeChange([c!], 0, 0, 'none')).toEqual([])
})

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
