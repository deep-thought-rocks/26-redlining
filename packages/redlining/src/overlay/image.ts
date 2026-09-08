// Reference images pasted into a note: picked from the clipboard, shrunk on a
// canvas, kept as data URLs. The size math is pure; the shrink needs a browser.

/** At most this many images per note … */
export const MAX_REFS = 3
/** … and this many bytes of image data per session (localStorage holds the session). */
export const MAX_REF_BYTES = 3 * 1024 * 1024
/** Longest edge after shrinking. */
export const MAX_EDGE = 1600

/** Scales (w, h) down to fit `max` on its longest edge; never scales up. */
export function fitWithin(w: number, h: number, max = MAX_EDGE): { w: number; h: number } {
  const longest = Math.max(w, h)
  if (longest <= max || longest === 0) return { w, h }
  const f = max / longest
  return { w: Math.max(1, Math.round(w * f)), h: Math.max(1, Math.round(h * f)) }
}

/** The image files in a paste or drop, in order. */
export function imageFiles(data: DataTransfer | null): File[] {
  if (!data) return []
  return Array.from(data.files).filter((f) => f.type.startsWith('image/'))
}

/** Bytes a data URL decodes to (base64 → 3/4), summed. */
export function dataUrlBytes(urls: string[]): number {
  return urls.reduce((n, u) => n + Math.floor((u.length - u.indexOf(',') - 1) * 0.75), 0)
}

/** Shrinks an image file to `MAX_EDGE` and returns a JPEG data URL (PNG when it has alpha is not detected; JPEG keeps mockups small). */
export async function shrinkImage(file: Blob, doc: Document = document): Promise<string> {
  const bitmap = await createImageBitmap(file)
  try {
    const { w, h } = fitWithin(bitmap.width, bitmap.height)
    const canvas = doc.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    ctx.drawImage(bitmap, 0, 0, w, h)
    return canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    bitmap.close()
  }
}
