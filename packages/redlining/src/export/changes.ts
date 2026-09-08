// Pure helpers over tweak-mode changes, shared by the export and the overlay panel.
import type { Change, ChangeSource } from '../types'

/** Human line for a change, e.g. "font-size: 14px → 16px (class text-sm → text-base)". */
export function describe(c: Change): string {
  if (c.kind === 'text') return `text: "${c.from}" → "${c.to}"`
  if (c.kind === 'nudge') {
    return `visual nudge: ${c.input ?? c.to} — previewed with a transform; implement as spacing or alignment, never ship a transform`
  }
  if (c.kind === 'visibility')
    return c.to === 'none' ? 'hide (display: none)' : `display: ${c.from} → ${c.to}`
  const s = c.source
  if (s?.kind === 'layout') {
    const px = c.from.replace(/px$/, '')
    return `${c.property}: auto (${px}px, laid out by the parent ${s.from}) → ${c.to}${c.relative ? ` (${c.relative})` : ''} — set by ${s.from === 'grid' ? "the parent's columns/gap" : s.from === 'flex' ? "its content and the parent's flex sizing" : "the parent's width"}, not by this element; prefer changing the layout`
  }
  const extras: string[] = []
  if (c.suggestion && s?.className && sameFamily(s.className, c.suggestion))
    extras.push(`class ${s.className} → ${c.suggestion}`)
  else {
    const origin = s ? describeSource(s) : ''
    if (origin) extras.push(origin)
    if (c.suggestion) extras.push(`add class ${c.suggestion}`)
  }
  if (c.relative) extras.push(c.relative)
  if (c.token && !extras.some((e) => e.includes(c.token!))) extras.push(`token ${c.token}`)
  return `${c.property}: ${c.from} → ${c.to}${extras.length ? ` (${extras.join('; ')})` : ''}`
}

/** `text-sm` and `text-lg` are one scale; `btn` and `pl-6` are not, so `pl-6` is added, not swapped. */
function sameFamily(a: string, b: string): boolean {
  return a.split('-')[0] === b.split('-')[0]
}

/** "from class text-lg", "from var(--lh) via .p", "inherited from <section> via .prose", "inline style". */
export function describeSource(s: ChangeSource): string {
  const via = s.className ? `class ${s.className}` : s.selector ? `\`${s.selector}\`` : ''
  switch (s.kind) {
    case 'inline':
      return s.token ? `inline style, var(${s.token})` : 'inline style'
    case 'rule':
      return s.token ? `from var(${s.token})${via ? ` via ${via}` : ''}` : via ? `from ${via}` : ''
    case 'inherited':
      return `inherited from <${s.from}>${via ? ` via ${via}` : ''}${s.token ? `, var(${s.token})` : ''}`
    case 'layout':
      return `laid out by the parent ${s.from}`
    default:
      return ''
  }
}

/** Short caption for the Inspector: "from .text-lg", "auto · from grid", "inherited from <section>". */
export function captionFor(s: ChangeSource): string {
  switch (s.kind) {
    case 'inline':
      return s.token ? `inline · var(${s.token})` : 'inline style'
    case 'rule':
      return s.token ? `var(${s.token}) · ${s.selector}` : `from ${s.selector}`
    case 'inherited':
      return `inherited from <${s.from}>${s.selector ? ` ${s.selector}` : ''}`
    case 'layout':
      return `auto · from ${s.from}`
    default:
      return ''
  }
}

/**
 * Collapses paired sides with identical from/to ("padding-left, padding-right: 12px → 16px")
 * and drops changes that ended where they started. Pure; used by the export and the panel.
 */
export function summarise(changes: Change[]): Change[] {
  const live = changes.filter((c) => c.from !== c.to || c.kind === 'nudge')
  const out: Change[] = []
  const used = new Set<number>()
  const PAIRS: [string, string][] = [
    ['left', 'right'],
    ['top', 'bottom'],
  ]
  live.forEach((c, i) => {
    if (used.has(i)) return
    if (c.kind === 'style') {
      for (const [a, b] of PAIRS) {
        if (!c.property.endsWith(`-${a}`)) continue
        const partner = c.property.slice(0, -a.length) + b
        const j = live.findIndex(
          (d, k) =>
            k > i &&
            !used.has(k) &&
            d.kind === 'style' &&
            d.property === partner &&
            d.from === c.from &&
            d.to === c.to,
        )
        if (j !== -1) {
          used.add(j)
          out.push({ ...c, property: `${c.property}, ${partner}` })
          used.add(i)
          return
        }
      }
    }
    used.add(i)
    out.push(c)
  })
  return out
}
