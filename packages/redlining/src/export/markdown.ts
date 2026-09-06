import type { Anchor, Annotation, Session } from '../types'

export interface MarkdownOptions {
  /** Timestamp for the header; defaults to now. */
  now?: Date
  /** Path written into the screenshot line when the session carries one. */
  screenshotPath?: string
}

const FOOTER =
  'Apply in order. Reuse existing components and design tokens. Do not touch anything not listed.'

/** Renders a session as the agent-readable spec from PRD §9.1. */
export function toMarkdown(session: Session, options: MarkdownOptions = {}): string {
  const now = options.now ?? new Date()
  const lines: string[] = []
  lines.push(
    `# Redlining — ${session.route}  (${stamp(now)} · viewport ${session.viewport.w}×${session.viewport.h})`,
  )
  lines.push('')
  if (session.screenshot) {
    lines.push(
      `Screenshot: ${options.screenshotPath ?? '.redlining/screenshot.png'} (pins numbered as below)`,
    )
    lines.push('')
  }
  const ordered = [...session.annotations].sort((a, b) => a.index - b.index)
  for (const a of ordered) {
    lines.push(...annotationBlock(a))
    lines.push('')
  }
  lines.push('---')
  lines.push(FOOTER)
  return lines.join('\n') + '\n'
}

function annotationBlock(a: Annotation): string[] {
  const out = [`## ${a.index} · ${a.action.toUpperCase()} — ${title(a)}`]
  switch (a.action) {
    case 'add':
      out.push(`- Container: ${location(a.anchor)}`)
      out.push(`- Position: ${position(a)}`)
      break
    case 'move':
      out.push(`- From: ${location(a.anchor)}`)
      if (a.target) out.push(`- To: ${a.target.position} ${location(a.target)}`)
      break
    default:
      if (a.anchors && a.anchors.length > 1) {
        out.push('- Anchors:')
        a.anchors.forEach((anchor, i) => out.push(`  ${i + 1}. ${location(anchor)}`))
      } else {
        out.push(`- Anchor: ${location(a.anchor)}`)
      }
  }
  if (a.anchor.text && a.action !== 'add') out.push(`- Text: "${a.anchor.text}"`)
  const fallback = fallbackNote(a.anchor)
  if (fallback) out.push(`- Resolved: ${fallback}`)
  out.push(`- Note: ${indent(a.note)}`)
  return out
}

function title(a: Annotation): string {
  const { anchor } = a
  const owner = anchor.owners[anchor.owners.length - 1]
  const more = a.anchors && a.anchors.length > 1 ? ` (+${a.anchors.length - 1})` : ''
  if (a.action === 'add') return owner ? `inside ${owner}` : `inside <${anchor.tag}>`
  if (a.action === 'remove' && anchor.text && anchor.text.length <= 40)
    return `"${anchor.text}" ${anchor.tag}${more}`
  return (owner ?? (anchor.text ? `"${anchor.text}" ${anchor.tag}` : `<${anchor.tag}>`)) + more
}

function location(anchor: Anchor): string {
  const parts = [`\`<${anchor.tag}>\``]
  if (anchor.file) parts.push(`${anchor.file}:${anchor.line}`)
  else parts.push('unresolved')
  if (anchor.owners.length) parts.push(`owners: ${anchor.owners.join(' › ')}`)
  return parts.join(' · ')
}

function fallbackNote(anchor: Anchor): string | null {
  if (anchor.resolved === 'ancestor') {
    return `nearest decorated ancestor; locate the child by selector \`${anchor.selector}\``
  }
  if (anchor.resolved === 'selector-only') {
    return `unresolved — locate by selector \`${anchor.selector}\`${anchor.text ? ' and text' : ''}`
  }
  return null
}

function position(a: Annotation): string {
  const box = a.box
  if (!box) return 'at end'
  const parts: string[] = []
  const n = a.anchor.rect
  if (box.childIndex === undefined) parts.push('at end')
  else if (box.childIndex === 0) parts.push('at start')
  else parts.push(`after child ${box.childIndex}`)
  parts.push(n.w > 0 && box.w >= n.w * 0.9 ? 'full width' : `≈ ${Math.round(box.w)} px wide`)
  parts.push(`≈ ${Math.round(box.h)} px tall`)
  return parts.join(' · ')
}

function indent(note: string): string {
  return note.trim().split('\n').join('\n  ')
}

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
