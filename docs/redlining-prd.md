# Redlining — Product Requirements Document

**One-liner:** Figma-style comments on your *running* Next.js app, exported as a file-anchored spec that Claude Code can execute without asking questions.

| | |
|---|---|
| Status | Draft v0.1 |
| Owner | Frank (kpunkt) |
| Date | 2026-09-06 |
| Package | `redlining` (npm, unscoped) |
| License intent | Open source (MIT) |

---

## 1. Summary

Redlining is a dev-only overlay for Next.js applications. While the app runs on localhost, the developer clicks an existing element or draws a rectangle where something new belongs, writes a short note, and Redlining resolves every annotation to the exact **file, line, host element and React owner chain**. The batch is exported as a Markdown spec (plus JSON and an optional screenshot with numbered pins) and handed to Claude Code through a `/redline` slash command.

Redlining never edits code. Claude Code remains the only thing that changes the codebase; Redlining's job is to make the human's visual intent precise enough that the first attempt lands.

### 1.1 Name

**Decision.** The project is called **Redlining** and ships as the unscoped npm package `redlining`.

Redlining is the established term for marking up a proof with corrections and additions — which is precisely what the tool does, and it covers both interaction modes without needing to explain them. The gerund is deliberate: the tool captures an activity in progress, not a finished artifact. The ambiguity of the word is accepted knowingly (see below).

**Surfaces.** The name appears in five places and should read naturally in each:

| Surface | Form |
|---|---|
| Package | `redlining` |
| Config wrapper | `import { withRedlining } from 'redlining/next'` |
| Component | `<Redlining />` |
| Output folder | `.redlining/` (`annotations.md`, `annotations.json`, `screenshot.png`) |
| Slash command | `/redline` |

The slash command uses the short form: it is typed repeatedly in an interactive session, where every syllable costs. The docs introduce it as *the command for redlining*.

**Registry status** (checked on npm, 2026-09-06):

- `redlining` — available ✅
- `vite-plugin-redlining`, `redlining-vite` — available ✅
- `redline` — taken (dormant 1.0.1, last published 2022) ❌
- `loupe`, `pinpoint`, `markup`, `scribble`, `marginalia`, `punkt`, `redpen` — taken ❌

Action: publish `redlining` at M1 and reserve `vite-plugin-redlining` as a thin alias package, since `vite-plugin-*` is how the Vite ecosystem is searched and reserving it prevents a third party from parking a confusable name ahead of the Vite adapter (§14, M3).

**Known connotation.** In American English, "redlining" is primarily associated with the historical practice of denying mortgages and services to neighbourhoods on racial grounds — a real and current term in US legal and political discourse, and a share of US readers will meet that association first. The decision stands, but the README establishes the intended meaning — the print/proofing sense — in its first sentence, so search results and social previews carry the right frame.

---

## 2. Problem

When iterating on UI with Claude Code, the developer forms intent **visually** — in the running app — but expresses it **textually**. The location information is lost in translation:

- "The form on the right" → which component? which file?
- "Move the nav up" → which nav, up where, before or after what?
- A screenshot identifies *what* but says nothing about *where in the code*.

Each ambiguity costs a round-trip: Claude Code guesses, edits the wrong component or the right one in the wrong way, and the developer re-explains. For layout work this is the dominant cost, not the edit itself.

**Root cause:** the DOM already knows which component and source location every pixel came from. Nothing currently captures that together with the human's instruction.

---

## 3. Goals and non-goals

### Goals

| # | Goal |
|---|------|
| G1 | Any click in the running app resolves to `file:line` + host element + owner chain. |
| G2 | Two primary gestures: **Select** (change/remove something that exists) and **Draw** (add something new in a region). **Move** as a two-click gesture follows in M2. |
| G3 | Export is a spec Claude Code can execute in one pass: anchors + notes + optional screenshot, plus a slash command that consumes it. |
| G4 | Per-project setup ≤ 3 lines, identical across projects, updated centrally via npm. |
| G5 | Zero production footprint — no bytes, no attributes, no routes in prod builds. |
| G6 | Works for Server Components and Client Components alike. |

