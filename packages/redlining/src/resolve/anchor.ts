import type { Anchor, AnchorContext } from '../types'
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
  const classes = Array.from(el.classList).slice(0, 20)
  const view = el.ownerDocument.defaultView
  const display = view ? view.getComputedStyle(el).display || undefined : undefined
  const base = {
    tag: el.tagName.toLowerCase(),
    owners: ownerChain(el),
    selector: cssPath(el),
    text: textOf(el),
    rect: layout.rectOf(el),
    ...(classes.length ? { classes } : {}),
    ...(display ? { display } : {}),
  }
  const own = el.getAttribute('data-rl')
  const ownLoc = own ? parseRl(own) : null
  if (ownLoc) return withContext({ ...base, ...ownLoc, resolved: 'exact' }, el)
  const ancestor = el.parentElement?.closest('[data-rl]') ?? null
  const ancestorLoc = ancestor ? parseRl(ancestor.getAttribute('data-rl')!) : null
  if (ancestorLoc) return withContext({ ...base, ...ancestorLoc, resolved: 'ancestor' }, el)
  return { ...base, resolved: 'selector-only' }
}

function withContext(anchor: Anchor, el: Element): Anchor {
  const context = contextFor(el, anchor.file!)
  return context ? { ...anchor, context } : anchor
}

/** The nearest decorated ancestor from another file, with this branch's index among its children. */
export function contextFor(el: Element, file: string): AnchorContext | undefined {
  let child: Element = el
  let parent = el.parentElement
  while (parent) {
    const rl = parent.getAttribute('data-rl')
    const loc = rl ? parseRl(rl) : null
    if (loc && loc.file !== file) {
      const children = Array.from(parent.children)
      return {
        ...loc,
        tag: parent.tagName.toLowerCase(),
        index: children.indexOf(child) + 1,
        count: children.length,
      }
    }
    child = parent
    parent = parent.parentElement
  }
  return undefined
}

function textOf(el: Element): string | undefined {
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return undefined
  return text.length > TEXT_MAX ? text.slice(0, TEXT_MAX - 1) + '…' : text
}
