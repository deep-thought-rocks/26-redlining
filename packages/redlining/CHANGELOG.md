# redlining

## 0.7.6

### Patch Changes

- Annotating inside a form that has a field named `id` no longer throws; the selector walk now checks that an element's id is a string.

## 0.7.5

### Patch Changes

- Archive rows show their state as an icon with a tooltip (box: archived by hand; check: applied per verify) instead of a clipped text chip.

## 0.7.4

### Patch Changes

- Confirmations (Archive session, Delete all archived) use the overlay's own dialog instead of the browser's alert box; Enter confirms, Escape cancels.

## 0.7.3

### Patch Changes

- The list panel shows only the current page's annotations. Sessions still open on other pages moved into the history view (clock icon), listed above the archive with their counts and an × that archives them, so an annotation is always either visible, open on another page, or archived.

## 0.7.2

### Patch Changes

- Copy and Save carry exactly what the list panel shows. "Include other routes" is now off by default; when it is on, the panel footer says so. The × beside another route moves its annotations to the archive instead of deleting them.
- The note popover stays on screen: for an element near the bottom it opens above it (or beside, or clamped), clear of the toolbar, like the Inspector already did; on very small windows it scrolls inside.

## 0.7.1

### Patch Changes

- The archive toggle in the list panel uses a history icon; it looked identical to _Archive session_ next to it.

## 0.7.0

### Minor Changes

- **Archive.** Annotations are no longer deleted from a session: the × on a row, _Archive session_ and _Remove applied_ after a verify move them to an archive that keeps the route, the day, the anchor, the note, the tweak changes, the verdict and the agent's reply line. The archive button in the list panel header opens it: restore an item into the session of its own route, copy it as a prompt of its own, or delete it for good (also all at once). It lives in the browser next to the sessions, without reference images, and keeps the newest 300 items.

## 0.6.5

### Patch Changes

- Settings show the installed version and, once a day, whether a newer one is on npm (a toast the first time a new version appears; the check sends nothing and can be switched off).
- The list panel has a Copy button in its header (the whole prompt, like ⌘⇧C) and one per annotation that copies that annotation alone as a complete prompt with header and footer.

## 0.6.4

### Patch Changes

- Sessions no longer leak across routes. The overlay lives in the root layout and survives client-side navigation; it used to keep the previous page's annotations in memory and save them under every route it was navigated to, so pins from one page appeared on others and the export repeated them per route. Navigation now swaps to the new route's session (and back), previews included.
- The export header and the help popover show the package version (`# Redlining 0.6.4 — /route`), and `annotations.json` carries it as `version`.

## 0.6.3

### Patch Changes

- A keydown event without a `key` (dispatched by an extension or test tooling) no longer throws inside the overlay's hotkey handler, the window listener or the tweak layer; it is ignored.

## 0.6.2

### Patch Changes

- Vite endpoint: the request body is capped while it streams (413 past `maxBytes`, now a plugin option) and adapter errors become a 500 instead of an unhandled rejection; the Next.js route counts UTF-8 bytes, not string length.
- A failing screenshot no longer aborts the save or leaves the before/after previews reset; the export continues without the image.
- Nudges are previewed on the CSS `translate` property, so an element's own `transform` (rotation, scale) is kept; older sessions with `translate(x, y)` values still load.
- Two tweak annotations on one element now show together: previews are grouped per element and applied from one snapshot; deleting one keeps the other.
- The overlay restores the page's own inline `cursor` and `user-select` after an interaction instead of clearing them.
- A blocked clipboard shows a toast instead of failing silently.
- `withRedlining()` appends to a consumer's existing `*.tsx` / `*.jsx` Turbopack rule instead of replacing it.
- Provenance: a stylesheet `!important` now wins over a normal inline style, and among `!important` declarations a layered one wins over an unlayered one.
- `react-dom` is a declared peer dependency and `next` is optional, so Vite and standalone consumers no longer pull Next.
- Tests: the packed CLI's usage exit and `redlining init` are asserted in the smoke test; the anchor and save scenarios also run under `next dev --webpack`; a Vite fixture exercises the transform and the dev-server endpoint. `SECURITY.md` describes the reporting process.

## 0.6.1

### Patch Changes

- **Security.** The save endpoint validates the whole session before anything reaches the filesystem: every annotation index must be a positive integer, crop keys likewise, and every asset file name is checked to stay inside `outDir`. A crafted index could previously write an image outside `.redlining/`.
- **Security.** Cross-origin browser requests to the save endpoint are refused (`Origin` must be this server, `Sec-Fetch-Site` must be same-origin), in the Next.js route and the Vite middleware alike; requests without those headers (curl, tests) still pass. A hostile page could previously post a forged export to a running dev server.
- The in-package help links to the docs at https://redlining.deep-thought.rocks (was the never-enabled GitHub Pages URL); the package `homepage` follows.