### Non-goals (v1)

- **Not a visual editor.** No WYSIWYG, no writing code, no drag-and-drop layout engine.
- **Not a screenshot parser.** Pixels → components is the wrong direction when the DOM is available.
- **No cloud, accounts, or telemetry.** Localhost only.
- **No non-React frameworks.** A Vite/React adapter is a later track (§14, M3); the support contract is stated in §17.1.

---

## 4. Users and jobs to be done

**Primary:** Frank and kpunkt developers building Next.js apps with Claude Code.
**Secondary (OSS):** any React/Next.js developer using an agentic coding tool.

| When… | I want to… | So that… |
|---|---|---|
| I see something wrong in the running app | point at it and say what should change | Claude Code edits the right file the first time |
| something is missing | draw where it goes and describe it | the new component lands in the right container at the right position |
| I have five small things | batch them into one instruction | I get one coherent change instead of five prompts |
| an element should be somewhere else | click source, click destination | I don't have to describe DOM positions in prose |

---

## 5. Positioning

| Tool | What it does | Relation to Redlining |
|---|---|---|
| Onlook, Frontman | Visual editors that write the code themselves | Different philosophy. Redlining keeps the agent in charge and stays a thin input layer. |
| Next.js `agent-browser` / `next-dev-loop` skill (16.3) | Lets the **agent** drive a browser, inspect the React tree with source-mapped locations, and verify edits | Complementary. Redlining captures **human** intent; `next-dev-loop` lets the agent verify the result. `/redline` explicitly hands off to it. |
| Next.js Instant Insights "Copy prompt" | Framework-generated, paste-ready prompts for performance fixes | Same output idea (agent-ready prompt), different input (human visual intent vs. diagnostics). |
| Figma comments | Same interaction model | …but on a design file, not the real app with real file paths. |

---

## 6. Core concepts and data model

- **Session** — all annotations for one route + viewport. Persisted in `localStorage` per route until sent or cleared.
- **Annotation** — one intent: an action, an anchor, an optional box, a note.
- **Anchor** — *where*: file:line, host element, owner chain, fallback selector, rect at capture time.
- **Box** — for `add`: a rectangle relative to the anchor's rect, plus a position hint among the anchor's children.

```ts
type Action = 'change' | 'add' | 'remove' | 'move'

interface Rect { x: number; y: number; w: number; h: number }

interface Anchor {
  file: string            // project-relative: app/(app)/layout.tsx
  line: number
  column?: number
  tag: string             // host element: 'nav' | 'form' | 'button' …
  owners: string[]        // React owner chain, outermost first
                          // ['RootLayout', 'Header', 'MainNav']; [] for server-only subtrees
  selector: string        // fallback CSS path
  text?: string           // trimmed textContent ≤ 80 chars, for disambiguation
  rect: Rect              // viewport px at capture time
  resolved: 'exact' | 'ancestor' | 'selector-only'
}

interface Annotation {
  id: string              // nanoid
  index: number           // 1-based, stable order in the export
  action: Action
  anchor: Anchor
  target?: Anchor & { position: 'before' | 'after' | 'inside' }   // move only
  box?: Rect & { childIndex?: number }                             // add only, relative to anchor.rect
  note: string
  createdAt: string       // ISO
}

interface Session {
  route: string
  url: string
  viewport: { w: number; h: number }
  annotations: Annotation[]
  screenshot?: string     // data URL, optional
}
```

---

## 7. User experience

### 7.1 Activation

- Dev builds only. A small floating toggle (Lucide `PenLine`) sits bottom-right by default — Next.js DevTools occupies bottom-left. Position is configurable.
- Keyboard: `⌥R` / `Alt+R` toggles the overlay. `Esc` closes it.
- The overlay lives in a Shadow DOM host. When inactive it registers **only** the hotkey listener and captures no pointer events.

### 7.2 Toolbar

All icons from `lucide-react`.

