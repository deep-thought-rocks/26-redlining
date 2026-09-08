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
}

/** The slice of Node's request/response the middleware touches. */
export interface NodeRequestLike {
  method?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
  on(event: 'data', listener: (chunk: Buffer | string) => void): unknown
  on(event: 'end', listener: () => void): unknown
  on(event: 'error', listener: (err: Error) => void): unknown
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

function readBody(req: NodeRequestLike): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(typeof c === 'string' ? Buffer.from(c) : c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/** Adapts a connect request to the Fetch handlers and writes the Response back. */
export async function serveRedlining(
  handlers: ReturnType<typeof createHandlers>,
  req: NodeRequestLike,
  res: NodeResponseLike,
  next: () => void,
): Promise<void> {
  const method = (req.method ?? 'GET').toUpperCase()
  let response: Response
  if (method === 'GET') response = await handlers.GET()
  else if (method === 'POST') {
    const headers = new Headers()
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string') headers.set(k, v)
    }
    const body = await readBody(req)
    response = await handlers.POST(
      new Request(`http://localhost${req.url ?? '/'}`, { method: 'POST', headers, body }),
    )
  } else {
    next()
    return
  }
  res.statusCode = response.status
  res.setHeader('content-type', response.headers.get('content-type') ?? 'text/plain')
  res.end(await response.text())
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
      const handlers = createHandlers({ projectRoot: root, outDir: options.outDir, enabled: true })
      server.middlewares.use(url, (req, res, next) => void serveRedlining(handlers, req, res, next))
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
