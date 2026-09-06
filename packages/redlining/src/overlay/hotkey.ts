/**
 * Parses "Alt+R" / "Ctrl+Shift+K" and matches a KeyboardEvent against it.
 * Letters are matched on `code` (KeyR), because Option+letter on macOS
 * changes `key` to a typed symbol ("®" for Alt+R).
 */
export function matchesHotkey(e: KeyboardEvent, hotkey: string): boolean {
  const parts = hotkey
    .toLowerCase()
    .split('+')
    .map((p) => p.trim())
  const key = parts[parts.length - 1]!
  const want = {
    alt: parts.includes('alt'),
    ctrl: parts.includes('ctrl'),
    meta: parts.includes('meta') || parts.includes('cmd'),
    shift: parts.includes('shift'),
  }
  const keyMatches = /^[a-z]$/.test(key)
    ? e.code === `Key${key.toUpperCase()}` || e.key.toLowerCase() === key
    : e.key.toLowerCase() === key
  return (
    keyMatches &&
    e.altKey === want.alt &&
    e.ctrlKey === want.ctrl &&
    e.metaKey === want.meta &&
    e.shiftKey === want.shift
  )
}

export function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || typeof el.closest !== 'function') return false
  return !!el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')
}
