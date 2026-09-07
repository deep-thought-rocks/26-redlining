// Pure helpers over tweak-mode changes, shared by the export and the overlay panel.
import type { Change } from '../types'

/** Human line for a change, e.g. "font-size: 14px → 16px (token --text-lg)". */
export function describe(c: Change): string {
  if (c.kind === 'text') return `text: "${c.from}" → "${c.to}"`
  if (c.kind === 'nudge') {
    return `visual nudge: ${c.input ?? c.to} — previewed with a transform; implement as spacing or alignment, never ship a transform`
  }
  if (c.kind === 'visibility')
    return c.to === 'none' ? 'hide (display: none)' : `display: ${c.from} → ${c.to}`
  const extras = [c.relative, c.token ? `token ${c.token}` : undefined].filter(Boolean)
  return `${c.property}: ${c.from} → ${c.to}${extras.length ? ` (${extras.join(', ')})` : ''}`
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