| Icon | Tool | Key |
|---|---|---|
| `MousePointerClick` | Select | `S` |
| `SquareDashedMousePointer` | Draw | `D` |
| `ArrowRightLeft` | Move *(M2)* | `M` |
| `ListChecks` | Annotation list panel | `L` |
| `Camera` | Include screenshot in export (toggle) | — |
| `Copy` | Copy prompt to clipboard | `⌘⇧C` |
| `Send` | Save to project | `⌘⏎` |
| `Trash2` | Clear session (confirm) | — |
| `X` | Close overlay | `Esc` |

### 7.3 Select mode

1. **Hover:** the smallest decorated host element under the cursor gets a 2 px accent outline and a badge: `MainNav · app/(app)/layout.tsx:42 · <nav>`.
2. **Ancestor walking:** `[` / `]` (or `⌥`+scroll) moves the selection up/down the ancestor chain before committing. The badge updates live. This matters — often you mean the whole card, not the `<span>` inside it.
3. **Click:** drops a numbered pin and opens the note popover (textarea autofocused, action chips **Change** / **Remove**). `⏎` saves, `⇧⏎` newline, `Esc` cancels.
4. **Multi-select** *(M2)*: `⇧`+click adds anchors to one annotation with a single note ("make all of these the same height").

### 7.4 Draw mode

1. Drag a rectangle anywhere on the page.
2. On release, Redlining resolves the **container** (§8.4) and shows it outlined, with the box drawn inside it and a position hint ("after child 2").
3. Note popover opens with action fixed to **Add**. Optional component-hint chips (Table, Form, Button, Card, Modal, Nav, List, Chart) prepend a keyword; free text remains primary.
4. The box is stored relative to the container's rect, so it survives scroll and resize.

### 7.5 Move mode *(M2)*

Click source → click target → pick **before / after / inside** from a three-button popover. Produces a `move` annotation with both anchors. This gives rearranging without simulating a layout engine.

### 7.6 Annotation list panel

- Side panel (right, 320 px) lists all annotations: index, action, owner chain, note. Inline edit, delete, drag to reorder (reorder changes the export order).
- Pins stay attached across scroll and resize; on DOM mutation (HMR) Redlining re-resolves each anchor via stored `data-rl` value, then selector, and marks pins it can't find.
- Cap: 15 annotations per session, with a warning at 10 — larger batches degrade agent output.

### 7.7 Export actions

- **Copy prompt** → Markdown (§9.1) to clipboard.
- **Save to project** → `POST /api/redlining` → writes `.redlining/annotations.md`, `.redlining/annotations.json`, and `.redlining/screenshot.png` (pins burned in) if enabled. Toast: *"Saved — run `/redline` in Claude Code."*
- Session persists until cleared; a successful `/redline` run deletes the files, not the session, so the developer can re-send with tweaks.

---

## 8. Anchor resolution (technical design)

### 8.1 File and line — build-time attribute injection (default)

A loader compatible with Turbopack's webpack-loader API, registered by `withRedlining()` under `turbopack.rules` for project source globs (`app/**/*.{tsx,jsx}`, `components/**/*.{tsx,jsx}`, `src/**/*.{tsx,jsx}`; configurable) and only in `PHASE_DEVELOPMENT_SERVER`.

- Parses the file (`@swc/core` `parse`, which Next already ships) and appends `data-rl="<relpath>:<line>:<col>"` to every **host** JSX opening element (lowercase tag). Emits a source map via `magic-string`.
- **Components are not decorated.** Decorating them would leak an unknown prop into user components (warnings, prop-spread bugs). Component identity comes from §8.2 instead.
- **Server Components work for free:** the attribute is static markup, so it reaches the HTML regardless of where the component rendered.
- Why not a Babel plugin: Turbopack (default since Next 16) does not run Babel, and a Babel config would disable SWC.
- Webpack fallback: the same loader added through the `webpack()` hook for `next dev --webpack`.

### 8.2 Owner chain — React fiber walk (runtime, dev)

