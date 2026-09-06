import { liveRect } from './Pins'
import type { Entry } from './session'

/** PRD §11: the route caps the body at 8 MB; leave headroom for the JSON around it. */
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
    ctx.fillStyle = '#02872d' // --sbm-green-550, the accent fill
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.fillText(pin.label, x, y + 0.5 * scale)
  }
}

/**
 * Captures the page (without the overlay) as a PNG data URL with pins burned
 * in. Returns an error instead when the capture fails or would exceed the cap.
 */
export async function captureScreenshot(
  entries: Entry[],
  host: Element,
): Promise<{ dataUrl: string } | { error: string }> {
  const { toCanvas } = await import('html-to-image')
  const canvas = await toCanvas(document.documentElement, {
    filter: (node) => node !== host,
    pixelRatio: 1,
    cacheBust: false,
  })
  const ctx = canvas.getContext('2d')
  if (!ctx) return { error: 'no 2d context' }
  drawPins(ctx, pinsFor(entries))
  const dataUrl = canvas.toDataURL('image/png')
  if (dataUrl.length > MAX_DATA_URL)
    return { error: `screenshot too large (${Math.round(dataUrl.length / 1024 / 1024)} MB)` }
  return { dataUrl }
}
