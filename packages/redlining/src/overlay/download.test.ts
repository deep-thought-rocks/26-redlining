// @vitest-environment jsdom
import { expect, test } from 'vitest'
import type { Session } from '../types'
import { exportFiles } from './download'

test('exportFiles names the markdown, json, screenshots and images like the route', async () => {
  const png = `data:image/png;base64,${btoa('PNG')}`
  const session: Session = {
    route: '/x',
    url: 'http://l/x',
    viewport: { w: 1, h: 1 },
    annotations: [
      {
        id: 'a',
        index: 1,
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
        refs: [png],
      },
    ],
    screenshot: png,
    crops: { '1': png },
  }
  const files = exportFiles(session)
  expect(files.map((f) => f.name)).toEqual([
    'annotations.md',
    'annotations.json',
    'screenshot.png',
    'ref-1-1.png',
    'crop-1.png',
  ])
  expect(files[0]!.content).toContain('- Reference: .redlining/ref-1-1.png')
  expect(files[1]!.content).toContain('".redlining/crop-1.png"')
  expect(await (files[2]!.content as Blob).text()).toBe('PNG')
})
