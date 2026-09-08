import { liveRect } from './Pins'
import type { Entry } from './session'

/** The route caps the body at 16 MB; the screenshot keeps to 7 MB so crops, references and JSON fit beside it. */
const MAX_DATA_URL = 7 * 1024 * 1024
const RADIUS = 11

export interface Pin {
  label: string
  x: number
  y: number
}

/** Pin positions in page coordinates for every anchor that is still attached. */
export function pinsFor(entries: Entry[]): Pin[] {
  const pins: Pin[] = []
  for (const entry of entries) {
    const r = liveRect(entry.element, entry.anchor)
    if (!r) continue
    pins.push({
      label: String(entry.index),
      x: r.x + (entry.box?.x ?? 0),
      y: r.y + (entry.box?.y ?? 0),
    })
    ;(entry.anchors ?? []).slice(1).forEach((a, i) => {
      const x = liveRect(entry.extraElements?.[i] ?? null, a)
      if (x) pins.push({ label: String(entry.index), x: x.x, y: x.y })
    })
    const t = entry.target ? liveRect(null, entry.target) : null
    if (t) pins.push({ label: `→${entry.index}`, x: t.x, y: t.y })
  }
  return pins
}

/** The subset of CanvasRenderingContext2D the pin painter uses; tests pass a recorder. */
export interface PinCanvas {
  beginPath(): void
  arc(x: number, y: number, r: number, start: number, end: number): void
  fill(): void
  stroke(): void
  fillText(text: string, x: number, y: number): void
  fillStyle: string | CanvasGradient | CanvasPattern
  strokeStyle: string | CanvasGradient | CanvasPattern
  lineWidth: number
  font: string
  textAlign: CanvasTextAlign
  textBaseline: CanvasTextBaseline
}

/** Burns numbered pins onto a rendered page, matching the overlay's pin style. */
export function drawPins(ctx: PinCanvas, pins: Pin[], scale = 1): void {
  ctx.font = `600 ${11 * scale}px "Space Grotesk", "Segoe UI", system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 2 * scale
  for (const pin of pins) {
    const x = pin.x * scale
    const y = pin.y * scale
    ctx.beginPath()
    ctx.arc(x, y, RADIUS * scale, 0, Math.PI * 2)
    ctx.fillStyle = '#9e2018' // the accent fill (brandCss, step 550)
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.fillText(pin.label, x, y + 0.5 * scale)
  }
}

/** Crops larger than this on either edge are skipped: the full screenshot already shows them. */
const MAX_CROP_EDGE = 1600
/** Total crop bytes per save, so screenshot (7 MB) + crops + references stay under the route's 16 MB. */
const MAX_CROP_BYTES = 4 * 1024 * 1024
const CROP_MARGIN = 16

/** The crop around `rect` with a margin, clamped to the page; null when it would be huge. */
export function cropRect(
  rect: { x: number; y: number; w: number; h: number },
  page: { w: number; h: number },
  margin = CROP_MARGIN,
): { x: number; y: number; w: number; h: number } | null {
  const x = Math.max(0, Math.floor(rect.x - margin))
  const y = Math.max(0, Math.floor(rect.y - margin))
  const w = Math.min(page.w, Math.ceil(rect.x + rect.w + margin)) - x
  const h = Math.min(page.h, Math.ceil(rect.y + rect.h + margin)) - y
  if (w <= 0 || h <= 0 || w > MAX_CROP_EDGE || h > MAX_CROP_EDGE) return null
  return { x, y, w, h }
}

/**
 * Captures the page (without the overlay) as a PNG data URL with pins burned
 * in, plus a pin-free crop around every attached anchor, keyed by annotation
 * index. Returns an error instead when the capture fails or would exceed the cap.
 */
export async function captureScreenshot(
  entries: Entry[],
  host: Element,
): Promise<{ dataUrl: string; crops: Record<string, string> } | { error: string }> {
  const { toCanvas } = await import('html-to-image')
  const canvas = await toCanvas(document.documentElement, {
    filter: (node) => node !== host,
    pixelRatio: 1,
    cacheBust: false,
  })
  const ctx = canvas.getContext('2d')
  if (!ctx) return { error: 'no 2d context' }
  const crops: Record<string, string> = {}
  let cropBytes = 0
  for (const entry of entries) {
    const r = liveRect(entry.element, entry.anchor)
    const c = r ? cropRect(r, { w: canvas.width, h: canvas.height }) : null
    if (!c) continue
    const part = document.createElement('canvas')
    part.width = c.w
    part.height = c.h
    part.getContext('2d')?.drawImage(canvas, c.x, c.y, c.w, c.h, 0, 0, c.w, c.h)
    const url = part.toDataURL('image/png')
    cropBytes += url.length
    if (cropBytes > MAX_CROP_BYTES) break
    crops[String(entry.index)] = url
  }
  drawPins(ctx, pinsFor(entries))
  const dataUrl = canvas.toDataURL('image/png')
  if (dataUrl.length > MAX_DATA_URL)
    return { error: `screenshot too large (${Math.round(dataUrl.length / 1024 / 1024)} MB)` }
  return { dataUrl, crops }
}
