import { describe, expect, test } from 'vitest'
import type { Session } from '../types'
import { assetFiles, cropName, imageExt, refName, routeSlug, withAssetPaths } from './assets'

const png = 'data:image/png;base64,iVBORw0KGgo='
const jpg = 'data:image/jpeg;base64,/9j/4AAQ'
const session: Session = {
  route: '/x',
  url: 'http://l/x',
  viewport: { w: 1, h: 1 },
  annotations: [
    {
      id: 'a',
      index: 2,
      action: 'change',
      anchor: {
        tag: 'p',
        owners: [],
        selector: 'p',
        rect: { x: 0, y: 0, w: 1, h: 1 },
        resolved: 'exact',
      },
      note: 'n',
      createdAt: 't',
      refs: [png, jpg],
    },
  ],
  crops: { '2': png },
}

describe('assets', () => {
  test('recognises image data URLs and their extension', () => {
    expect(imageExt(png)).toBe('png')
    expect(imageExt(jpg)).toBe('jpg')
    expect(imageExt('data:text/plain;base64,QQ==')).toBeNull()
  })

  test('names files per annotation index and lists every image to write', () => {
    expect(refName(2, 1, png)).toBe('ref-2-1.png')
    expect(refName(2, 2, jpg)).toBe('ref-2-2.jpg')
    expect(cropName(2)).toBe('crop-2.png')
    expect(assetFiles(session).map((f) => f.name)).toEqual([
      'ref-2-1.png',
      'ref-2-2.jpg',
      'crop-2.png',
    ])
  })

  test('other routes are filed too, under route-scoped names that cannot collide', () => {
    const other: Session = { ...session, route: '/settings/team', crops: { '2': jpg } }
    const root: Session = { ...session, route: '/', annotations: [], crops: { '1': png } }
    const bundled = { ...session, others: [other, root] }
    expect(routeSlug('/settings/team')).toBe('settings-team')
    expect(routeSlug('/')).toBe('root')
    expect(assetFiles(bundled).map((f) => f.name)).toEqual([
      'ref-2-1.png',
      'ref-2-2.jpg',
      'crop-2.png',
      'ref-settings-team-2-1.png',
      'ref-settings-team-2-2.jpg',
      'crop-settings-team-2.jpg'.replace('.jpg', '.png'),
      'crop-root-1.png',
    ])
    const filed = withAssetPaths(bundled, '.redlining')
    expect(filed.others![0]!.annotations[0]!.refs).toEqual([
      '.redlining/ref-settings-team-2-1.png',
      '.redlining/ref-settings-team-2-2.jpg',
    ])
    expect(filed.others![0]!.crops).toEqual({ '2': '.redlining/crop-settings-team-2.png' })
    expect(JSON.stringify(filed)).not.toContain('data:')
  })

  test('replaces data URLs with paths and leaves paths alone', () => {
    const filed = withAssetPaths(session, '.redlining')
    expect(filed.annotations[0]!.refs).toEqual(['.redlining/ref-2-1.png', '.redlining/ref-2-2.jpg'])
    expect(filed.crops).toEqual({ '2': '.redlining/crop-2.png' })
    expect(withAssetPaths(filed, 'other').annotations[0]!.refs).toEqual(filed.annotations[0]!.refs)
    expect(
      withAssetPaths({ ...session, annotations: [], crops: undefined }, 'd'),
    ).not.toHaveProperty('crops')
  })
})
