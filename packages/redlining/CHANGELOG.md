# redlining

## 0.6.0

### Minor Changes

- **Styling settings.** The overlay detects the page's styling idiom (Tailwind 4 from its theme tokens, Tailwind 3 from the preflight variables, CSS Modules from hashed class names, else plain CSS), shows it in a new Settings popover (gear in the toolbar) where you can override it, and the `<Redlining framework>` prop sets it in code. The export header states `Styling: Tailwind 4 (detected: …)` and the footer tells the agent the matching idiom. Under Tailwind, values map through the theme even when the utility is not emitted yet: `padding-left: 12px → 24px (from class btn; add class pl-6)`, `text-[17px]` for off-scale values, `bg-brand-500` for a `--color-*` token; steppers snap to the theme scale (`pl-3 → pl-3.5`, `text-sm → text-base`). The settings also hold the Snap-to-scale default.
- **Multi-route export.** Sessions stay per route, but Save and Copy now include every other route that has annotations in this browser, each under its own `# Redlining — /route` heading with one footer, and `annotations.json` carries them as `others`. The list panel shows those routes with a per-route Clear; the setting "Include other routes" turns it off. The `/redline` command template says the file may hold several routes.
- **Reference images and crops.** Paste or drop a mockup into a note (up to three, shrunk to 1600px); it shows as a thumbnail, persists with the session, and Save writes it as `ref-N-i.jpg` with a `Reference:` line telling the agent to match it. With the camera on, Save also writes `crop-N.png` per annotation (the element with a margin, no pins) and a `Crop:` line. The route prunes stale images, accepts 16 MB bodies (was 8), and the `/redline` template asks the agent to view both.
- **Verify loop.** The `/redline` command now ends by writing `.redlining/reply.md` (`## N · done | partial | skipped — what changed`). The route gained `GET` (`createHandlers()` returns `{ GET, POST }`; `redlining init` writes `export { GET, POST }` and points out routes and commands that predate this). When the overlay opens and the reply is newer than the last save, it checks every annotation against the page with its previews removed and opens the list: `applied`, `differs · font-size is 15px, expected 16px`, `missing`, or `check by eye`, beside the agent's line. The panel has a Verify button and _Remove applied_.
- **Beyond Next.js.** `redlining/standalone` bundles React and mounts from a script tag (`data-redlining data-endpoint="off"`) or `mount()`, so the overlay runs on Angular, Vue and plain pages with selector anchors; component names come from Angular's `ng.getComponent` (dev mode) and Vue 3's instance chain, React's owner chain as before. `endpoint: false`, a 404 or an unreachable endpoint make Save download `annotations.md`, `annotations.json` and the images instead. `redlining/vite` can serve the save endpoint from the dev server (`redlining({ endpoint: true })`); the handler moved to `src/server/handler.ts` and `redlining/next/route` re-exports it unchanged.
- `class A → B` is printed only when B is on A's scale (`text-sm → text-lg`); a utility from another family is `add class pl-6`, so component classes are never told to be replaced.

## 0.5.0

### Minor Changes

- **Value provenance** in tweak mode: every Inspector field says where its value comes from (`from .text-lg`, `var(--leading) · .prose`, `inherited from <section>`, `inline style`), and sizes nobody sets are labelled `auto · from grid|flex|block`. The export carries it: `font-size: 15px → 17px (class text-base → text-lg)` when a single-class rule in your stylesheet matches the new value, `(from class btn)` otherwise, and `width: auto (180px, laid out by the parent grid) → 220px — … prefer changing the layout` for layout-derived sizes. `Change` gains `source` and `suggestion`.
- Inspector sections (Type, Box, Padding, Margin, Colour, Layout) are collapsed by default and show their values in one line, e.g. `margin 10 0 20 0`; click the heading to open one. Displayed values round to one decimal.
- **Snap to scale** (on by default): the Inspector's plus and minus buttons step through the classes your stylesheet offers for that property (`text-sm` → `text-base` → `text-lg`) instead of by 1px, so a tweak lands on a real class; turn it off for free values.

## 0.4.0

### Minor Changes

- The viewport preset is now a **device frame**: the width select (375 / 768 / 1280) opens the same page in an iframe of that width, so media queries, fixed bars and mobile layouts behave as on a device. The overlay inside the frame opens by itself, its annotations sync into the same session, and each carries `Applies at: ≤ 375px (made in a 375px device frame)`. The earlier max-width approximation is gone.
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
