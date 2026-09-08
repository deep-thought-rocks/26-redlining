// Tweak previews per element. Several entries may target one element (two tweaks on the
// same button); they are applied together, in index order, from one snapshot.
import { findByAnchor } from './dom'
import { adoptSnapshot, apply, PREVIEW_ATTR, reset } from './preview'
import type { Entry } from './session'

/** Entries with changes, grouped by their (re-found) element, each group in index order. */
export function groupByElement(entries: Entry[]): Map<Element, Entry[]> {
  const groups = new Map<Element, Entry[]>()
  for (const e of [...entries].sort((a, b) => a.index - b.index)) {
    if (!e.changes?.length) continue
    const el = e.element?.isConnected ? e.element : findByAnchor(e.anchor)
    if (!el) continue
    if (e.preview) adoptSnapshot(el, e.preview)
    groups.set(el, [...(groups.get(el) ?? []), e])
  }
  return groups
}

/** Applies every group's concatenated changes; with `onlyMissing`, only where the preview is gone. */
export function applyPreviews(entries: Entry[], onlyMissing = false): void {
  for (const [el, group] of groupByElement(entries)) {
    if (onlyMissing && el.hasAttribute(PREVIEW_ATTR)) continue
    apply(
      el,
      group.flatMap((e) => e.changes ?? []),
    )
  }
}

/** Restores every previewed element to its snapshot. */
export function resetPreviews(entries: Entry[]): void {
  for (const el of groupByElement(entries).keys()) reset(el)
}

/** Drops one entry's preview and keeps the others on the same element. */
export function removePreview(entries: Entry[], id: string): void {
  const gone = entries.find((e) => e.id === id)
  if (!gone?.changes?.length) return
  resetPreviews([gone])
  applyPreviews(entries.filter((e) => e.id !== id))
}
