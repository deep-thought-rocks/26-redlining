// Where a computed value comes from: the winning declaration in the cascade, an
// inherited rule, a var() token, or nothing at all (laid out by the parent). DOM-only.
import type { ChangeSource } from '../types'

export type Provenance = ChangeSource

interface Candidate {
  selector: string
  value: string
  important: boolean
  layered: boolean
  specificity: number
  order: number
  sheet: number
}

const INHERITED = new Set([
  'font-size',
  'font-weight',
  'font-family',
  'line-height',
  'letter-spacing',
  'color',
  'text-align',
  'text-transform',
])
const STATE =
  /:(hover|focus(-visible|-within)?|active|visited|link|target|checked|disabled|enabled)\b/
const SHORTHAND: Record<string, string> = {
  'padding-top': 'padding',
  'padding-right': 'padding',
  'padding-bottom': 'padding',
  'padding-left': 'padding',
  'margin-top': 'margin',
  'margin-right': 'margin',
  'margin-bottom': 'margin',
  'margin-left': 'margin',
  'border-color': 'border',
  gap: 'gap',
}

/** Specificity as a single number: ids × 10000 + classes/attributes/pseudo-classes × 100 + elements. */
export function specificity(selector: string): number {
  let s = selector.replace(/::?[\w-]+\([^)]*\)/g, (m) => (m.startsWith('::') ? '::x' : ':x'))
  const pseudoElements = (s.match(/::[\w-]+/g) ?? []).length
  s = s.replace(/::[\w-]+/g, ' ')
  const ids = (s.match(/#[\w-]+/g) ?? []).length
  s = s.replace(/#[\w-]+/g, '')
  const classes = (s.match(/\.[\w-]+|\[[^\]]*\]|:[\w-]+/g) ?? []).length
  s = s.replace(/\.[\w-]+|\[[^\]]*\]|:[\w-]+/g, '')
  const elements = (s.match(/[a-zA-Z][\w-]*/g) ?? []).length + pseudoElements
  return ids * 10000 + classes * 100 + elements
}

function mediaMatches(doc: Document, condition: string): boolean {
  const view = doc.defaultView
  if (!view || typeof view.matchMedia !== 'function') return true
  try {
    return view.matchMedia(condition).matches
  } catch {
    return true
  }
}

/** Every style rule in the document's same-origin sheets, with sheet index, order and layer flag. */
export function* rules(
  doc: Document,
): Generator<{ rule: CSSStyleRule; sheet: number; order: number; layered: boolean }> {
  let order = 0
  const view = doc.defaultView
  if (!view) return
  const visit = function* (
    list: CSSRuleList,
    sheet: number,
    layered: boolean,
  ): Generator<{ rule: CSSStyleRule; sheet: number; order: number; layered: boolean }> {
    for (const rule of Array.from(list)) {
      if (rule instanceof view.CSSStyleRule) {
        yield { rule, sheet, order: order++, layered }
      } else if (rule instanceof view.CSSMediaRule) {
        if (mediaMatches(doc, rule.conditionText)) yield* visit(rule.cssRules, sheet, layered)
      } else if (
        typeof view.CSSSupportsRule === 'function' &&
        rule instanceof view.CSSSupportsRule
      ) {
        let ok: boolean
        try {
          ok = view.CSS?.supports?.(rule.conditionText) ?? true
        } catch {
          ok = true
        }
        if (ok) yield* visit(rule.cssRules, sheet, layered)
      } else if (rule instanceof view.CSSImportRule && rule.styleSheet) {
        try {
          yield* visit(rule.styleSheet.cssRules, sheet, layered)
        } catch {
          // cross-origin import
        }
      } else if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) {
        // @layer blocks and other grouping rules
        const isLayer =
          rule.constructor?.name === 'CSSLayerBlockRule' || /^@layer/.test(rule.cssText)
        yield* visit((rule as CSSGroupingRule).cssRules, sheet, layered || isLayer)
      }
    }
  }
  const sheets = Array.from(doc.styleSheets)
  for (let i = 0; i < sheets.length; i++) {
    let list: CSSRuleList
    try {
      list = sheets[i]!.cssRules
    } catch {
      continue // cross-origin stylesheet
    }
    yield* visit(list, i, false)
  }
}

