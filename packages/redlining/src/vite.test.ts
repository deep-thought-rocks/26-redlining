import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { redlining, type NodeRequestLike, type NodeResponseLike } from './vite'

describe('vite plugin', () => {
  test('stamps included tsx/jsx files relative to the resolved root and skips the rest', () => {
    const plugin = redlining()
    plugin.configResolved({ root: '/proj' })
    const out = plugin.transform('const x = <div />', '/proj/src/App.tsx?import')
    expect(out?.code).toBe('const x = <div data-rl="src/App.tsx:1:11" />')
    expect(out?.map).toMatchObject({ version: 3, sources: ['src/App.tsx'] })
    expect(plugin.transform('const x = <div />', '/proj/lib/x.tsx')).toBeNull()
    expect(plugin.transform('const x = <div />', '/proj/src/x.ts')).toBeNull()
    expect(plugin.transform('const x = <div />', '/proj/node_modules/pkg/src/x.tsx')).toBeNull()
    expect(plugin.transform('const x = 1', '/proj/src/plain.tsx')).toBeNull()
  })

  test('honours include and an explicit projectRoot, and only applies to serve', () => {
    const plugin = redlining({ include: ['app', 'components/'], projectRoot: '/p' })
    plugin.configResolved({ root: '/ignored' })
    expect(plugin.transform('<a />', '/p/components/B.jsx')?.code).toBe(
      '<a data-rl="components/B.jsx:1:1" />',
    )
    expect(plugin.transform('<a />', '/p/src/A.tsx')).toBeNull()
    expect(plugin.apply).toBe('serve')
    expect(plugin.enforce).toBe('pre')
  })
})

test('endpoint: serves GET and POST from the dev server and writes under the root', async () => {
  const { mkdtemp, rm, readFile } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const root = await mkdtemp(path.join(tmpdir(), 'redlining-vite-'))
  try {
    const plugin = redlining({ endpoint: true })
    plugin.configResolved({ root })
    let handler: ((req: NodeRequestLike, res: NodeResponseLike, next: () => void) => void) | null =
      null
    plugin.configureServer!({
      middlewares: {
        use(url, h) {
          expect(url).toBe('/api/redlining')
          handler = h
        },
      },
    })
    const request = (method: string, body: string): NodeRequestLike => {
      const listeners: Record<string, ((arg?: unknown) => void)[]> = {}
      const req = {
        method,
        url: '/',
        headers: { 'content-type': 'application/json' },
        on(event: string, listener: (arg?: unknown) => void) {
          ;(listeners[event] ??= []).push(listener)
          if (event === 'end') {
            for (const l of listeners.data ?? []) l(body)
            listener()
          }
          return req
        },
      }
      return req as unknown as NodeRequestLike
    }
    const response = () => {
      const res = { statusCode: 0, headers: {} as Record<string, string>, body: '' }
      const like: NodeResponseLike = {
        get statusCode() {
          return res.statusCode
        },
        set statusCode(v: number) {
          res.statusCode = v
        },
        setHeader: (n, v) => (res.headers[n] = v),
        end: (b) => (res.body = b ?? ''),
      }
      return { res, like }
    }
    const session = { route: '/x', url: 'http://l/x', viewport: { w: 1, h: 1 }, annotations: [] }
    const posted = response()
    await new Promise<void>((done) => {
      posted.like.end = (b) => {
        posted.res.body = b ?? ''
        done()
      }
      handler!(request('POST', JSON.stringify({ session })), posted.like, () => {})
    })
    expect(posted.res.statusCode).toBe(200)
    expect(JSON.parse(posted.res.body).files).toEqual([
      '.redlining/annotations.md',
      '.redlining/annotations.json',
    ])
    expect(await readFile(path.join(root, '.redlining/annotations.md'), 'utf8')).toContain(
      '# Redlining — /x',
    )
    const got = response()
    await new Promise<void>((done) => {
      got.like.end = (b) => {
        got.res.body = b ?? ''
        done()
      }
      handler!(request('GET', ''), got.like, () => {})
    })
    expect(JSON.parse(got.res.body)).toEqual({ reply: null, mtime: null })
    // A forged Origin is refused through the adapter; the Host header defines the own origin.
    const forged = response()
    await new Promise<void>((done) => {
      forged.like.end = (b) => {
        forged.res.body = b ?? ''
        done()
      }
      const req = request('POST', JSON.stringify({ session }))
      req.headers.origin = 'https://evil.example'
      req.headers.host = 'localhost:5173'
      handler!(req, forged.like, () => {})
    })
    expect(forged.res.statusCode).toBe(403)
    let passed = false
    handler!(request('DELETE', ''), response().like, () => (passed = true))
    expect(passed).toBe(true)
    expect(redlining().configureServer).toBeDefined()
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
