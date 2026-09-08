// Component names above a host element, framework by framework: React's owner chain
// first, then Angular's dev-mode `ng` global, then Vue 3's internal instance. Every
// probe is feature-detected and degrades to `[]`.
import { ownerChain } from './fiber'

interface NgGlobal {
  getComponent?(el: Element): object | null
  getOwningComponent?(target: Element | object): object | null
}

interface VueInstance {
  type?: { name?: string; __name?: string }
  parent?: VueInstance | null
}

const MAX_DEPTH = 50

/** Angular (dev mode only): the component the element belongs to and its owners. */
export function angularOwners(el: Element): string[] {
  const ng = (el.ownerDocument.defaultView as (Window & { ng?: NgGlobal }) | null)?.ng
  if (!ng || typeof ng.getComponent !== 'function') return []
  const names: string[] = []
  try {
    let component: object | null = ng.getComponent(el) ?? ng.getOwningComponent?.(el) ?? null
    for (let i = 0; component && i < MAX_DEPTH; i++) {
      const name = component.constructor?.name
      if (name) names.push(name)
      component = ng.getOwningComponent?.(component) ?? null
    }
  } catch {
    return []
  }
  return names.reverse()
}

/** Vue 3: the internal instance chain hung on the element. */
export function vueOwners(el: Element): string[] {
  let instance = (el as Element & { __vueParentComponent?: VueInstance }).__vueParentComponent
  const names: string[] = []
  for (let i = 0; instance && i < MAX_DEPTH; i++) {
    const name = instance.type?.name ?? instance.type?.__name
    if (name) names.push(name)
    instance = instance.parent ?? undefined
  }
  return names.reverse()
}

/** Owners outermost first, from whichever framework rendered `el`; `[]` when none is detected. */
export function owners(el: Element): string[] {
  const react = ownerChain(el)
  if (react.length) return react
  const angular = angularOwners(el)
  if (angular.length) return angular
  return vueOwners(el)
}