function declared(
  style: CSSStyleDeclaration,
  property: string,
): { value: string; important: boolean } | null {
  let value = style.getPropertyValue(property)
  let prop = property
  if (!value && SHORTHAND[property]) {
    prop = SHORTHAND[property]!
    value = style.getPropertyValue(prop)
  }
  if (!value) return null
  return { value: value.trim(), important: style.getPropertyPriority(prop) === 'important' }
}

function candidates(el: Element, property: string): Candidate[] {
  const out: Candidate[] = []
  for (const { rule, sheet, order, layered } of rules(el.ownerDocument)) {
    const decl = declared(rule.style, property)
    if (!decl) continue
    for (const selector of rule.selectorText.split(',').map((s) => s.trim())) {
      if (!selector || STATE.test(selector)) continue
      let matches: boolean
      try {
        matches = el.matches(selector)
      } catch {
        matches = false
      }
      if (matches)
        out.push({ selector, ...decl, layered, specificity: specificity(selector), order, sheet })
    }
  }
  return out
}

function winner(list: Candidate[]): Candidate | null {
  if (list.length === 0) return null
  return list.reduce((best, c) => {
    if (c.important !== best.important) return c.important ? c : best
    if (c.layered !== best.layered) return c.layered ? best : c // unlayered beats layered
    if (c.specificity !== best.specificity) return c.specificity > best.specificity ? c : best
    return c.order >= best.order ? c : best
  })
}

