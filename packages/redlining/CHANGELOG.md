# redlining

## 0.3.0

### Minor Changes

- **Tweak mode** (`T`): change values directly in the running page and export the numbers. An Inspector with steppers for type, box, padding and margin, weight chips, a text field, colour pickers with your `:root` tokens, and gap/justify/align chips on flex and grid containers; resize handles, Alt-drag spacing, drag and arrow-key nudging (exported as an honest _visual nudge_), Alt-hover rulers, Undo and Reset. Every change is recorded as computed _before → after_ beside the element's class list (`Classes:`), previews survive reload and hot reload, and a footer tells the agent to implement values in the project's idiom, never inline styles. Viewport presets (375 / 768 / 1280) stamp `Applies at` on annotations; the camera can also save a `screenshot-before.png`. Anchors gain `classes` and `display`; annotations gain `changes` and `appliesAt`.

### Patch Changes

- A move saves without a note (its From/To carry the intent); for change, add and remove the Save button is disabled until a note exists and Enter says so, instead of silently doing nothing. Chips hand focus back to the textarea.

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
