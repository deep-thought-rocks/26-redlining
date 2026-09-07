# redlining

## 0.4.0

### Minor Changes

- The viewport preset is now a **device frame**: the width select (375 / 768 / 1280) opens the same page in an iframe of that width, so media queries, fixed bars and mobile layouts behave as on a device. The overlay inside the frame opens by itself, its annotations sync into the same session, and each carries `Applies at: ≤ 375px (made in a 375px device frame)`. The earlier max-width approximation is gone.
- **Value provenance** in tweak mode: every Inspector field says where its value comes from (`from .text-lg`, `var(--leading) · .prose`, `inherited from <section>`, `inline style`), and sizes nobody sets are labelled `auto · from grid|flex|block`. The export carries it: `font-size: 15px → 17px (class text-base → text-lg)` when a single-class rule in your stylesheet matches the new value, `(from class btn)` otherwise, and `width: auto (180px, laid out by the parent grid) → 220px — … prefer changing the layout` for layout-derived sizes. `Change` gains `source` and `suggestion`.
- Inspector sections (Type, Box, Padding, Margin, Colour, Layout) are collapsed by default and show their values in one line, e.g. `margin 10 0 20 0`; click the heading to open one. Displayed values round to one decimal.
- The toolbar and pen button can be moved between corners (button in the toolbar); the position is remembered.

## 0.3.1

### Patch Changes

- A move saves without a note (its From/To carry the intent). For change, add and remove, the Save button is disabled until a note exists and Enter shows "Write what should change first" instead of silently doing nothing. Choosing a chip hands focus back to the textarea so Enter saves right after.

## 0.3.0

### Minor Changes

- **Tweak mode** (`T`): change values directly in the running page and export the numbers. An Inspector with steppers for type, box, padding and margin, weight chips, a text field, colour pickers with your `:root` tokens, and gap/justify/align chips on flex and grid containers; resize handles, Alt-drag spacing, drag and arrow-key nudging (exported as an honest _visual nudge_), Alt-hover rulers, Undo and Reset. Every change is recorded as computed _before → after_ beside the element's class list (`Classes:`), previews survive reload and hot reload, and a footer tells the agent to implement values in the project's idiom, never inline styles. Viewport presets (375 / 768 / 1280) stamp `Applies at` on annotations; the camera can also save a `screenshot-before.png`. Anchors gain `classes` and `display`; annotations gain `changes` and `appliesAt`.

### Patch Changes

## 0.2.0

### Minor Changes

- Anchors carry a **usage site** (`context`): the nearest decorated ancestor from another file and the branch's position among its children. The Markdown prints it as `instance 2 of 3 in `<section>` · app/page.tsx:41`, and the `To` line of a move adds the target's text, so instances of one reusable component are no longer ambiguous. The list panel rows expand to the full anchor, owners, usage site, target or box, and the complete note.

## 0.1.1

### Patch Changes

- 1a4994b: `redlining/next` now imports `next/constants.js` with its extension, so an ESM `next.config.mjs` (plain Node resolution, no bundler) loads `withRedlining` again. A packed-tarball smoke test in CI now imports every entry with plain Node.

## 0.1.0

### Minor Changes

- First release. Figma-style comments on a running Next.js app, exported as a file-anchored spec for Claude Code.

  - `withRedlining()` registers a dev-only loader (Turbopack and webpack) that stamps host JSX elements with `data-rl="file:line:col"`; Server and Client Components alike.
  - `<Redlining />` overlay in a shadow root: select, draw and move modes, numbered pins, ancestor walking, multi-select, list panel, per-route session persistence, a 15-annotation cap, and a screenshot with burned-in pins.
  - Markdown + JSON export; `POST /api/redlining` writes `.redlining/`; `npx redlining init` scaffolds the route, the gitignore entry and the `/redline` Claude Code command.
  - `redlining/vite` plugin on the same transform.
  - Zero production footprint: the loader is dev-only and the package's `production` export is a null component.

  The annotation file format is unstable until 1.0.
