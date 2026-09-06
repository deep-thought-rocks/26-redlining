import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import type { Session } from '../types'
import { createHandler } from './route'

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

  test('refuses outside development', async () => {
    const POST = createHandler({ projectRoot: root, enabled: false })
    expect((await POST(post({ session }))).status).toBe(403)
    expect(existsSync(path.join(root, '.redlining'))).toBe(false)
  })

  test('rejects oversized and malformed bodies', async () => {
    const POST = createHandler({ projectRoot: root, enabled: true, maxBytes: 64 })
    expect((await POST(post({ session }, { 'content-length': '999' }))).status).toBe(413)
    expect((await POST(post({ session, pad: 'x'.repeat(100) }))).status).toBe(413)
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
