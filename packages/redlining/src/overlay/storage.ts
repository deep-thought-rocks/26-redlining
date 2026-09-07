import type { Annotation } from '../types'
import type { Entry } from './session'

const PREFIX = 'redlining:'

export function storageKey(route: string): string {
  return PREFIX + route
}

/** Annotations persisted for `route`, without live element handles. */
export function loadEntries(storage: Storage, route: string): Entry[] {
  try {
    const raw = storage.getItem(storageKey(route))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return (parsed as Annotation[]).filter(isAnnotation).map((a) => ({ ...a, element: null }))
  } catch {
    return []
  }
}

export function saveEntries(storage: Storage, route: string, entries: Entry[]): void {
  const key = storageKey(route)
  if (entries.length === 0) {
    storage.removeItem(key)
    return
  }
  const plain = entries.map(
    ({ element: _element, extraElements: _extra, preview: _preview, ...a }) => a,
  )
  storage.setItem(key, JSON.stringify(plain))
}

function isAnnotation(value: unknown): value is Annotation {
  const a = value as Annotation | null
  return (
    !!a &&
    typeof a === 'object' &&
    typeof a.id === 'string' &&
    typeof a.index === 'number' &&
    !!a.anchor &&
    typeof a.note === 'string'
  )
}
