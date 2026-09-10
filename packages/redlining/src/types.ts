// The annotation model from PRD §6, extended by usage-site context and tweak changes.
// Shared by resolve, export and the overlay.

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
  /** Component owners, outermost first (React owner chain; Angular or Vue names on those stacks); `[]` for server-only subtrees or plain pages. */
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
  /** The element's class list (≤ 20 entries): lets an agent map values to utility classes. */
  classes?: string[]
  /** Computed `display` at capture ('flex', 'grid', 'inline' …). */
  display?: string
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

/** One direct-manipulation delta, previewed in the browser and exported as a value change. */
export type ChangeKind = 'style' | 'text' | 'nudge' | 'visibility'

export interface Change {
  kind: ChangeKind
  /** CSS longhand in kebab-case for `style`; `text`, `transform` (a nudge, previewed on the `translate` property) or `display` otherwise. */
  property: string
  /** Computed value before the change, e.g. "14px" or "rgb(37, 99, 235)". */
  from: string
  /** Computed value after the change. */
  to: string
  /** What was typed or dragged, e.g. "16" or "+12,-4". */
  input?: string
  /** A `:root` custom property whose value equals `to`. */
  token?: string
  /** Relative form for sizes, e.g. "≈ 33 % of parent". */
  relative?: string
  /** Where the `from` value came from in the cascade. */
  source?: ChangeSource
  /** A class in the project's own stylesheet whose value equals `to`, e.g. "text-xl". */
  suggestion?: string
}

/** Provenance of a computed value: the winning declaration, an inherited rule, or the layout. */
export interface ChangeSource {
  kind: 'inline' | 'rule' | 'inherited' | 'layout' | 'default'
  /** Winning selector, e.g. ".text-lg" or ".report h3". */
  selector?: string
  /** The declaration as written: "1.125rem", "var(--text-lg)". */
  value?: string
  /** Single-class selector → the class name. */
  className?: string
  /** var() reference in the declaration. */
  token?: string
  /** inherited: the ancestor tag that carries the rule; layout: 'grid' | 'flex' | 'block'. */
  from?: string
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
  /** Tweak mode: direct-manipulation deltas on `anchor`'s element. */
  changes?: Change[]
  /** Viewport preset width (px) the annotation was made at, when one was active. */
  appliesAt?: number
  /** Reference images pasted into the note: data URLs in the browser, file paths once saved. */
  refs?: string[]
  note: string
  /** ISO timestamp. */
  createdAt: string
}

/** An annotation that left its session: the browser-side history. */
export interface ArchivedAnnotation extends Omit<Annotation, 'refs'> {
  route: string
  /** ISO timestamp. */
  archivedAt: string
  /** Archived by hand, or removed after a verify said the agent applied it. */
  reason: 'archived' | 'applied'
  verdict?: 'applied' | 'differs' | 'missing' | 'manual'
  /** The agent's reply line at the time, when there was one. */
  reply?: string
}

export interface Session {
  route: string
  url: string
  viewport: { w: number; h: number }
  annotations: Annotation[]
  /** Data URL, optional. */
  screenshot?: string
  /** Data URL of the page with previews reset, optional. */
  screenshotBefore?: string
  /** Viewport preset width (px) active at save time, when one was. */
  preset?: number
  /** The redlining package version that produced the export. */
  version?: string
  /** The styling idiom the export speaks in; detected from the page unless set by hand. */
  styling?: Styling
  /** Sessions of the other routes in this browser, exported together with this one. */
  others?: Session[]
  /** Per annotation index: a crop of the screenshot around the element (data URL, then path). */
  crops?: Record<string, string>
}

export interface Styling {
  kind: 'tailwind4' | 'tailwind3' | 'css-modules' | 'css'
  /** "Tailwind 4", "Plain CSS" … */
  label: string
  /** What the detection saw; absent when set by hand. */
  evidence?: string
  /** True when chosen in the settings or via the `framework` prop. */
  override: boolean
}
