import { describe, expect, test } from 'vitest'
import type { Anchor, Annotation, Session } from '../types'
import { toJson } from './json'
import { toMarkdown } from './markdown'

const rect = { x: 0, y: 0, w: 800, h: 40 }
function anchor(over: Partial<Anchor>): Anchor {
  return {
    tag: 'div',
    owners: [],
    selector: 'div',
    rect,
    resolved: 'exact',
    file: 'app/page.tsx',
    line: 1,
    ...over,
  }
}
function ann(
  over: Partial<Annotation> & Pick<Annotation, 'index' | 'action' | 'anchor' | 'note'>,
): Annotation {
  return { id: `id${over.index}`, createdAt: '2026-09-06T12:12:00.000Z', ...over }
}

const NOW = new Date(2026, 8, 6, 14, 12)

// The PRD §9.1 dashboard scenario, verbatim where the data allows it.
const session: Session = {
  route: '/dashboard',
  url: 'http://localhost:3000/dashboard',
  viewport: { w: 1440, h: 900 },
  screenshot: 'data:image/png;base64,AAAA',
  annotations: [
    ann({
      index: 1,
      action: 'change',
      anchor: anchor({
        tag: 'nav',
        file: 'app/(app)/layout.tsx',
        line: 42,
        owners: ['RootLayout', 'Header', 'MainNav'],
        text: 'Dashboard · Reports · Settings',
      }),
      note: 'Replace the dropdown with a horizontal top nav. Same items, same order.\nActive item underlined.',
    }),
    ann({
      index: 2,
      action: 'add',
      anchor: anchor({
        tag: 'section',
        file: 'app/(app)/dashboard/page.tsx',
        line: 87,
        owners: ['DashboardPage', 'FilterPanel'],
        rect: { x: 0, y: 0, w: 800, h: 600 },
      }),
      box: { x: 0, y: 120, w: 790, h: 220, childIndex: 2 },
      note: 'Sortable table. Columns: Name, Status, Updated. Status filter chips above it.\nReuse our existing DataTable if present.',
    }),
    ann({
      index: 3,
      action: 'remove',
      anchor: anchor({
        tag: 'button',
        file: 'components/toolbar.tsx',
        line: 31,
        owners: ['DashboardPage', 'Toolbar'],
        text: 'Export CSV',
      }),
      note: "Remove; the action moves into the new table's row menu.",
    }),
    ann({
      index: 4,
      action: 'move',
      anchor: anchor({
        tag: 'aside',
        file: 'components/sidebar.tsx',
        line: 12,
        owners: ['DashboardPage', 'Sidebar', 'QuickStats'],
      }),
      target: {
        ...anchor({
          tag: 'section',
          file: 'app/(app)/dashboard/page.tsx',
          line: 60,
          owners: ['DashboardPage', 'Main'],
        }),
        position: 'before',
      },
      note: 'Show quick stats above the main content on this page only.',
    }),
  ],
}