From the clicked DOM node, read the `__reactFiber$…` property → fiber → walk `fiber._debugOwner` collecting function/class component names up to the root. The result is the *owner* chain ("who rendered this"), which matches how humans describe UI ("the nav inside the header").

- Dev builds only (fine — Redlining is dev-only). `_debugOwner` is a React internal: isolate in `resolve/fiber.ts`, feature-detect, degrade to file:line-only if absent.
- Server-only subtrees have no client fiber; `owners` is `[]` and the anchor is still exact via `data-rl`.

### 8.3 Alternative under evaluation (M0 spike)

React 19 dev attaches `fiber._debugStack` (the JSX creation stack). Next's dev overlay source-maps such frames through its own dev-server endpoint. If Redlining can reuse that path reliably on 16.3, it gets `file:line` **with zero build configuration**. Cost: it's an undocumented internal that may move between minors.

**Decision rule:** if the spike passes 20/20 sample elements (incl. Server Components) on 16.3 stable and canary, ship it as the default and keep the loader as opt-in. Otherwise the loader is the default.

### 8.4 Draw-mode container resolution

1. `document.elementsFromPoint(cx, cy)` at the box center, filtered to elements with `data-rl`.
2. Choose the **deepest** element whose rect covers ≥ 60 % of the drawn box; else the nearest decorated ancestor of the center element.
3. Position hint: compare `box.y` against the container's children rects → `before child N` / `after child N` / `at end`.

### 8.5 Fallback ladder

| Situation | Anchor `resolved` | Export note |
|---|---|---|
| Element has `data-rl` | `exact` | — |
| Only an ancestor has `data-rl` | `ancestor` | "nearest decorated ancestor; locate the child by selector/text" |
| Nothing decorated (third-party UI, portals) | `selector-only` | "unresolved — locate by selector and text" |

---

## 9. Export format

### 9.1 Markdown (primary; human- and agent-readable)

```md
# Redlining — /dashboard  (2026-09-06 14:12 · viewport 1440×900)

Screenshot: .redlining/screenshot.png (pins numbered as below)

## 1 · CHANGE — MainNav
- Anchor: `<nav>` · app/(app)/layout.tsx:42 · owners: RootLayout › Header › MainNav
- Text: "Dashboard · Reports · Settings"
- Note: Replace the dropdown with a horizontal top nav. Same items, same order.
  Active item underlined.

## 2 · ADD — inside FilterPanel
- Container: `<section>` · app/(app)/dashboard/page.tsx:87 · owners: DashboardPage › FilterPanel
- Position: after child 2 (the search input) · full width · ≈ 220 px tall
- Note: Sortable table. Columns: Name, Status, Updated. Status filter chips above it.
  Reuse our existing DataTable if present.

## 3 · REMOVE — "Export CSV" button
- Anchor: `<button>` · components/toolbar.tsx:31 · owners: DashboardPage › Toolbar
- Note: Remove; the action moves into the new table's row menu.

## 4 · MOVE — QuickStats
- From: `<aside>` · components/sidebar.tsx:12 · owners: DashboardPage › Sidebar › QuickStats
- To: before `<section>` · app/(app)/dashboard/page.tsx:60 · owners: DashboardPage › Main
- Note: Show quick stats above the main content on this page only.

---
Apply in order. Reuse existing components and design tokens. Do not touch anything not listed.
```

### 9.2 JSON

Same content as `Session` (§6), written alongside the Markdown. Used by tests, tooling, and a possible future MCP surface.

### 9.3 Screenshot

`html-to-image` (lazy-loaded) captures `document.documentElement`; pins are drawn onto the canvas before encoding. Saved as PNG. Claude Code can view referenced image files.

---

## 10. Claude Code integration

`npx redlining init` writes three things (idempotent):

1. `app/api/redlining/route.ts` (re-export, §11)
2. `.gitignore` entry `.redlining/`
3. `.claude/commands/redline.md`:

