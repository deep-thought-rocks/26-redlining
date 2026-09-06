import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { toJson, toMarkdown } from '../export'
import type { Session } from '../types'

export interface RouteOptions {
  /** Directory the files are written to, relative to `projectRoot`. Default `.redlining`. */
  outDir?: string
  /** Defaults to `process.cwd()`. */
  projectRoot?: string
  /** Request body cap in bytes. Default 8 MB (a screenshot data URL). */
  maxBytes?: number
  /** Defaults to `NODE_ENV === 'development'`. */
  enabled?: boolean
}

const DEFAULT_MAX_BYTES = 8 * 1024 * 1024

/**
 * Builds the `POST` handler that writes `annotations.md`, `annotations.json`
 * and `screenshot.png` under `<projectRoot>/<outDir>/`. Refuses outside
 * development; never writes outside `outDir`.
 */
export function createHandler(options: RouteOptions = {}) {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd())
  const outDirName = options.outDir ?? '.redlining'
  const outDir = path.resolve(projectRoot, outDirName)
  const rel = path.relative(projectRoot, outDir)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`redlining: outDir must be inside the project root, got ${outDirName}`)
  }
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  const relPosix = rel.split(path.sep).join('/')

  return async function POST(request: Request): Promise<Response> {
    const enabled = options.enabled ?? process.env.NODE_ENV === 'development'
    if (!enabled) return text(403, 'Redlining is disabled outside development')

    const declared = Number(request.headers.get('content-length') ?? 0)
    if (declared > maxBytes) return text(413, `Body exceeds ${maxBytes} bytes`)
    const raw = await request.text()
    if (raw.length > maxBytes) return text(413, `Body exceeds ${maxBytes} bytes`)

    let session: Session
    try {
      const body = JSON.parse(raw) as { session?: unknown }
      if (!isSession(body.session)) return text(400, 'Expected { session }')
      session = body.session
    } catch {
      return text(400, 'Invalid JSON')
    }

    await mkdir(outDir, { recursive: true })
    const files: string[] = []
    const screenshotPath = `${relPosix}/screenshot.png`
    await writeFile(path.join(outDir, 'annotations.md'), toMarkdown(session, { screenshotPath }))
    files.push(`${relPosix}/annotations.md`)
    await writeFile(path.join(outDir, 'annotations.json'), toJson(session))
    files.push(`${relPosix}/annotations.json`)
    const png = session.screenshot ? decodePng(session.screenshot) : null
    if (png) {
      await writeFile(path.join(outDir, 'screenshot.png'), png)
      files.push(screenshotPath)
    } else {
      await rm(path.join(outDir, 'screenshot.png'), { force: true })
    }
    return Response.json({ files })
  }
}

/** Default handler: `export { POST } from 'redlining/next/route'`. */
export const POST = createHandler()

function isSession(value: unknown): value is Session {
  const s = value as Session | null
  return (
    !!s &&
    typeof s === 'object' &&
    typeof s.route === 'string' &&
    typeof s.url === 'string' &&
    Array.isArray(s.annotations) &&
    !!s.viewport
  )
}

function decodePng(dataUrl: string): Uint8Array | null {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  return m ? Buffer.from(m[1]!, 'base64') : null
}

function text(status: number, body: string): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } })
}
