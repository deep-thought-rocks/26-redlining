// Live-preview engine for tweak mode. A preview is a disposable inline-style /
// DOM change on the host page; the exported spec records computed before → after
// values. Everything here is idempotent: `apply` always starts from the snapshot.
import type { Change } from '../types'

/** The element's own state before the first change. */
export interface Snapshot {
  cssText: string
  text: string | null
}

/** Marks elements we styled, so mutation observers can ignore our own writes. */
export const PREVIEW_ATTR = 'data-rl-preview'

const snapshots = new WeakMap<Element, Snapshot>()

/** Takes (once) and returns the element's snapshot. */
export function snapshot(el: Element): Snapshot {
  let s = snapshots.get(el)
  if (!s) {
    s = { cssText: (el as HTMLElement).style?.cssText ?? '', text: soleTextNode(el)?.data ?? null }
    snapshots.set(el, s)
  }
  return s
}

/** Registers a snapshot taken elsewhere (e.g. restored from a session) for `el`. */
export function adoptSnapshot(el: Element, s: Snapshot): void {
  if (!snapshots.has(el)) snapshots.set(el, s)
}

/** Restores the element to its snapshot. */
export function reset(el: Element): void {
  const s = snapshots.get(el)
  if (!s) return
  const html = el as HTMLElement
  html.style.cssText = s.cssText
  const node = soleTextNode(el)
  if (node && s.text !== null) node.data = s.text
  el.removeAttribute(PREVIEW_ATTR)
}

/** Resets, then applies every change in order. */
export function apply(el: Element, changes: Change[]): void {
  snapshot(el)
  reset(el)
  if (changes.length === 0) return
  const html = el as HTMLElement
  for (const c of changes) {
    switch (c.kind) {
      case 'style':
        html.style.setProperty(c.property, c.to)
        break
      case 'text': {
        const node = soleTextNode(el)
        if (node) node.data = c.to
        break
      }
      case 'nudge':
        html.style.setProperty('transform', c.to)
        break
      case 'visibility':
        html.style.setProperty('display', c.to)
        break
    }
  }
  el.setAttribute(PREVIEW_ATTR, '')
}

/** Computed value of a CSS property, as the browser reports it. */
export function computed(el: Element, property: string): string {
  const view = el.ownerDocument.defaultView
  return view ? view.getComputedStyle(el).getPropertyValue(property) : ''
}

/** The single non-empty text node of `el`, when its text is editable in place. */
export function soleTextNode(el: Element): Text | null {
  const texts = Array.from(el.childNodes).filter(
    (n): n is Text => n.nodeType === 3 && (n as Text).data.trim() !== '',
  )
  return texts.length === 1 ? texts[0]! : null
}

/** Text can be edited when there is exactly one text node and React does not control the element. */
export function canEditText(el: Element): boolean {
  if (!soleTextNode(el)) return false
  if (/^(input|textarea|select|option)$/i.test(el.tagName)) return false
  const propsKey = Object.keys(el).find((k) => k.startsWith('__reactProps$'))
  const props = propsKey
    ? ((el as unknown as Record<string, Record<string, unknown>>)[propsKey] ?? {})
    : {}
  return !('onChange' in props) && !('value' in props)
}

/** Width/height on an inline element is a no-op; the preview switches it to inline-block first. */
export function isInline(el: Element): boolean {
  return computed(el, 'display') === 'inline'
}

/** "≈ 33 % of parent" for a size against the parent's content box, or undefined. */
export function relativeTo(
  el: Element,
  property: 'width' | 'height',
  px: number,
): string | undefined {
  const parent = el.parentElement
  if (!parent) return undefined
  const total = parseFloat(computed(parent, property)) || 0
  if (total <= 0) return undefined
  return `≈ ${Math.round((px / total) * 100)} % of parent`
}

let tokenCache: Map<string, string> | null = null

/**
 * The first `:root` custom property whose value equals `value`, e.g. "--accent"
 * for "rgb(37, 99, 235)". Scanned once per page; values are normalised through
 * a probe element so "#2563eb" and "rgb(37, 99, 235)" compare equal.
 */
export function tokenFor(value: string, doc: Document = document): string | undefined {
  if (!tokenCache) tokenCache = scanTokens(doc)
  return tokenCache.get(value.trim())
}

export function resetTokenCache(): void {
  tokenCache = null
}

/** Every :root token whose value is a colour, as [name, normalised rgb()] pairs, once per page. */
export function colorTokens(doc: Document = document): { name: string; value: string }[] {
  if (!tokenCache) tokenCache = scanTokens(doc)
  // Both the raw text and the probe-normalised form are keyed; prefer the canonical rgb(r, g, b).
  const byName = new Map<string, string>()
  for (const [value, name] of tokenCache) {
    if (!value.startsWith('rgb')) continue
    const canonical = /^rgb\(\d+, \d+, \d+\)$/.test(value)
    if (!byName.has(name) || canonical) byName.set(name, value)
  }
  return Array.from(byName, ([name, value]) => ({ name, value }))
}

/** "rgb(37, 99, 235)" → "#2563eb", for <input type=color>; other forms pass through as #000000. */
export function toHex(color: string): string {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color)
  if (!m) return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : '#000000'
  return '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')
}

/** "#2563eb" → "rgb(37, 99, 235)", the form computed styles use. */
export function toRgb(hex: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!m) return hex
  return `rgb(${parseInt(m[1]!, 16)}, ${parseInt(m[2]!, 16)}, ${parseInt(m[3]!, 16)})`
}

function scanTokens(doc: Document): Map<string, string> {
  const map = new Map<string, string>()
  const view = doc.defaultView
  if (!view) return map
  const names = new Set<string>()
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue // cross-origin stylesheet
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof view.CSSStyleRule) || !/(^|,)\s*:root\s*(,|$)/.test(rule.selectorText))
        continue
      for (const name of Array.from(rule.style)) if (name.startsWith('--')) names.add(name)
    }
  }
  const root = view.getComputedStyle(doc.documentElement)
  const probe = doc.createElement('span')
  doc.body.appendChild(probe)
  for (const name of names) {
    const raw = root.getPropertyValue(name).trim()
    if (!raw) continue
    if (!map.has(raw)) map.set(raw, name)
    // Colours: normalise through the probe so hex and rgb() forms match.
    probe.style.color = ''
    probe.style.color = raw
    if (probe.style.color) {
      const normalised = view.getComputedStyle(probe).color
      if (normalised && !map.has(normalised)) map.set(normalised, name)
    }
  }
  probe.remove()
  return map
}
