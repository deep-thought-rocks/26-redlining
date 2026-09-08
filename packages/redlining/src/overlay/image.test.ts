import { describe, expect, test } from 'vitest'
import { dataUrlBytes, fitWithin, imageFiles } from './image'

describe('fitWithin', () => {
  test('scales the longest edge down to the cap and never up', () => {
    expect(fitWithin(3200, 1600)).toEqual({ w: 1600, h: 800 })
    expect(fitWithin(800, 2400, 1200)).toEqual({ w: 400, h: 1200 })
    expect(fitWithin(640, 480)).toEqual({ w: 640, h: 480 })
    expect(fitWithin(0, 0)).toEqual({ w: 0, h: 0 })
    expect(fitWithin(5000, 1)).toEqual({ w: 1600, h: 1 })
  })
})

test('imageFiles keeps only images, in order', () => {
  const files = [
    { type: 'text/plain', name: 'a.txt' },
    { type: 'image/png', name: 'b.png' },
    { type: 'image/jpeg', name: 'c.jpg' },
  ] as File[]
  expect(imageFiles({ files } as unknown as DataTransfer).map((f) => f.name)).toEqual([
    'b.png',
    'c.jpg',
  ])
  expect(imageFiles(null)).toEqual([])
})

test('dataUrlBytes sums the decoded size', () => {
  expect(dataUrlBytes(['data:image/png;base64,AAAA', 'data:image/png;base64,AAAAAAAA'])).toBe(9)
  expect(dataUrlBytes([])).toBe(0)
})