```md
Read `.redlining/annotations.md`. If `.redlining/screenshot.png` exists, view it — pins are numbered like the annotations.

Apply every annotation in order. Each anchor names the exact file, line, host element and React owner chain — edit there. Only search elsewhere if an anchor is marked "unresolved".

Reuse existing components and design tokens in this repo. Do not change anything not listed.

After applying, verify the result in the running app (use the `next-dev-loop` skill if available) and report per annotation: done / partial / skipped, with a one-line reason.

Finally delete `.redlining/annotations.md`, `.redlining/annotations.json` and `.redlining/screenshot.png`.
```

Redlining does **not** touch `CLAUDE.md` (Next 16.3 manages a block there itself).

**Loop:** annotate → Save → `/redline` → Claude Code edits → HMR → next round.

---

## 11. Architecture and package structure

pnpm monorepo:

```
redlining/
├─ packages/redlining/            # published as `redlining`
│  ├─ src/overlay/                # React overlay (client), Shadow DOM, Tailwind 4
│  ├─ src/resolve/                # fiber walk, container resolution (pure, unit-tested)
│  ├─ src/export/                 # markdown / json serializers
│  ├─ src/next/                   # withRedlining(), loader, route handler
│  ├─ src/cli/                    # `redlining init`
│  └─ package.json                # exports: ".", "./next", "./next/route", "./loader"
├─ examples/next-app/             # Next 16.3 playground; Playwright target
└─ docs/
```

### Runtime pieces

| Piece | Responsibility | Notes |
|---|---|---|
| `<Redlining />` | Client component; mounts the overlay | Returns `null` unless `process.env.NODE_ENV === 'development'` → dead-code-eliminated in prod. Shadow DOM host; Tailwind 4 compiled to a CSS string and injected into the shadow root, so neither preflight nor `@layer` leaks in either direction. |
| `withRedlining(config, opts?)` | Adds the loader rule under `turbopack.rules` (+ `webpack` fallback) | Only in `PHASE_DEVELOPMENT_SERVER`; no-op otherwise. |
| `redlining/next/route` | `POST` handler | Refuses outside dev; writes only under `<projectRoot>/.redlining/`; path-validated; body size-capped (16 MB; screenshot ≤ 7 MB, plus crops and reference images). |
| `redlining/loader` | `transform(src, filename) → { code, map }` | Pure, unit-tested against JSX/TSX fixtures incl. fragments, spreads, conditionals, `'use client'`/server files. |
| `redlining init` | Scaffolds route, command, gitignore | Idempotent; prints next steps. |

### Setup in a project

```ts
// next.config.ts
import { withRedlining } from 'redlining/next'
export default withRedlining({ /* your config */ })
```

```tsx
// app/layout.tsx
import { Redlining } from 'redlining'
export default function RootLayout({ children }) {
  return <html><body>{children}<Redlining /></body></html>
}
```

```ts
// app/api/redlining/route.ts   (written by `npx redlining init`)
export { GET, POST } from 'redlining/next/route'
```

---

## 12. Tech stack

| Layer | Choice |
|---|---|
| Language | TypeScript 5.x, `strict` |
| Framework target | Next.js 16.3+ (Turbopack default, webpack fallback), App Router and Pages Router; React 19 |
| Overlay UI | React 19, Tailwind CSS 4 (shadow-scoped), `lucide-react` |
| Build | tsdown (ESM + CJS for the loader/config entry, ESM for the overlay) |
| Package manager | pnpm workspaces |
| Tests | Vitest (resolve, export, loader), Playwright (e2e on `examples/next-app`) |
| Quality | ESLint (flat config), Prettier, typecheck in CI |
| Release | Changesets, GitHub Actions, npm `redlining` |
| Peer deps | `next ≥ 16`, `react ≥ 19` |
| Runtime deps | `lucide-react`, `nanoid`; `html-to-image` lazy-loaded; `@swc/core` resolved from Next |

---

## 13. Non-functional requirements