function describeWinner(c: Candidate, extra: Partial<Provenance> = {}): Provenance {
  const single = /^\.([\w-]+)$/.exec(c.selector)
  const token = /var\((--[\w-]+)/.exec(c.value)?.[1]
  return {
    kind: 'rule',
    selector: c.selector,
    value: c.value,
    ...(single ? { className: single[1]! } : {}),
    ...(token ? { token } : {}),
    ...extra,
  }
}

/** Where `property`'s value on `el` comes from. */
export function provenance(el: Element, property: string): Provenance {
  const inline = (el as HTMLElement).style?.getPropertyValue(property)
  if (inline) {
    const token = /var\((--[\w-]+)/.exec(inline)?.[1]
    return { kind: 'inline', value: inline.trim(), ...(token ? { token } : {}) }
  }
  const own = winner(candidates(el, property))
  if (own) return describeWinner(own)
  if (INHERITED.has(property)) {
    let parent = el.parentElement
    while (parent) {
      const inlineParent = (parent as HTMLElement).style?.getPropertyValue(property)
      if (inlineParent)
        return { kind: 'inherited', from: parent.tagName.toLowerCase(), value: inlineParent.trim() }
      const w = winner(candidates(parent, property))
      if (w) return describeWinner(w, { kind: 'inherited', from: parent.tagName.toLowerCase() })
      parent = parent.parentElement
    }
    return { kind: 'default' }
  }
  if (property === 'width' || property === 'height') {
    const view = el.ownerDocument.defaultView
    const parentDisplay =
      el.parentElement && view ? view.getComputedStyle(el.parentElement).display : ''
    const ownDisplay = view ? view.getComputedStyle(el).display : ''
    const layout = /flex|grid/.test(parentDisplay)
      ? parentDisplay.replace('inline-', '')
      : ownDisplay === 'block' && property === 'width'
        ? 'block'
        : ''
    if (layout) return { kind: 'layout', from: layout }
  }
  return { kind: 'default' }
}

interface ClassCache {
  /** The sheet objects and their rule counts when the cache was built. */
  sheets: { sheet: CSSStyleSheet; rules: number }[]
  byProperty: Map<string, { className: string; value: string; sheet: number }[]>
}
const classCache = new WeakMap<Document, ClassCache>()

/** The document's sheets with their rule counts; a swapped (HMR) or grown sheet invalidates the cache. */
function sheetState(doc: Document): ClassCache['sheets'] {
  return Array.from(doc.styleSheets).map((sheet) => {
    try {
      return { sheet, rules: sheet.cssRules.length }
    } catch {
      return { sheet, rules: -1 }
    }
  })
}

function sameSheets(a: ClassCache['sheets'], b: ClassCache['sheets']): boolean {
  return (
    a.length === b.length && a.every((x, i) => x.sheet === b[i]!.sheet && x.rules === b[i]!.rules)
  )
}

/** Single-class rules that set `property`, across same-origin sheets, cached per document. */
function classRules(
  doc: Document,
  property: string,
): { className: string; value: string; sheet: number }[] {
  const sheets = sheetState(doc)
  let cache = classCache.get(doc)
  if (!cache || !sameSheets(cache.sheets, sheets)) {
    cache = { sheets, byProperty: new Map() }
    classCache.set(doc, cache)
  }
  const perDoc = cache.byProperty
  let list = perDoc.get(property)
  if (!list) {
    list = []
    for (const { rule, sheet } of rules(doc)) {
      const single = /^\.([\w-]+)$/.exec(rule.selectorText.trim())
      if (!single) continue
      const decl = declared(rule.style, property)
      if (decl) list.push({ className: single[1]!, value: decl.value, sheet })
    }
    perDoc.set(property, list)
  }
  return list
}

/**
 * The scale the stylesheet offers for `property`: every single-class rule's computed
 * pixel value in `el`'s context, ascending and deduplicated, e.g.
 * [{ className: 'text-sm', px: 14 }, { className: 'text-base', px: 16 }, …].
 */
export function scaleFor(el: Element, property: string): { className: string; px: number }[] {
  const doc = el.ownerDocument
  const view = doc.defaultView
  if (!view) return []
  const list = classRules(doc, property)
  if (list.length === 0) return []
  const probe = doc.createElement(el.tagName)
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;'
  ;(el.parentElement ?? doc.body).appendChild(probe)
  const out: { className: string; px: number }[] = []
  try {
    for (const c of list) {
      probe.style.setProperty(property, c.value)
      const px = parseFloat(view.getComputedStyle(probe).getPropertyValue(property))
      if (Number.isNaN(px) || out.some((o) => Math.abs(o.px - px) < 0.01)) continue
      out.push({ className: c.className, px })
    }
  } finally {
    probe.remove()
  }
  return out.sort((a, b) => a.px - b.px)
}

/**
 * A single-class rule whose `property` computes to `targetComputed` in `el`'s context,
 * e.g. "text-xl" for a 20px font size. Prefers the stylesheet of the current source.
 */
export function suggestClass(
  el: Element,
  property: string,
  targetComputed: string,
  source?: Provenance,
): string | undefined {
  const doc = el.ownerDocument
  const view = doc.defaultView
  if (!view) return undefined
  const list = classRules(doc, property)
  if (list.length === 0) return undefined
  const probe = doc.createElement(el.tagName)
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;'
  ;(el.parentElement ?? doc.body).appendChild(probe)
  try {
    const ranked = source?.selector
      ? [...list].sort(
          (a, b) =>
            Number(b.sheet === sheetOf(doc, source)) - Number(a.sheet === sheetOf(doc, source)),
        )
      : list
    for (const c of ranked) {
      if (source?.className === c.className) continue
      probe.style.setProperty(property, c.value)
      if (view.getComputedStyle(probe).getPropertyValue(property).trim() === targetComputed.trim())
        return c.className
    }
  } finally {
    probe.remove()
  }
  return undefined
}

function sheetOf(doc: Document, source: Provenance): number {
  for (const { rule, sheet } of rules(doc)) if (rule.selectorText === source.selector) return sheet
  return -1
}