## 0.6.0

### Minor Changes

- **Snap to scale** (on by default): the Inspector's plus and minus buttons step through the classes your stylesheet offers for that property (`text-sm` → `text-base` → `text-lg`) instead of by 1px, so a tweak lands on a real class; turn it off for free values.
- **Styling settings.** The overlay detects the page's styling idiom (Tailwind 4 from its theme tokens, Tailwind 3 from the preflight variables, CSS Modules from hashed class names, else plain CSS), shows it in a new Settings popover (gear in the toolbar) where you can override it, and the `<Redlining framework>` prop sets it in code. The export header states `Styling: Tailwind 4 (detected: …)` and the footer tells the agent the matching idiom. Under Tailwind, values map through the theme even when the utility is not emitted yet: `padding-left: 12px → 24px (from class btn; add class pl-6)`, `text-[17px]` for off-scale values, `bg-brand-500` for a `--color-*` token; steppers snap to the theme scale (`pl-3 → pl-3.5`, `text-sm → text-base`). The settings also hold the Snap-to-scale default.
- **Multi-route export.** Sessions stay per route, but Save and Copy now include every other route that has annotations in this browser, each under its own `# Redlining — /route` heading with one footer, and `annotations.json` carries them as `others`. The list panel shows those routes with a per-route Clear; the setting "Include other routes" turns it off. The `/redline` command template says the file may hold several routes.
- **Reference images and crops.** Paste or drop a mockup into a note (up to three, shrunk to 1600px); it shows as a thumbnail, persists with the session, and Save writes it as `ref-N-i.jpg` with a `Reference:` line telling the agent to match it. With the camera on, Save also writes `crop-N.png` per annotation (the element with a margin, no pins) and a `Crop:` line. The route prunes stale images, accepts 16 MB bodies (was 8), and the `/redline` template asks the agent to view both.
- **Verify loop.** The `/redline` command now ends by writing `.redlining/reply.md` (`## N · done | partial | skipped — what changed`). The route gained `GET` (`createHandlers()` returns `{ GET, POST }`; `redlining init` writes `export { GET, POST }` and points out routes and commands that predate this). When the overlay opens and the reply is newer than the last save, it checks every annotation against the page with its previews removed and opens the list: `applied`, `differs · font-size is 15px, expected 16px`, `missing`, or `check by eye`, beside the agent's line. The panel has a Verify button and _Remove applied_.
- **Beyond Next.js.** `redlining/standalone` bundles React and mounts from a script tag (`data-redlining data-endpoint="off"`) or `mount()`, so the overlay runs on Angular, Vue and plain pages with selector anchors; component names come from Angular's `ng.getComponent` (dev mode) and Vue 3's instance chain, React's owner chain as before. `endpoint: false`, a 404 or an unreachable endpoint make Save download `annotations.md`, `annotations.json` and the images instead. `redlining/vite` can serve the save endpoint from the dev server (`redlining({ endpoint: true })`); the handler moved to `src/server/handler.ts` and `redlining/next/route` re-exports it unchanged.
- **Red.** The accent is now a redline red (`#9e2018` fills, `#b92b22` / `#66150f` text), a recorded divergence from the design canon; pins in screenshots and the docs site follow.
- **Toolbar.** Grouped as modes · list · frame and camera · copy and save · help, settings, corner, close. Clear session moved into the list panel's header. A `?` key and a help button open an in-package help popover with the keys, the loop and links to the docs.
- Copy speaks to any coding agent: the save toast, the help popover and the package description say "run /redline, or hand .redlining/ to your agent"; Claude Code stays the first-class path.
- `class A → B` is printed only when B is on A's scale (`text-sm → text-lg`); a utility from another family is `add class pl-6`, so component classes are never told to be replaced.

## 0.5.0

### Minor Changes

- **Value provenance** in tweak mode: every Inspector field says where its value comes from (`from .text-lg`, `var(--leading) · .prose`, `inherited from <section>`, `inline style`), and sizes nobody sets are labelled `auto · from grid|flex|block`. The export carries it: `font-size: 15px → 17px (class text-base → text-lg)` when a single-class rule in your stylesheet matches the new value, `(from class btn)` otherwise, and `width: auto (180px, laid out by the parent grid) → 220px — … prefer changing the layout` for layout-derived sizes. `Change` gains `source` and `suggestion`.
- Inspector sections (Type, Box, Padding, Margin, Colour, Layout) are collapsed by default and show their values in one line, e.g. `margin 10 0 20 0`; click the heading to open one. Displayed values round to one decimal.

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