- **Zero prod footprint.** CI asserts 0 bytes of Redlining in the production client bundle and no `data-rl` attributes in `next build` output.
- **Dev overhead.** Loader median < 5 ms/file; no measurable HMR regression; overlay idle CPU ≈ 0.
- **Isolation.** No global CSS; no listeners when inactive except the hotkey; z-index above Next DevTools; never captures pointer events when inactive.
- **Privacy / security.** Localhost only; nothing leaves the machine; route handler validates dev mode and target path; no telemetry.
- **Compatibility.** Current Chrome, Edge, Safari, Firefox. Server and Client Components (§8.1–8.2).
- **Accessibility.** Fully keyboard-operable; focus managed in popovers; respects `prefers-reduced-motion`.
- **Snapshot hygiene.** `data-rl` exists only in dev; a `stripRedlining()` helper is exported for tests that render dev HTML.

---

## 14. Milestones

| Milestone | Scope | Exit criteria |
|---|---|---|
| **M0 — Spike** (1 wk) | Anchor resolution on Next 16.3 Turbopack: loader path **and** `_debugStack` path; measure; decide (§8.3). | Click → correct `file:line` on 20/20 sample elements incl. Server Components, on stable and canary. |
| **M1 — MVP** (2–3 wks) | Select + Draw, list panel, Markdown + JSON export, route handler, `init` CLI, `/redline` command, example app, unit + e2e. | The §9.1 dashboard scenario round-trips through Claude Code with zero clarifying questions. |
| **M2** (2 wks) | Move mode, screenshot with pins, multi-select, ancestor walking polish, session persistence, annotation cap. | All §7 features shipped; Playwright covers each gesture. |
| **M3 — OSS release** | README + GIF, docs site, Changesets 1.0, Vite adapter spike. | Published; setup from a fresh `create-next-app` in < 2 min. |

---

## 15. Success metrics

| Metric | Target |
|---|---|
| Round-trips per UI change with Claude Code | ≥ 50 % fewer than prose-only (self-tracked over 20 changes) |
| Anchor accuracy (annotation points at the intended file) | ≥ 95 % |
| First-pass acceptance (annotations applied on the first `/redline` run without clarification) | ≥ 90 % |
| Setup time in a new project | < 2 min |

---

## 16. Risks and mitigations

| Risk | Mitigation |
|---|---|
| React internals (`_debugOwner`, fiber key) change | Isolated in `resolve/fiber.ts`; feature-detected; degrade to file:line-only. |
| Turbopack loader semantics change; loader hits unexpected files | Strict project-relative globs; weekly CI run against `next@canary`. |
| Next internal source-map endpoint (§8.3) changes | Only ever the *optional* path; loader remains supported. |
| `data-rl` leaks into snapshot / visual-diff tests | Dev-only; documented; `stripRedlining()` helper. |
| Annotation bloat confuses the agent | Cap 15 per session, warning at 10. |
| Confusable package names get parked by third parties | `redlining` verified available (§1.1); reserve `vite-plugin-redlining` at M1 as an alias. |
| Name connotation (US "redlining") frames the project wrongly in search/social previews | README opens with the proofing sense (§1.1, §17.3). |
| Overlay styles collide with host app | Shadow DOM + compiled Tailwind string; no global CSS. |

---

## 17. Open-source implications

Publishing changes the product, not just the licence. Four consequences fall out of it.

### 17.1 Framework support becomes a documented contract

Next.js 16+ is the primary and fully supported target: the loader registered by `withRedlining()` injects `data-rl` at transform time (§8.1), which is what gives annotations line-level anchors, and the fiber walk (§8.2) supplies the owner chain.

Other setups are not silently "less good" — they are a **stated limitation** in the README:

| Setup | Status | Precision |
|---|---|---|
| Next.js 16+, Turbopack or webpack | Supported | file:line + owner chain |
| Vite + React | Planned adapter (M3) — same loader concept via Vite's `transform` hook | file:line + owner chain once shipped |
| Any React app without a build integration | Manual overlay import; **reduced** path, documented as such | owner chain + selector only (no file:line) |
| Non-React frameworks | Not supported; accepted as contributions, not promised on a roadmap | — |

