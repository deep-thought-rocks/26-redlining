// Save without an endpoint: the same files the route would write, handed to the
// browser as downloads (annotations.md, annotations.json, images).
import { assetFiles, toJson, toMarkdown, withAssetPaths } from '../export'
import type { Session } from '../types'

export interface ExportFile {
  name: string
  content: string | Blob
}

const DIR = '.redlining'

function blobOf(dataUrl: string): Blob | null {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl)
  if (!m) return null
  const bytes = Uint8Array.from(atob(m[2]!), (c) => c.charCodeAt(0))
  return new Blob([bytes], { type: m[1] })
}

/** Everything a save produces, named as the route would name it. */
export function exportFiles(session: Session): ExportFile[] {
  const filed = withAssetPaths(session, DIR)
  const files: ExportFile[] = [
    {
      name: 'annotations.md',
      content: toMarkdown(filed, { screenshotPath: `${DIR}/screenshot.png` }),
    },
    { name: 'annotations.json', content: toJson(filed) },
  ]
  const shot = session.screenshot ? blobOf(session.screenshot) : null
  if (shot) files.push({ name: 'screenshot.png', content: shot })
  const before = session.screenshotBefore ? blobOf(session.screenshotBefore) : null
  if (before) files.push({ name: 'screenshot-before.png', content: before })
  for (const asset of assetFiles(session)) {
    const blob = blobOf(asset.dataUrl)
    if (blob) files.push({ name: asset.name, content: blob })
  }
  return files
}

/** Triggers one download per file; browsers may ask once before allowing several. */
export function downloadFiles(files: ExportFile[], doc: Document = document): void {
  for (const f of files) {
    const blob =
      typeof f.content === 'string' ? new Blob([f.content], { type: 'text/plain' }) : f.content
    const url = URL.createObjectURL(blob)
    // Detached on purpose: the overlay's capture-phase click listeners on `document`
    // would otherwise cancel the anchor's default action (Chromium downloads either way).
    const a = doc.createElement('a')
    a.href = url
    a.download = f.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
