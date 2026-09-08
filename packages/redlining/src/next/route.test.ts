import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import type { Session } from '../types'
import { createHandler, createHandlers } from './route'

const session: Session = {
  route: '/x',
  url: 'http://localhost:3000/x',
  viewport: { w: 100, h: 100 },
  annotations: [],
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  const raw = typeof body === 'string' ? body : JSON.stringify(body)
  return new Request('http://localhost/api/redlining', { method: 'POST', body: raw, headers })
}

describe('route handler', () => {
  let root: string
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'redlining-'))
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  test('writes markdown and json under <projectRoot>/.redlining and reports the files', async () => {
    const POST = createHandler({ projectRoot: root, enabled: true })
    const res = await POST(post({ session }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      files: ['.redlining/annotations.md', '.redlining/annotations.json'],
    })
    expect(readFileSync(path.join(root, '.redlining/annotations.md'), 'utf8')).toContain(
      '# Redlining — /x',
    )
    expect(
      JSON.parse(readFileSync(path.join(root, '.redlining/annotations.json'), 'utf8')),
    ).toEqual(session)
    expect(existsSync(path.join(root, '.redlining/screenshot.png'))).toBe(false)
  })

  test('decodes a PNG data URL into screenshot.png, and removes a stale one on the next save', async () => {
    const POST = createHandler({ projectRoot: root, enabled: true, outDir: 'out' })
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64')
    const first = await POST(
      post({ session: { ...session, screenshot: `data:image/png;base64,${png}` } }),
    )
    expect(await first.json()).toEqual({
      files: ['out/annotations.md', 'out/annotations.json', 'out/screenshot.png'],
    })
    expect(readFileSync(path.join(root, 'out/screenshot.png'))).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    )
    expect(readFileSync(path.join(root, 'out/annotations.md'), 'utf8')).toContain(
      'Screenshot: out/screenshot.png',
    )
    await POST(post({ session }))
    expect(existsSync(path.join(root, 'out/screenshot.png'))).toBe(false)
  })

  test('writes a before screenshot when the session carries one', async () => {
    const POST = createHandler({ projectRoot: root, enabled: true })
    const png = Buffer.from([1, 2, 3]).toString('base64')
    const res = await POST(
      post({
        session: {
          ...session,
          screenshot: `data:image/png;base64,${png}`,
          screenshotBefore: `data:image/png;base64,${png}`,
        },
      }),
    )
    expect(await res.json()).toEqual({
      files: [
        '.redlining/annotations.md',
        '.redlining/annotations.json',
        '.redlining/screenshot.png',
        '.redlining/screenshot-before.png',
      ],
    })
    expect(existsSync(path.join(root, '.redlining/screenshot-before.png'))).toBe(true)
    await POST(post({ session }))
    expect(existsSync(path.join(root, '.redlining/screenshot-before.png'))).toBe(false)
  })

  test('writes reference images and crops as files, names them in the export, and prunes stale ones', async () => {
    const POST = createHandler({ projectRoot: root, enabled: true })
    const png = `data:image/png;base64,${Buffer.from('PNG1').toString('base64')}`
    const jpg = `data:image/jpeg;base64,${Buffer.from('JPG2').toString('base64')}`
    const annotation = {
      id: 'a',
      index: 1,
      action: 'change' as const,
      anchor: {
        tag: 'p',
        owners: [],
        selector: 'p',
        rect: { x: 0, y: 0, w: 1, h: 1 },
        resolved: 'exact' as const,
      },
      note: 'Match the mockup.',
      createdAt: 't',
      refs: [png, jpg],
    }
    const res = await POST(
      post({ session: { ...session, annotations: [annotation], crops: { '1': png } } }),
    )
    expect(await res.json()).toEqual({
      files: [
        '.redlining/annotations.md',
        '.redlining/annotations.json',
        '.redlining/ref-1-1.png',
        '.redlining/ref-1-2.jpg',
        '.redlining/crop-1.png',
      ],
    })
    expect(readFileSync(path.join(root, '.redlining/ref-1-2.jpg'), 'utf8')).toBe('JPG2')
    const md = readFileSync(path.join(root, '.redlining/annotations.md'), 'utf8')
    expect(md).toContain(
      '- Reference: .redlining/ref-1-1.png, .redlining/ref-1-2.jpg — match this; it shows the intended result',
    )
    expect(md).toContain('- Crop: .redlining/crop-1.png — this element as it looks now')
    const json = JSON.parse(readFileSync(path.join(root, '.redlining/annotations.json'), 'utf8'))
    expect(json.annotations[0].refs).toEqual(['.redlining/ref-1-1.png', '.redlining/ref-1-2.jpg'])
    expect(json.crops).toEqual({ '1': '.redlining/crop-1.png' })
    // The next save without images removes them.
    await POST(post({ session }))
    expect(existsSync(path.join(root, '.redlining/ref-1-1.png'))).toBe(false)
    expect(existsSync(path.join(root, '.redlining/crop-1.png'))).toBe(false)
  })

  test('GET returns the agent reply with its mtime, or nulls when there is none', async () => {
    const { GET, POST } = createHandlers({ projectRoot: root, enabled: true })
    expect(await (await GET()).json()).toEqual({ reply: null, mtime: null })
    await POST(post({ session }))
    const { writeFile } = await import('node:fs/promises')
    await writeFile(path.join(root, '.redlining/reply.md'), '## 1 · done — ok\n')
    const body = (await (await GET()).json()) as { reply: string; mtime: string }
    expect(body.reply).toBe('## 1 · done — ok\n')
    expect(new Date(body.mtime).getTime()).toBeGreaterThan(0)
    expect((await createHandlers({ projectRoot: root, enabled: false }).GET()).status).toBe(403)
  })

  test('refuses cross-origin browser requests and validates the session before writing', async () => {
    const POST = createHandler({ projectRoot: root, enabled: true })
    const evil = await POST(post({ session }, { origin: 'https://evil.example' }))
    expect(evil.status).toBe(403)
    expect(await evil.text()).toContain('Cross-origin save refused')
    expect((await POST(post({ session }, { 'sec-fetch-site': 'cross-site' }))).status).toBe(403)
    expect((await POST(post({ session }, { origin: 'http://localhost' }))).status).toBe(200)
    expect(
      (
        await POST(
          post({ session }, { origin: 'http://127.0.0.1', 'sec-fetch-site': 'same-origin' }),
        )
      ).status,
    ).toBe(200)
    expect(existsSync(path.join(root, '.redlining/annotations.md'))).toBe(true)

    const forged = {
      ...session,
      annotations: [
        {
          id: 'a',
          index: '../../../../tmp/redlining-pwned',
          action: 'change',
          anchor: {
            tag: 'p',
            owners: [],
            selector: 'p',
            rect: { x: 0, y: 0, w: 1, h: 1 },
            resolved: 'exact',
          },
          note: 'n',
          refs: [`data:image/png;base64,${Buffer.from('PWNED').toString('base64')}`],
        },
      ],
    }
    const res = await POST(post({ session: forged }))
    expect(res.status).toBe(400)
    expect(await res.text()).toBe('annotations[0].index must be a positive integer')
    expect(existsSync('/tmp/redlining-pwned-1.png')).toBe(false)
    const badCrop = await POST(
      post({ session: { ...session, crops: { '../x': 'data:image/png;base64,AA' } } }),
    )
    expect(badCrop.status).toBe(400)
  })

  test('refuses outside development', async () => {
    const POST = createHandler({ projectRoot: root, enabled: false })
    expect((await POST(post({ session }))).status).toBe(403)
    expect(existsSync(path.join(root, '.redlining'))).toBe(false)
  })

  test('rejects oversized and malformed bodies', async () => {
    const POST = createHandler({ projectRoot: root, enabled: true, maxBytes: 64 })
    expect((await POST(post({ session }, { 'content-length': '999' }))).status).toBe(413)
    expect((await POST(post({ session, pad: 'x'.repeat(100) }))).status).toBe(413)
    // The cap counts UTF-8 bytes, not string length: 40 chars of "ä" are 80 bytes.
    const body = JSON.stringify({ session, pad: 'ä'.repeat(40) })
    const cap = body.length + 10 // under the byte size (each ä is two bytes), over the string length
    const tight = createHandler({ projectRoot: root, enabled: true, maxBytes: cap })
    expect(Buffer.byteLength(body)).toBeGreaterThan(cap)
    expect((await tight(post(body))).status).toBe(413)
    expect((await POST(post('{not json'))).status).toBe(400)
    expect((await POST(post({ session: { route: 1 } }))).status).toBe(400)
  })

  test('refuses an outDir outside the project root at construction time', () => {
    expect(() => createHandler({ projectRoot: root, outDir: '../elsewhere' })).toThrow(
      /inside the project root/,
    )
    expect(() => createHandler({ projectRoot: root, outDir: '.' })).toThrow(
      /inside the project root/,
    )
  })
})
