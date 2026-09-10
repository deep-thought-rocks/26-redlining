// Update check: asks the npm registry for the latest published version, once a day, and
// only outside automation. The request carries no data; the setting turns it off.
import { VERSION } from '../version'

const REGISTRY = 'https://registry.npmjs.org/redlining/latest'
const CACHE_KEY = 'redlining:latest'
const SEEN_KEY = 'redlining:update-seen'
const DAY = 24 * 60 * 60 * 1000

/** True when `a` is a newer semver than `b` (numeric parts only; "dev" is never newer). */
export function isNewer(a: string, b: string): boolean {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  if (pa.some(Number.isNaN) || pb.some(Number.isNaN)) return false
  for (let i = 0; i < 3; i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x !== y) return x > y
  }
  return false
}

/** The latest version on npm, cached for a day; null when offline, blocked or automated. */
export async function fetchLatest(
  storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage,
  now = Date.now(),
): Promise<string | null> {
  if (typeof navigator !== 'undefined' && navigator.webdriver) return null
  try {
    const cached = storage?.getItem(CACHE_KEY)
    if (cached) {
      const { version, at } = JSON.parse(cached) as { version: string; at: number }
      if (now - at < DAY) return version
    }
  } catch {
    // unreadable cache: ask again
  }
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(REGISTRY, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const { version } = (await res.json()) as { version?: string }
    if (typeof version !== 'string') return null
    storage?.setItem(CACHE_KEY, JSON.stringify({ version, at: now }))
    return version
  } catch {
    return null
  }
}

/** Whether the toast for `latest` was already shown in this browser. */
export function updateSeen(storage: Storage, latest: string): boolean {
  return storage.getItem(SEEN_KEY) === latest
}
export function markUpdateSeen(storage: Storage, latest: string): void {
  storage.setItem(SEEN_KEY, latest)
}

/** "0.6.5 is available" or null when up to date / unknown. */
export function updateNotice(latest: string | null): string | null {
  return latest && isNewer(latest, VERSION) ? `${latest} is available` : null
}
