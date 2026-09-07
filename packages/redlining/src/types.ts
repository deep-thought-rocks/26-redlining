// The annotation model from PRD §6. Shared by resolve, export and the overlay.

export type Action = 'change' | 'add' | 'remove' | 'move'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** How precisely the anchor was located (PRD §8.5). */
export type Resolved = 'exact' | 'ancestor' | 'selector-only'

export interface Anchor {
  /** Project-relative path, e.g. `app/(app)/layout.tsx`. Absent when `selector-only`. */
  file?: string
  line?: number
  column?: number
  /** Host element: 'nav' | 'form' | 'button' … */
  tag: string
  /** React owner chain, outermost first; `[]` for server-only subtrees. */
  owners: string[]
  /** Fallback CSS path. */
  selector: string
  /** Trimmed textContent, at most 80 chars, for disambiguation. */
  text?: string
  /** Viewport px at capture time. */
  rect: Rect
  resolved: Resolved
  /**
   * Usage site: the nearest decorated ancestor in a *different* file, and the
   * position of this element's branch among its children. Tells instances of a
   * reusable component apart (three cards from card.tsx:33 on one page).
   */
  context?: AnchorContext
}

export interface AnchorContext {
  file: string
  line: number
  column?: number
  tag: string
  /** 1-based position among the ancestor's element children. */
  index: number
  count: number
}

export interface Annotation {
  id: string
  /** 1-based, stable order in the export. */
  index: number
  action: Action
  anchor: Anchor
  /** Multi-select: every anchor this note applies to, `anchor` first. Absent for a single anchor. */
  anchors?: Anchor[]
  /** `move` only. */
  target?: Anchor & { position: 'before' | 'after' | 'inside' }
  /** `add` only. Relative to `anchor.rect`; `childIndex` = insert before that child (children.length = at end). */
  box?: Rect & { childIndex?: number }
  note: string
  /** ISO timestamp. */
  createdAt: string
}

export interface Session {
  route: string
  url: string
  viewport: { w: number; h: number }
  annotations: Annotation[]
  /** Data URL, optional. */
  screenshot?: string
}
