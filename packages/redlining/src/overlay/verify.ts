// After the agent's edit: does the page now show what each annotation asked for?
// Pure over an injected reader; the caller resets the preview around the check.
import type { Change } from '../types'
import { computed, soleTextNode, toRgb } from './preview'
import type { Entry } from './session'

export type VerdictState = 'applied' | 'differs' | 'missing' | 'manual'

export interface Verdict {
  state: VerdictState
  details: string[]
}

const TOLERANCE = 0.5

function same(property: string, actual: string, expected: string): boolean {
  const a = actual.trim()
  const e = expected.trim()
  if (a === e) return true
  const an = parseFloat(a)
  const en = parseFloat(e)
  if (!Number.isNaN(an) && !Number.isNaN(en) && /px$|^-?[\d.]+$/.test(e))
    return Math.abs(an - en) <= TOLERANCE
  if (/color/.test(property)) return toRgb(a) === toRgb(e)
  return false
}

/**
 * Checks `entry` against `el` as it is now (with any preview removed). A `remove`
 * whose element is gone counts as applied; note-only annotations are for the eye.
 */
export function verifyEntry(
  entry: Entry,
  el: Element | null,
  read: (el: Element, property: string) => string = computed,
): Verdict {
  if (!el) {
    return entry.action === 'remove'
      ? { state: 'applied', details: ['element is gone'] }
      : { state: 'missing', details: ['element not found — removed or restructured?'] }
  }
  const changes: Change[] = entry.changes ?? []
  if (changes.length === 0) {
    return {
      state: 'manual',
      details: [entry.action === 'remove' ? 'element is still present' : 'check by eye'],
    }
  }
  const details: string[] = []
  let differs = false
  let manual = false
  for (const c of changes) {
    switch (c.kind) {
      case 'style': {
        const actual = read(el, c.property)
        if (!same(c.property, actual, c.to)) {
          differs = true
          details.push(`${c.property} is ${actual.trim() || 'unset'}, expected ${c.to}`)
        }
        break
      }
      case 'text': {
        const actual = soleTextNode(el)?.data ?? ''
        if (actual !== c.to) {
          differs = true
          details.push(`text is "${actual}", expected "${c.to}"`)
        }
        break
      }
      case 'visibility': {
        const actual = read(el, 'display')
        if ((c.to === 'none') !== (actual === 'none')) {
          differs = true
          details.push(c.to === 'none' ? 'element is still visible' : 'element is hidden')
        }
        break
      }
      case 'nudge':
        manual = true
        details.push('visual nudge: check the spacing by eye')
        break
    }
  }
  if (differs) return { state: 'differs', details }
  if (manual && details.length === changes.length) return { state: 'manual', details }
  return { state: 'applied', details }
}