Anything less explicit generates issues from users who reasonably expected parity.

### 17.2 Conventions become configuration

Anything currently hardcoded to kpunkt conventions becomes an option on `withRedlining()` / `<Redlining />` with a sensible default:

| Option | Default | Why it must be configurable |
|---|---|---|
| `outDir` | `.redlining/` | Not everyone uses Claude Code, or this path |
| `endpoint` | `/api/redlining` (`false` = download the files) | Route collisions in existing apps; pages without a dev server route |
| `include` | `app/**`, `components/**`, `src/**` (`.tsx`/`.jsx`) | Monorepos and non-standard layouts |
| `screenshot` | `true` | PNG capture via `html-to-image` is optional weight |
| `enabled` | `NODE_ENV === 'development'` | Some teams want it in a staging build |
| `hotkey` | `Alt+R` | Will collide with someone's binding |
| `position` | `bottom-right` | Next DevTools and other overlays |
| `maxAnnotations` | `15` | Teams differ on batch size |
| `framework` | detected (`tailwind4` \| `tailwind3` \| `css-modules` \| `css`) | Decides how values map to classes and what idiom the export names; detection can be wrong |

The export format itself is one formatter, not the only conceivable output. Pluggable formatters (`format: 'markdown' | 'json' | (session) => string`) do not have to ship in v1, but the internals must not assume them away — the serializers already live in `src/export/` as pure functions for this reason.

### 17.3 The README is the product surface

For a developer tool the README is the entire marketing surface. It has to land the idea above the fold, in roughly four lines:

1. What it is — draw on your running app, get precise instructions out.
2. The one-line install and the three-line setup.
3. A single GIF of the overlay in use.
4. The Claude Code handoff, shown as actual `.redlining/annotations.md` output.

Its first sentence establishes the proofing sense of "redlining" (§1.1). Everything else — options reference, reduced paths, format details — sits below. The README is an M1 deliverable, not documentation debt.

### 17.4 Project hygiene

- **Licence:** MIT.
- **Repo:** `redlining`, public from the first commit.
- **Support scope:** stated explicitly per §17.1.
- **Versioning:** semver; the annotation file format (§9) is treated as public API — marked *unstable* until M2, frozen at 1.0.
- **Contribution:** a short CONTRIBUTING file setting expectations on scope, so the issue tracker does not become a feature-request queue.
- **Alias package:** `vite-plugin-redlining` reserved at M1 as a real re-export once the Vite adapter exists; until then a placeholder pointing at the main package.

---

## 18. Open questions

1. Write to `.redlining/` (tool-agnostic) or `.claude/`? — Current answer: `.redlining/`, referenced by the command; overridable via `outDir`.
2. Include computed styles (padding, font-size, color tokens) in anchors for "match this spacing" notes? — P2 behind a toggle; keep exports short by default.
3. Expose annotations through an MCP surface so the agent *pulls* instead of reading a file? — Later; the file works with every agent and is trivially debuggable.
4. Vite/React adapter priority relative to M3 polish.
5. Should `/redline` be installed as a Claude Code **skill** rather than a slash command, to bundle the verification step with `next-dev-loop`? — Evaluate once M1 output is stable.
6. Does `redlining` want a domain and a docs site, or is the README sufficient for v1? — Leaning README-only for v1.
7. Is the annotation file format frozen at v1, or explicitly marked unstable until real usage settles it? — Current answer in §17.4: unstable until M2, frozen at 1.0.

---

## 19. Glossary

- **Anchor** — the resolved location of an annotation: file, line, host element, owner chain.
- **Host element** — a DOM-level JSX element (`<div>`, `<nav>`), as opposed to a component.
- **Owner chain** — the sequence of React components that rendered an element, outermost first.
- **Session** — the set of annotations for one route and viewport.
- **`data-rl`** — the dev-only attribute carrying `path:line:col`, injected by the loader.