describe('toMarkdown', () => {
  test('renders the PRD §9.1 scenario', () => {
    expect(toMarkdown(session, { now: NOW })).toBe(
      `# Redlining — /dashboard  (2026-09-06 14:12 · viewport 1440×900)

Screenshot: .redlining/screenshot.png (pins numbered as below)

## 1 · CHANGE — MainNav
- Anchor: \`<nav>\` · app/(app)/layout.tsx:42 · owners: RootLayout › Header › MainNav
- Text: "Dashboard · Reports · Settings"
- Note: Replace the dropdown with a horizontal top nav. Same items, same order.
  Active item underlined.

## 2 · ADD — inside FilterPanel
- Container: \`<section>\` · app/(app)/dashboard/page.tsx:87 · owners: DashboardPage › FilterPanel
- Position: after child 2 · full width · ≈ 220 px tall
- Note: Sortable table. Columns: Name, Status, Updated. Status filter chips above it.
  Reuse our existing DataTable if present.

## 3 · REMOVE — "Export CSV" button
- Anchor: \`<button>\` · components/toolbar.tsx:31 · owners: DashboardPage › Toolbar
- Text: "Export CSV"
- Note: Remove; the action moves into the new table's row menu.

## 4 · MOVE — QuickStats
- From: \`<aside>\` · components/sidebar.tsx:12 · owners: DashboardPage › Sidebar › QuickStats
- To: before \`<section>\` · app/(app)/dashboard/page.tsx:60 · owners: DashboardPage › Main
- Note: Show quick stats above the main content on this page only.

---
Apply in order. Reuse existing components and design tokens. Do not touch anything not listed.
`,
    )
  })

  test('omits the screenshot line without a screenshot, sorts by index, and titles by tag when there is no owner', () => {
    const s: Session = {
      ...session,
      screenshot: undefined,
      annotations: [
        ann({ index: 2, action: 'change', anchor: anchor({ tag: 'p' }), note: 'two' }),
        ann({
          index: 1,
          action: 'change',
          anchor: anchor({ tag: 'h1', text: 'Hello' }),
          note: 'one',
        }),
      ],
    }
    const md = toMarkdown(s, { now: NOW })
    expect(md).not.toContain('Screenshot:')
    expect(md.indexOf('## 1 · CHANGE — "Hello" h1')).toBeLessThan(md.indexOf('## 2 · CHANGE — <p>'))
  })

  test('titles fall back to the tag when the text is long and there is no owner', () => {
    const long = 'x'.repeat(41)
    const md = toMarkdown(
      {
        ...session,
        screenshot: undefined,
        annotations: [
          ann({
            index: 1,
            action: 'change',
            anchor: anchor({ tag: 'aside', text: long }),
            note: 'n',
          }),
        ],
      },
      { now: NOW },
    )
    expect(md).toContain('## 1 · CHANGE — <aside>')
    expect(md).toContain(`- Text: "${long}"`)
  })

  test('explains the fallback rungs', () => {
    const s: Session = {
      ...session,
      screenshot: undefined,
      annotations: [
        ann({
          index: 1,
          action: 'change',
          anchor: anchor({ resolved: 'ancestor', selector: 'main > div > span', tag: 'span' }),
          note: 'a',
        }),
        ann({
          index: 2,
          action: 'remove',
          anchor: anchor({
            resolved: 'selector-only',
            file: undefined,
            line: undefined,
            selector: '#x > i',
            tag: 'i',
            text: 'hi',
          }),
          note: 'b',
        }),
      ],
    }
    const md = toMarkdown(s, { now: NOW })
    expect(md).toContain(
      '- Anchor: `<span>` · app/page.tsx:1\n- Resolved: nearest decorated ancestor; locate the child by selector `main > div > span`',
    )
    expect(md).toContain(
      '- Anchor: `<i>` · unresolved\n- Text: "hi"\n- Resolved: unresolved — locate by selector `#x > i` and text',
    )
  })

  test('names the usage site for reusable components, and the target text of a move', () => {
    const context = { file: 'app/heute/page.tsx', line: 41, tag: 'section', index: 1, count: 3 }
    const from = anchor({
      file: 'src/components/ui/card.tsx',
      line: 33,
      text: 'Kettlebell Ganzkörper',
      context,
    })
    const to = {
      ...anchor({
        file: 'src/components/ui/card.tsx',
        line: 33,
        text: '0 Tage Serie',
        context: { ...context, line: 22, index: 1, count: 1 },
      }),
      position: 'before' as const,
    }
    const md = toMarkdown(
      {
        ...session,
        screenshot: undefined,
        annotations: [ann({ index: 1, action: 'move', anchor: from, target: to, note: 'n' })],
      },
      { now: NOW },
    )
    expect(md).toContain(
      '- From: `<div>` · src/components/ui/card.tsx:33 · instance 1 of 3 in `<section>` · app/heute/page.tsx:41',
    )
    expect(md).toContain(
      '- To: before `<div>` · src/components/ui/card.tsx:33 · instance 1 of 1 in `<section>` · app/heute/page.tsx:22 · text: "0 Tage Serie"',
    )
    expect(md).toContain('- Text: "Kettlebell Ganzkörper"')
  })

  test('renders a tweak: classes, collapsed changes, applies-at, optional note, and the values footer', () => {
    const a = anchor({
      tag: 'button',
      file: 'components/toolbar.tsx',
      line: 31,
      owners: ['Toolbar'],
      text: 'Export CSV',
      classes: ['btn', 'btn-primary'],
    })
    const md = toMarkdown(
      {
        ...session,
        screenshot: undefined,
        annotations: [
          ann({
            index: 1,
            action: 'change',
            anchor: a,
            note: '',
            appliesAt: 768,
            changes: [
              { kind: 'text', property: 'text', from: 'Export CSV', to: 'Download CSV' },
              { kind: 'style', property: 'font-size', from: '14px', to: '16px' },
              {
                kind: 'style',
                property: 'width',
                from: '96px',
                to: '128px',
                relative: '≈ 33 % of parent',
              },
              { kind: 'style', property: 'padding-left', from: '12px', to: '16px' },
              { kind: 'style', property: 'padding-right', from: '12px', to: '16px' },
              { kind: 'style', property: 'opacity', from: '1', to: '1' },
              {
                kind: 'nudge',
                property: 'transform',
                from: 'none',
                to: 'translate(8px, -4px)',
                input: '+8px right, −4px up',
              },
            ],
          }),
        ],
      },
      { now: NOW },
    )
    expect(md).toContain(`## 1 · CHANGE — Toolbar
- Anchor: \`<button>\` · components/toolbar.tsx:31 · owners: Toolbar
- Text: "Export CSV"
- Classes: \`btn btn-primary\`
- Changes:
  - text: "Export CSV" → "Download CSV"
  - font-size: 14px → 16px
  - width: 96px → 128px (≈ 33 % of parent)
  - padding-left, padding-right: 12px → 16px
  - visual nudge: +8px right, −4px up — previewed with a transform; implement as spacing or alignment, never ship a transform
- Applies at: ≤ 768px (approximate; viewport preset, not a media query)

---`)
    expect(md).not.toContain('- Note:')
    expect(md).not.toContain('opacity')
    expect(
      md
        .trim()
        .endsWith(
          "implement them in this project's own idiom (utility classes, tokens), not as inline styles.",
        ),
    ).toBe(true)
  })

  test('lists every anchor of a multi-select annotation', () => {
    const a1 = anchor({ tag: 'article', file: 'app/a.tsx', line: 3, owners: ['Grid', 'Card'] })
    const a2 = anchor({ tag: 'article', file: 'app/a.tsx', line: 9, owners: ['Grid', 'Card'] })
    const md = toMarkdown(
      {
        ...session,
        screenshot: undefined,
        annotations: [
          ann({ index: 1, action: 'change', anchor: a1, anchors: [a1, a2], note: 'Same height.' }),
        ],
      },
      { now: NOW },
    )
    expect(md).toContain(
      '## 1 · CHANGE — Card (+1)\n- Anchors:\n  1. `<article>` · app/a.tsx:3 · owners: Grid › Card\n  2. `<article>` · app/a.tsx:9 · owners: Grid › Card\n- Note: Same height.',
    )
  })

  test('describes add positions at start, at end and with a partial width', () => {
    const base = anchor({ tag: 'ul', owners: ['List'], rect: { x: 0, y: 0, w: 1000, h: 500 } })
    const start = ann({
      index: 1,
      action: 'add',
      anchor: base,
      box: { x: 0, y: 0, w: 400, h: 50, childIndex: 0 },
      note: 'n',
    })
    const end = ann({
      index: 2,
      action: 'add',
      anchor: base,
      box: { x: 0, y: 0, w: 950, h: 50 },
      note: 'n',
    })
    const md = toMarkdown(
      { ...session, screenshot: undefined, annotations: [start, end] },
      { now: NOW },
    )
    expect(md).toContain('- Position: at start · ≈ 400 px wide · ≈ 50 px tall')
    expect(md).toContain('- Position: at end · full width · ≈ 50 px tall')
  })
})

describe('toJson', () => {
  test('round-trips the session and ends with a newline', () => {
    const out = toJson(session)
    expect(out.endsWith('\n')).toBe(true)
    expect(JSON.parse(out)).toEqual(session)
  })
})
