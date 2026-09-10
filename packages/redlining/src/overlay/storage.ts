import type { Annotation, Session } from '../types'
import type { Entry } from './session'

const PREFIX = 'redlining:'
const SETTINGS_KEY = 'redlining:settings'

export interface Settings {
  /** Styling idiom override; 'auto' follows the detection. */
  framework: 'auto' | 'tailwind4' | 'tailwind3' | 'css-modules' | 'css'
  /** Inspector steppers snap to the stylesheet's scale by default. */
  snap: boolean
  /** Save includes the other routes' sessions. */
  routes: boolean
  /** Ask npm once a day whether a newer version exists (no data is sent). */
  updates: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  framework: 'auto',
  snap: true,
  routes: true,
  updates: true,
}

export function loadSettings(storage: Storage): Settings {
  try {
    const raw = storage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    return { ...DEFAULT_SETTINGS, ...(parsed && typeof parsed === 'object' ? parsed : {}) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(storage: Storage, settings: Settings): void {
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // storage unavailable: the choice just does not persist
  }
}

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

/** Every other route with a saved session, as plain sessions (no elements, no screenshot). */
export function loadOtherSessions(
  storage: Storage,
  current: string,
  origin: string,
  viewport: { w: number; h: number },
): Session[] {
  const out: Session[] = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (!key || !key.startsWith(PREFIX)) continue
    const route = key.slice(PREFIX.length)
    if (!route.startsWith('/') || route === current) continue
    const annotations = loadEntries(storage, route).map(({ element: _e, ...a }) => a)
    if (annotations.length) out.push({ route, url: origin + route, viewport, annotations })
  }
  return out.sort((a, b) => a.route.localeCompare(b.route))
}

export function clearRoute(storage: Storage, route: string): void {
  storage.removeItem(storageKey(route))
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
