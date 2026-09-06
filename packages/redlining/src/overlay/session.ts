import type { Action, Anchor, Annotation, Rect, Session } from '../types'

/** Overlay-side annotation with a live handle to the element it was created on. */
export interface Draft {
  kind: 'select' | 'draw'
  element: Element
  anchor: Anchor
  /** draw only: box in viewport px and the insert index */
  box?: Rect & { childIndex: number }
}

export interface Entry extends Annotation {
  /** Live element, used to keep the pin attached across scroll and HMR. */
  element: Element | null
}

export type SessionAction =
  | { type: 'add'; draft: Draft; action: Action; note: string; id: string; createdAt: string }
  | { type: 'note'; id: string; note: string }
  | { type: 'remove'; id: string }
  | { type: 'clear' }

export function reduce(entries: Entry[], a: SessionAction): Entry[] {
  switch (a.type) {
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
      return [...entries, entry]
    }
    case 'note':
      return entries.map((e) => (e.id === a.id ? { ...e, note: a.note } : e))
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
    annotations: entries.map(({ element: _element, ...annotation }) => annotation),
  }
}
