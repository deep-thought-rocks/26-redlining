import type { Action, Anchor, Annotation, Change, Rect, Session } from '../types'
import type { Snapshot } from './preview'

export type Position = 'before' | 'after' | 'inside'

/** Overlay-side annotation with a live handle to the element it was created on. */
export interface Draft {
  kind: 'select' | 'draw' | 'move' | 'tweak'
  element: Element
  anchor: Anchor
  /** draw only: box in viewport px and the insert index */
  box?: Rect & { childIndex: number }
  /** move only: the destination */
  target?: { element: Element; anchor: Anchor }
  /** select only: further anchors added with Shift+click */
  extra?: { element: Element; anchor: Anchor }[]
  /** tweak: the previewed deltas and the element's pre-change state */
  changes?: Change[]
  snapshot?: Snapshot
}

export interface Entry extends Annotation {
  /** Live element, used to keep the pin attached across scroll and HMR. */
  element: Element | null
  /** Live elements for `anchors[1..]`, parallel to that slice. */
  extraElements?: (Element | null)[]
  /** The element's state before its tweak changes, for reset. */
  preview?: Snapshot
}

export type SessionAction =
  | { type: 'load'; entries: Entry[] }
  | {
      type: 'add'
      draft: Draft
      action: Action
      note: string
      id: string
      createdAt: string
      position?: Position
      appliesAt?: number
      /** Reference images pasted into the note. */
      refs?: string[]
    }
  | { type: 'note'; id: string; note: string }
  | { type: 'changes'; id: string; changes: Change[] }
  | { type: 'remove'; id: string }
  | { type: 'clear' }

export function reduce(entries: Entry[], a: SessionAction): Entry[] {
  switch (a.type) {
    case 'load':
      return reindex(a.entries)
    case 'add': {
      const { draft } = a
      const entry: Entry = {
        id: a.id,
        index: entries.length + 1,
        action: a.action,
        anchor: draft.anchor,
        note: a.note,
        createdAt: a.createdAt,
        element: draft.element,
      }
      if (draft.box) {
        const r = draft.anchor.rect
        entry.box = {
          x: draft.box.x - r.x,
          y: draft.box.y - r.y,
          w: draft.box.w,
          h: draft.box.h,
          childIndex: draft.box.childIndex,
        }
      }
      if (draft.target) entry.target = { ...draft.target.anchor, position: a.position ?? 'before' }
      if (draft.changes?.length) {
        entry.changes = draft.changes
        entry.preview = draft.snapshot
      }
      if (a.appliesAt) entry.appliesAt = a.appliesAt
      if (a.refs?.length) entry.refs = a.refs
      if (draft.extra?.length) {
        entry.anchors = [draft.anchor, ...draft.extra.map((x) => x.anchor)]
        entry.extraElements = draft.extra.map((x) => x.element)
      }
      return [...entries, entry]
    }
    case 'note':
      return entries.map((e) => (e.id === a.id ? { ...e, note: a.note } : e))
    case 'changes':
      return entries.map((e) => (e.id === a.id ? { ...e, changes: a.changes } : e))
    case 'remove':
      return reindex(entries.filter((e) => e.id !== a.id))
    case 'clear':
      return []
  }
}

function reindex(entries: Entry[]): Entry[] {
  return entries.map((e, i) => ({ ...e, index: i + 1 }))
}

/** Strips overlay-only fields and builds the exportable session. */
export function toSession(
  entries: Entry[],
  location: { pathname: string; href: string },
  viewport: { w: number; h: number },
): Session {
  return {
    route: location.pathname,
    url: location.href,
    viewport,
    annotations: entries.map(
      ({ element: _element, extraElements: _extra, preview: _preview, ...annotation }) =>
        annotation,
    ),
  }
}
