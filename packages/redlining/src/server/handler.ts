import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { assetFiles, IMAGE_DATA_URL, toJson, toMarkdown, withAssetPaths } from '../export'
import type { Session } from '../types'
import { crossOrigin, parseSession } from './validate'

export interface RouteOptions {
  /** Directory the files are written to, relative to `projectRoot`. Default `.redlining`. */
  outDir?: string
  /** Defaults to `process.cwd()`. */
  projectRoot?: string
  /** Request body cap in bytes. Default 16 MB (screenshots, crops and reference images as data URLs). */
  maxBytes?: number
  /** Defaults to `NODE_ENV === 'development'`. */
  enabled?: boolean
}

const DEFAULT_MAX_BYTES = 16 * 1024 * 1024

/**
 * Builds the `POST` handler that writes `annotations.md`, `annotations.json`,
 * `screenshot.png`, reference images (`ref-<n>-<i>.*`) and crops (`crop-<n>.png`)
 * under `<projectRoot>/<outDir>/`. Refuses outside development and cross-origin
 * browser requests; validates the session; never writes outside `outDir`.
 */
export function createHandler(options: RouteOptions = {}) {
  return createHandlers(options).POST
}

/** `GET` reads the agent's `reply.md` for the overlay's verify step; `POST` writes the export. */
export function createHandlers(options: RouteOptions = {}) {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd())
  const outDirName = options.outDir ?? '.redlining'
  const outDir = path.resolve(projectRoot, outDirName)
  const rel = path.relative(projectRoot, outDir)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`redlining: outDir must be inside the project root, got ${outDirName}`)
  }
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  const relPosix = rel.split(path.sep).join('/')

  const isEnabled = () => options.enabled ?? process.env.NODE_ENV === 'development'
  /** A file inside outDir, or null when `name` would leave it. */
  const inside = (name: string): string | null => {
    if (!name || /[/\\]|\.\./.test(name)) return null
    const resolved = path.resolve(outDir, name)
    const r = path.relative(outDir, resolved)
    return !r || r.startsWith('..') || path.isAbsolute(r) ? null : resolved
  }

  async function GET(): Promise<Response> {
    if (!isEnabled()) return text(403, 'Redlining is disabled outside development')
    const file = path.join(outDir, 'reply.md')
    try {
      const [reply, info] = await Promise.all([readFile(file, 'utf8'), stat(file)])
      return Response.json({ reply, mtime: info.mtime.toISOString() })
    } catch {
      return Response.json({ reply: null, mtime: null })
    }
  }

  async function POST(request: Request): Promise<Response> {
    if (!isEnabled()) return text(403, 'Redlining is disabled outside development')
    const foreign = crossOrigin(request)
    if (foreign) return text(403, `Cross-origin save refused: ${foreign}`)

    const declared = Number(request.headers.get('content-length') ?? 0)
    if (declared > maxBytes) return text(413, `Body exceeds ${maxBytes} bytes`)
    const raw = await request.text()
    if (raw.length > maxBytes) return text(413, `Body exceeds ${maxBytes} bytes`)

    let body: { session?: unknown }
    try {
      body = JSON.parse(raw) as { session?: unknown }
    } catch {
      return text(400, 'Invalid JSON')
    }
    const parsed = parseSession(body.session)
    if ('error' in parsed) return text(400, parsed.error)
    const session: Session = parsed.session

    await mkdir(outDir, { recursive: true })
    // Stale images from the last save go first; the session decides what exists.
    for (const name of await readdir(outDir)) {
      const file = inside(name)
      if (file && /^(ref|crop)-/.test(name)) await rm(file, { force: true })
    }
    const files: string[] = []
    const screenshotPath = `${relPosix}/screenshot.png`
    const filed = withAssetPaths(session, relPosix)
    await writeFile(path.join(outDir, 'annotations.md'), toMarkdown(filed, { screenshotPath }))
    files.push(`${relPosix}/annotations.md`)
    await writeFile(path.join(outDir, 'annotations.json'), toJson(filed))
    files.push(`${relPosix}/annotations.json`)
    for (const asset of assetFiles(session)) {
      const bytes = decodeImage(asset.dataUrl)
      const file = inside(asset.name)
      if (!bytes || !file) return text(400, `Refusing asset name ${JSON.stringify(asset.name)}`)
      await writeFile(file, bytes)
      files.push(`${relPosix}/${asset.name}`)
    }
    const png = session.screenshot ? decodePng(session.screenshot) : null
    if (png) {
      await writeFile(path.join(outDir, 'screenshot.png'), png)
      files.push(screenshotPath)
    } else {
      await rm(path.join(outDir, 'screenshot.png'), { force: true })
    }
    const before = session.screenshotBefore ? decodePng(session.screenshotBefore) : null
    if (before) {
      await writeFile(path.join(outDir, 'screenshot-before.png'), before)
      files.push(`${relPosix}/screenshot-before.png`)
    } else {
      await rm(path.join(outDir, 'screenshot-before.png'), { force: true })
    }
    return Response.json({ files })
  }

  return { GET, POST }
}

/** Default handlers: `export { GET, POST } from 'redlining/next/route'`. */
export const { GET, POST } = createHandlers()

function decodeImage(dataUrl: string): Uint8Array | null {
  const m = IMAGE_DATA_URL.exec(dataUrl)
  return m ? Buffer.from(m[2]!, 'base64') : null
}

function decodePng(dataUrl: string): Uint8Array | null {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  return m ? Buffer.from(m[1]!, 'base64') : null
}

function text(status: number, body: string): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } })
}
