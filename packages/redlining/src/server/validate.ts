// Shape validation for a posted session. Nothing from the body reaches a file name or the
// filesystem before it passed here; every annotation index must be a positive integer.
import type { Action, Session } from '../types'

const ACTIONS: readonly Action[] = ['change', 'add', 'remove', 'move']

export type Parsed = { session: Session } | { error: string }

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object'
const isIndex = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0

/** Validates `value` as a Session; nested `others` are validated the same way (one level). */
export function parseSession(value: unknown, depth = 0): Parsed {
  if (!isObject(value)) return { error: 'Expected { session }' }
  const s = value
  if (typeof s.route !== 'string' || typeof s.url !== 'string')
    return { error: 'route and url must be strings' }
  if (!isObject(s.viewport) || typeof s.viewport.w !== 'number' || typeof s.viewport.h !== 'number')
    return { error: 'viewport must be { w, h }' }
  if (!Array.isArray(s.annotations)) return { error: 'annotations must be an array' }
  for (const [i, a] of s.annotations.entries()) {
    const where = `annotations[${i}]`
    if (!isObject(a)) return { error: `${where} must be an object` }
    if (typeof a.id !== 'string') return { error: `${where}.id must be a string` }
    if (!isIndex(a.index)) return { error: `${where}.index must be a positive integer` }
    if (!ACTIONS.includes(a.action as Action))
      return { error: `${where}.action is not one of ${ACTIONS.join(', ')}` }
    if (!isObject(a.anchor)) return { error: `${where}.anchor must be an object` }
    if (typeof a.note !== 'string') return { error: `${where}.note must be a string` }
    if (
      a.refs !== undefined &&
      !(Array.isArray(a.refs) && a.refs.every((r) => typeof r === 'string'))
    )
      return { error: `${where}.refs must be an array of strings` }
    if (a.changes !== undefined && !Array.isArray(a.changes))
      return { error: `${where}.changes must be an array` }
  }
  if (s.crops !== undefined) {
    if (!isObject(s.crops)) return { error: 'crops must be an object' }
    for (const [key, url] of Object.entries(s.crops)) {
      if (!/^[1-9]\d*$/.test(key)) return { error: `crops key "${key}" must be a positive integer` }
      if (typeof url !== 'string') return { error: `crops["${key}"] must be a string` }
    }
  }
  for (const field of ['screenshot', 'screenshotBefore'] as const) {
    if (s[field] !== undefined && typeof s[field] !== 'string')
      return { error: `${field} must be a string` }
  }
  if (s.others !== undefined) {
    if (depth > 0) return { error: 'others cannot nest' }
    if (!Array.isArray(s.others)) return { error: 'others must be an array' }
    for (const [i, other] of s.others.entries()) {
      const r = parseSession(other, depth + 1)
      if ('error' in r) return { error: `others[${i}]: ${r.error}` }
    }
  }
  return { session: s as unknown as Session }
}

/**
 * Same-origin check for browser requests: an `Origin` header must match the request's own
 * origin (loopback hosts count as the same host), and `Sec-Fetch-Site`, when present, must be
 * `same-origin` or `none`. Requests without either header (curl, tests) pass.
 */
export function crossOrigin(request: Request): string | null {
  const site = request.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'none') return `Sec-Fetch-Site is ${site}`
  const origin = request.headers.get('origin')
  if (!origin || origin === 'null') return origin === 'null' ? 'Origin is null' : null
  let own: URL
  let theirs: URL
  try {
    own = new URL(request.url)
    theirs = new URL(origin)
  } catch {
    return 'Origin is not a URL'
  }
  const host = (u: URL) =>
    ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname) ? 'loopback' : u.hostname
  const port = (u: URL) => u.port || (u.protocol === 'https:' ? '443' : '80')
  if (host(own) !== host(theirs) || port(own) !== port(theirs))
    return `Origin ${origin} is not this server`
  return null
}
