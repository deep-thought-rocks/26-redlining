// The archive: annotations that left a session, kept in the browser as a history.
// Nothing is deleted from a session any more; the archive is where deletion happens.
import type { Annotation, ArchivedAnnotation } from '../types'
import type { Entry } from './session'

export const ARCHIVE_KEY = 'redlining:archive'
/** Newest first; the oldest fall off past these caps. */
export const MAX_ITEMS = 300
export const MAX_BYTES = 1.5 * 1024 * 1024

export function loadArchive(storage: Storage): ArchivedAnnotation[] {
  try {
    const raw = storage.getItem(ARCHIVE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as ArchivedAnnotation[]).filter(isArchived) : []
  } catch {
    return []
  }
}

function isArchived(v: unknown): v is ArchivedAnnotation {
  const a = v as ArchivedAnnotation | null
  return (
    !!a &&
    typeof a === 'object' &&
    typeof a.id === 'string' &&
    typeof a.route === 'string' &&
    typeof a.archivedAt === 'string' &&
    !!a.anchor
  )
}

function save(storage: Storage, items: ArchivedAnnotation[]): ArchivedAnnotation[] {
  let kept = items.slice(0, MAX_ITEMS)
  let json = JSON.stringify(kept)
  while (kept.length > 1 && json.length > MAX_BYTES) {
    kept = kept.slice(0, -1)
    json = JSON.stringify(kept)
  }
  if (kept.length === 0) storage.removeItem(ARCHIVE_KEY)
  else storage.setItem(ARCHIVE_KEY, json)
  return kept
}

export interface ArchiveExtra {
  verdict?: ArchivedAnnotation['verdict']
  reply?: string
}

/**
 * Moves `entries` to the front of the archive, stripped of live handles, previews and
 * reference images. Returns the archive as stored.
 */
export function archiveEntries(
  storage: Storage,
  route: string,
  entries: Entry[],
  reason: ArchivedAnnotation['reason'],
  extra: (e: Entry) => ArchiveExtra = () => ({}),
  now = new Date(),
): ArchivedAnnotation[] {
  const archivedAt = now.toISOString()
  const fresh = entries.map((e) => {
    const annotation: Partial<Entry> = { ...e }
    delete annotation.element
    delete annotation.extraElements
    delete annotation.preview
    delete annotation.refs
    const { verdict, reply } = extra(e)
    return {
      ...(annotation as Annotation),
      route,
      archivedAt,
      reason,
      ...(verdict ? { verdict } : {}),
      ...(reply ? { reply } : {}),
    }
  })
  const rest = loadArchive(storage).filter((a) => !fresh.some((f) => f.id === a.id))
  return save(storage, [...fresh, ...rest])
}

export function deleteArchived(storage: Storage, ids: string[]): ArchivedAnnotation[] {
  return save(
    storage,
    loadArchive(storage).filter((a) => !ids.includes(a.id)),
  )
}

export function clearArchive(storage: Storage): void {
  storage.removeItem(ARCHIVE_KEY)
}

/** An item goes back only into the session of its own route. */
export function restorable(item: ArchivedAnnotation, route: string): boolean {
  return item.route === route
}

/** The archived item as a plain annotation, ready for the session reducer. */
export function toAnnotation(item: ArchivedAnnotation): Annotation {
  const copy: Partial<ArchivedAnnotation> = { ...item }
  delete copy.route
  delete copy.archivedAt
  delete copy.reason
  delete copy.verdict
  delete copy.reply
  return copy as Annotation
}
