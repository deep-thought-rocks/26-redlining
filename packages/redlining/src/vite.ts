import path from 'node:path'
import { transform } from './loader/transform'
import { createHandlers } from './server/handler'

export interface RedliningVitePluginOptions {
  /** Project-relative directories whose `.tsx`/`.jsx` files get anchors. Default `['src']`. */
  include?: string[]
  /** Defaults to Vite's project root (`config.root`). */
  projectRoot?: string
  /**
   * Serve the save endpoint from the Vite dev server: `true` for `/api/redlining`,
   * or a path. Writes under `outDir` (default `.redlining/`) inside the project root.
   */
  endpoint?: true | string
  outDir?: string
  /** Request body cap for the endpoint, in bytes. Default 16 MB. */
  maxBytes?: number
}

const DEFAULT_MAX_BYTES = 16 * 1024 * 1024

class BodyTooLarge extends Error {}

/** The slice of Node's request/response the middleware touches. */
export interface NodeRequestLike {
  method?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
  on(event: 'data', listener: (chunk: Buffer | string) => void): unknown
  on(event: 'end', listener: () => void): unknown
  on(event: 'error', listener: (err: Error) => void): unknown
  destroy?(): unknown
}
export interface NodeResponseLike {
  statusCode: number
  setHeader(name: string, value: string): unknown
  end(body?: string): unknown
}
export interface DevServerLike {
  middlewares: {
    use(
      path: string,
      handler: (req: NodeRequestLike, res: NodeResponseLike, next: () => void) => void,
    ): unknown
  }
}

/** The minimal Vite plugin interface this file needs; avoids a dependency on Vite's types. */
export interface VitePluginLike {
  name: string
  enforce: 'pre'
  apply: 'serve'
  configResolved(config: { root: string }): void
  configureServer?(server: DevServerLike): void
  transform(code: string, id: string): { code: string; map: object } | null
}

/** Buffers the body up to `maxBytes`; stops reading and rejects as soon as the cap is passed. */
function readBody(req: NodeRequestLike, maxBytes: number): Promise<string> {
  const declared = Number(req.headers['content-length'] ?? 0)
  if (declared > maxBytes) return Promise.reject(new BodyTooLarge())
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    let done = false
    req.on('data', (c) => {
      if (done) return
      const chunk = typeof c === 'string' ? Buffer.from(c) : c
      size += chunk.length
      if (size > maxBytes) {
        done = true
        req.destroy?.()
        reject(new BodyTooLarge())
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (!done) resolve(Buffer.concat(chunks).toString('utf8'))
    })
    req.on('error', (err) => {
      if (!done) reject(err)
    })
  })
}

/** Adapts a connect request to the Fetch handlers and writes the Response back. */
export async function serveRedlining(
  handlers: ReturnType<typeof createHandlers>,
  req: NodeRequestLike,
  res: NodeResponseLike,
  next: () => void,
  maxBytes = DEFAULT_MAX_BYTES,
): Promise<void> {
  const method = (req.method ?? 'GET').toUpperCase()
  const reply = (status: number, body: string) => {
    res.statusCode = status
    res.setHeader('content-type', 'text/plain; charset=utf-8')
    res.end(body)
  }
  try {
    let response: Response
    if (method === 'GET') response = await handlers.GET()
    else if (method === 'POST') {
      const headers = new Headers()
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === 'string') headers.set(k, v)
      }
      const body = await readBody(req, maxBytes)
      // The request's own origin comes from the Host header, so the same-origin check works.
      const host = typeof req.headers.host === 'string' ? req.headers.host : 'localhost'
      response = await handlers.POST(
        new Request(`http://${host}${req.url ?? '/'}`, { method: 'POST', headers, body }),
      )
    } else {
      next()
      return
    }
    res.statusCode = response.status
    res.setHeader('content-type', response.headers.get('content-type') ?? 'text/plain')
    res.end(await response.text())
  } catch (err) {
    if (err instanceof BodyTooLarge) reply(413, `Body exceeds ${maxBytes} bytes`)
    else reply(500, `redlining: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * Vite adapter: stamps `data-rl` on host JSX elements during `vite dev`.
 * Same transform as the Next.js loader; nothing runs in `vite build`.
 */
export function redlining(options: RedliningVitePluginOptions = {}): VitePluginLike {
  const include = (options.include ?? ['src']).map((d) => d.replace(/[/\\]+$/, ''))
  let root = options.projectRoot ?? process.cwd()
  return {
    name: 'redlining',
    enforce: 'pre',
    apply: 'serve',
    configResolved(config) {
      if (!options.projectRoot) root = config.root
    },
    configureServer(server) {
      if (!options.endpoint) return
      const url = options.endpoint === true ? '/api/redlining' : options.endpoint
      const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
      const handlers = createHandlers({
        projectRoot: root,
        outDir: options.outDir,
        maxBytes,
        enabled: true,
      })
      server.middlewares.use(
        url,
        (req, res, next) => void serveRedlining(handlers, req, res, next, maxBytes),
      )
    },
    transform(code, id) {
      const file = id.split('?')[0]!
      if (!/\.(tsx|jsx)$/.test(file) || file.includes('/node_modules/')) return null
      const rel = path.relative(root, file).split(path.sep).join('/')
      if (rel.startsWith('..') || !include.some((d) => rel === d || rel.startsWith(d + '/')))
        return null
      const out = transform(code, rel)
      return out.map ? { code: out.code, map: out.map } : null
    },
  }
}

export default redlining
