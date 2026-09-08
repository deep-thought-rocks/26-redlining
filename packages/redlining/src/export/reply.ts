// The agent's reply after a /redline run: `.redlining/reply.md`, one heading per annotation.
export type ReplyState = 'done' | 'partial' | 'skipped'

export interface ReplyLine {
  index: number
  state: ReplyState
  /** What the agent says it changed (heading text plus the lines under it). */
  text: string
  /** The `# /route` heading the line sits under, when the reply covers several routes. */
  route?: string
}

const ROUTE = /^#\s+(?:Redlining\s+[—-]+\s+)?(\/\S*)/
const LINE = /^##\s*(\d+)\s*[·\-–—:.]\s*(done|partial|skipped)\b\s*[—–\-:]?\s*(.*)$/i

/** Parses `## N · done | partial | skipped — text`; tolerant of dashes and case. */
export function parseReply(markdown: string): ReplyLine[] {
  const out: ReplyLine[] = []
  let route: string | undefined
  let current: ReplyLine | null = null
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim()
    const r = ROUTE.exec(line)
    if (r) {
      route = r[1]
      current = null
      continue
    }
    const m = LINE.exec(line)
    if (m) {
      current = {
        index: Number(m[1]),
        state: m[2]!.toLowerCase() as ReplyState,
        text: m[3]!.trim(),
        ...(route ? { route } : {}),
      }
      out.push(current)
      continue
    }
    if (line.startsWith('#')) {
      current = null
      continue
    }
    if (current && line) current.text = current.text ? `${current.text} ${line}` : line
  }
  return out
}
