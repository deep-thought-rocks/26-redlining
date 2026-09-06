import type { Anchor } from '../types'
import { ownerChain } from './fiber'
import type { Layout } from './layout'
import { cssPath } from './selector'

const TEXT_MAX = 80

export interface RlLocation {
  file: string
  line: number
  column?: number
}

/** Parses a `data-rl` value, `<relpath>:<line>[:<col>]`. Paths may themselves contain ':'. */
export function parseRl(value: string): RlLocation | null {
  const m = /^(.*?):(\d+)(?::(\d+))?$/.exec(value)
  if (!m || !m[1]) return null
  return { file: m[1], line: Number(m[2]), column: m[3] === undefined ? undefined : Number(m[3]) }
}

/** Resolves `el` to an anchor along the PRD §8.5 ladder: exact → ancestor → selector-only. */
export function anchorFor(el: Element, layout: Layout): Anchor {
  const base = {
    tag: el.tagName.toLowerCase(),
    owners: ownerChain(el),
    selector: cssPath(el),
    text: textOf(el),
    rect: layout.rectOf(el),
  }
  const own = el.getAttribute('data-rl')
  const ownLoc = own ? parseRl(own) : null
  if (ownLoc) return { ...base, ...ownLoc, resolved: 'exact' }
  const ancestor = el.parentElement?.closest('[data-rl]') ?? null
  const ancestorLoc = ancestor ? parseRl(ancestor.getAttribute('data-rl')!) : null
  if (ancestorLoc) return { ...base, ...ancestorLoc, resolved: 'ancestor' }
  return { ...base, resolved: 'selector-only' }
}

function textOf(el: Element): string | undefined {
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return undefined
  return text.length > TEXT_MAX ? text.slice(0, TEXT_MAX - 1) + '…' : text
}
