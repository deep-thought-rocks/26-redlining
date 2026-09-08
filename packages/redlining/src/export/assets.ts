// Reference images and crops travel as data URLs and are written as files by the route.
import type { Session } from '../types'

export const IMAGE_DATA_URL = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/

/** File extension for an image data URL, or null when it is not one. */
export function imageExt(dataUrl: string): 'png' | 'jpg' | 'webp' | null {
  const m = IMAGE_DATA_URL.exec(dataUrl)
  if (!m) return null
  return m[1] === 'png' ? 'png' : m[1] === 'webp' ? 'webp' : 'jpg'
}

/** File name for annotation `index`'s n-th reference image (1-based). */
export function refName(index: number, n: number, dataUrl: string): string {
  return `ref-${index}-${n}.${imageExt(dataUrl) ?? 'png'}`
}

export function cropName(index: number): string {
  return `crop-${index}.png`
}

/** Every image the session carries, with the file each should become. */
export function assetFiles(session: Session): { name: string; dataUrl: string }[] {
  const out: { name: string; dataUrl: string }[] = []
  const collect = (s: Session) => {
    for (const a of s.annotations) {
      ;(a.refs ?? []).forEach((r, i) => {
        if (r.startsWith('data:')) out.push({ name: refName(a.index, i + 1, r), dataUrl: r })
      })
    }
    for (const [index, url] of Object.entries(s.crops ?? {})) {
      if (url.startsWith('data:')) out.push({ name: cropName(Number(index)), dataUrl: url })
    }
  }
  collect(session)
  return out
}

/**
 * The session with every image data URL replaced by its file path under `dir`,
 * so the Markdown and JSON name files rather than carrying megabytes.
 */
export function withAssetPaths(session: Session, dir: string): Session {
  const { crops: rawCrops, ...rest } = session
  const annotations = session.annotations.map((a) =>
    a.refs?.length
      ? {
          ...a,
          refs: a.refs.map((r, i) =>
            r.startsWith('data:') ? `${dir}/${refName(a.index, i + 1, r)}` : r,
          ),
        }
      : a,
  )
  const crops = rawCrops
    ? Object.fromEntries(
        Object.entries(rawCrops).map(([index, url]) => [
          index,
          url.startsWith('data:') ? `${dir}/${cropName(Number(index))}` : url,
        ]),
      )
    : undefined
  return { ...rest, annotations, ...(crops ? { crops } : {}) }
}
