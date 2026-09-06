// The only file that touches React internals. Everything here is feature-detected
// and degrades to "no owners" when React changes the shape.

interface FiberLike {
  type?: unknown
  _debugOwner?: FiberLike | null
}

export function getFiber(el: Element): FiberLike | null {
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'))
  const fiber = key ? (el as unknown as Record<string, unknown>)[key] : null
  return fiber && typeof fiber === 'object' ? (fiber as FiberLike) : null
}

/** React owner chain for `el`, outermost first. `[]` when unavailable. */
export function ownerChain(el: Element): string[] {
  const names: string[] = []
  let owner = getFiber(el)?._debugOwner ?? null
  while (owner) {
    const name = componentName(owner.type)
    if (name) names.push(name)
    owner = owner._debugOwner ?? null
  }
  return names.reverse()
}

function componentName(type: unknown): string | null {
  if (typeof type === 'function') {
    const fn = type as { displayName?: string; name?: string }
    return fn.displayName || fn.name || null
  }
  if (type && typeof type === 'object') {
    // memo() and forwardRef() wrappers
    const wrapper = type as { displayName?: string; render?: unknown; type?: unknown }
    return wrapper.displayName || componentName(wrapper.render) || componentName(wrapper.type)
  }
  return null
}
