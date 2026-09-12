/** Fallback CSS path for `el`: an id short-circuits; otherwise tag + nth-of-type up to <body>. */
export function cssPath(el: Element): string {
  const parts: string[] = []
  let cur: Element | null = el
  const body = el.ownerDocument.body
  while (cur && cur !== body) {
    // Not a truthiness check: on a <form> with a field named "id", named access shadows the
    // property and `cur.id` is that <input>, not a string.
    if (typeof cur.id === 'string' && cur.id) {
      parts.unshift(idSelector(cur.id))
      break
    }
    const tag = cur.tagName.toLowerCase()
    const parent: Element | null = cur.parentElement
    const siblings = parent
      ? Array.from(parent.children).filter((c) => c.tagName === cur!.tagName)
      : []
    parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${siblings.indexOf(cur) + 1})` : tag)
    cur = parent
  }
  return parts.join(' > ')
}

function idSelector(id: string): string {
  return /^[A-Za-z_][\w-]*$/.test(id) ? `#${id}` : `[id="${id.replace(/"/g, '\\"')}"]`
}
