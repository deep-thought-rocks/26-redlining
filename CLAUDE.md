# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## State of the repo

M1 feature-complete as of 2026-09-06: loader, resolve core, export, route handler, `redlining init`, the overlay (select + draw, pins, note popover, list panel, copy/save) and a Playwright e2e suite on the fixture page. README (PRD §17.3) and CI (`.github/workflows/ci.yml`: checks, production-footprint assertion, e2e, weekly next@canary job) are in place. M2 is done as of 2026-09-06: move mode, screenshot with burned-in pins, multi-select (`Annotation.anchors`), per-route session persistence, the 15-annotation cap, and Option+scroll ancestor walking. M3 as of 2026-09-07: `redlining/vite` shipped, animated README demo (`scripts/record-demo.mjs` + ffmpeg → `docs/images/overlay.gif`), 0.1.0 versioned via Changesets with an annotated local tag `v0.1.0`; docs stay README-only. Not done and the user's call: push, npm publish (and reserving `vite-plugin-redlining`), and the PRD §9.1 scenario round-tripping through Claude Code on a real project.

## What Redlining is

A dev-only overlay for Next.js 16+ apps. The developer clicks an element or draws a box in the running app, writes a note, and every annotation resolves to `file:line` + host element + React owner chain. The batch exports to `.redlining/annotations.md` (+ JSON, optional screenshot) and a `/redline` slash command hands it to Claude Code. Redlining never edits code.

## Commands

Node 24 (`.nvmrc`); tsdown needs ≥ 22.18. If `node -v` shows 22.12, a stale `/usr/local/bin/node` is shadowing Homebrew's — prefix with `PATH=/opt/homebrew/bin:$PATH`.

```sh
pnpm install
pnpm build        # packages/* via tsdown → packages/redlining/dist
pnpm test         # vitest across packages/*
pnpm lint         # eslint flat config at root
pnpm typecheck    # tsc per package; example runs `next typegen` first
pnpm format:check # prettier; docs/ is ignored (PRD is hand-formatted)
pnpm --filter redlining test -- src/loader          # one test dir
pnpm --filter redlining exec vitest run -t 'name'   # one test by name
pnpm --filter next-app dev                          # example app; needs a prior `pnpm build`
pnpm e2e                                            # Playwright; starts its own `next dev` on :3199, needs a prior `pnpm build`
pnpm --filter redlining vendor-tokens               # re-vendor design tokens from the canon
```

The example app consumes `redlining` through `workspace:*` and resolves the built `dist/`, so rebuild the package before running or typechecking the example. `next dev` regenerates `examples/next-app/AGENTS.md` and `CLAUDE.md`; commit them rather than fighting them.

## Layout and stack (PRD §11–12)

pnpm monorepo: `packages/redlining/` (published as unscoped npm `redlining`) with `src/overlay/` (React + Shadow DOM + Tailwind 4), `src/resolve/` (fiber walk, container resolution), `src/export/` (Markdown/JSON serializers), `src/next/` (`withRedlining()`, route handler), `src/loader/` (`transform`), `src/vite.ts` (the Vite plugin on the same transform), `src/cli/` (`redlining init`); plus `examples/next-app/` as the Playwright target.

Build shape in `tsdown.config.ts`: `.` and `./next/route` are ESM-only with `platform: neutral`; `./next`, `./loader` and `./vite` are ESM + CJS (`.mjs`/`.cjs`) so `next.config` can load them either way; the CLI is ESM with no d.ts. The bundler strips `'use client'`, so the overlay entry re-adds it via `banner` — keep the overlay in its own config block for that reason. React is never bundled.

TypeScript 5.9 strict (not 7: typescript-eslint caps below 6.1), Vitest 5 in node environment, ESLint 10 flat + typescript-eslint + react-hooks + prettier-compat, Changesets (config written by hand; `changeset init` needs a TTY). Playwright lives at the root (`playwright.config.ts`, `e2e/`); Chromium was installed with `pnpm exec playwright install chromium`.

## Overlay conventions

- **Shadow DOM host.** `<Redlining />` renders a 0×0 absolutely positioned host with `data-theme` and portals the app into its shadow root. The host is at page origin, so `.rl-layer` children positioned in page coordinates (`pageRect`) scroll with the page; `.rl-fixed` elements (toolbar, panel, toast) are viewport-fixed. Host page pointer events are intercepted with capture-phase listeners on `document`, never with a covering layer, so `elementFromPoint` keeps working. Layouts must ignore the host (`layoutIgnoring`).
- **Styles are plain CSS on the vendored tokens**, not Tailwind (design-system divergence D4). `tokens.generated.ts` is produced by `scripts/vendor-tokens.mjs` from the canon; never edit it by hand. Overlay rules live in `styles.ts` under the `rl-` prefix.
- **Keyboard.** Letter hotkeys match on `event.code` (macOS Option+R types `®`). Editors inside the overlay stop propagation of Escape/Enter, because the window handler would otherwise see the same keypress after React has already committed the state change and close the overlay.
- **Extend mode.** While a select note is open the select layer stays mounted with `onExtend`; only Shift+clicks reach it, other page clicks are swallowed. `Draft.extra` becomes `Annotation.anchors` (primary first) on save; `Entry.extraElements` mirrors it for pins and must be stripped wherever `element` is (`toSession`, `saveEntries`).
- **Screenshot.** `captureScreenshot` lazily imports `html-to-image`, filters out the host, paints pins via `drawPins` (unit-tested with a recording canvas), and refuses results over 7 MB so the route's 8 MB cap holds.
- **Click after hover.** `SelectLayer` keeps the hover target in a ref, not only state: a click can follow a mousemove before React commits.
- **Zero production bytes.** `package.json` exports `.` with a `production` condition → `dist/index.prod.js` (`Redlining` returns null); the component also checks `NODE_ENV`. Verified: a `next build` of the example has no overlay class names in client bundles; the floor is the `return null` stub the layout imports (~30 bytes), which only the consumer can remove.

## Design decisions that constrain code

These are settled in the PRD; do not reopen them without asking.

- **Zero production footprint.** `<Redlining />` returns `null` outside `NODE_ENV === 'development'` so it dead-code-eliminates; `withRedlining()` is a no-op outside `PHASE_DEVELOPMENT_SERVER`; the route handler refuses outside dev. CI will assert 0 bytes and no `data-rl` in `next build` output.
- **Loader decorates host elements only** (lowercase JSX tags) with `data-rl="<relpath>:<line>:<col>"`. Never decorate components — it leaks an unknown prop. Component identity comes from the runtime fiber walk instead.
- **Loader parses with `@babel/parser`, not SWC.** The PRD assumed `@swc/core` comes with Next; it does not (Next ships only its own native bindings behind an undocumented `parse`). `@babel/parser` is parse-only, pure JS, no native binaries, and never touches Next's SWC compile pipeline. `magic-string` writes the stamp and the source map and is **bundled into `dist/loader.*`** (it is ESM-only and rolldown's CJS interop hands `new` the namespace object). The map is passed to the bundler as an **object**: webpack's downstream SWC loader rejects JSON text.
- **Rules match by filename glob plus a path regex, not root-relative globs.** Turbopack's root follows the lockfile, so in a pnpm workspace `app/**` never matches `examples/next-app/app/…`. `withRedlining` registers `'*.tsx'`/`'*.jsx'` with `condition: { all: [{ not: 'foreign' }, { path: /(^|\/)(app|components|src)\/.*\.tsx$/ }] }` and a webpack `enforce: 'pre'` rule with absolute `include` dirs. Stamped paths are relative to `projectRoot` (`process.cwd()` at config time), passed as a plain loader option.
- **Resolvers never touch the DOM's geometry directly.** `anchorFor` and `resolveContainer` take a `Layout` (`rectOf`, `elementsFromPoint`); `domLayout(document)` is the real one and tests inject rects, because jsdom has no layout and no `elementsFromPoint`. Resolve tests opt into jsdom per file with `// @vitest-environment jsdom`; everything else stays in node.
- **`Anchor.file`/`line` are optional**, unlike the PRD §6 sketch, so a `selector-only` anchor is typed honestly instead of carrying an empty path. `box.childIndex` means "insert before child N"; `children.length` is "at end".
- **`withRedlining` returns a config function** so it can see the phase; rules exist only under `PHASE_DEVELOPMENT_SERVER`, and a function config passed in is composed, sync or async.
- **React internals are quarantined.** `__reactFiber$…` and `fiber._debugOwner` live only in `resolve/fiber.ts`, feature-detected, degrading to file:line-only when absent. Server-only subtrees have no client fiber: `owners` is `[]` and the anchor is still exact via `data-rl`.
- **Pure cores.** `src/resolve/`, `src/export/` and the loader `transform(src, filename) → { code, map }` are pure functions with no DOM or Next dependency, so they are unit-testable and formatters stay pluggable.
- **Overlay isolation.** Shadow DOM host; Tailwind compiled to a CSS string injected into the shadow root; no global CSS; when inactive only the `Alt+R` hotkey listener exists and no pointer events are captured.
- **Route handler safety.** Writes only under `<projectRoot>/.redlining/`, path-validated, body capped (screenshot ≤ 8 MB).
- **Anchor fallback ladder** is `exact` → `ancestor` → `selector-only` (§8.5); the export must state which one applied.
- **`redlining init` is idempotent** and never touches `CLAUDE.md` (Next 16.3 manages its own block there).
- Open M0 spike (§8.3): the `_debugStack` path may replace the loader as default if it passes 20/20 sample elements incl. Server Components on 16.3 stable and canary. Until decided, the loader is the default.

## Naming

Package `redlining`; `withRedlining` from `redlining/next`; component `<Redlining />`; output dir `.redlining/`; command `/redline` (short form, deliberately). Config options and their defaults are listed in PRD §17.2 — add new knobs there first.

## Design system

The overlay adopts **silverballmania** v2.0.0 from `~/Repositories/design-systems/silverballmania/`. `.claude/design-system.json` is the single source of truth for the assignment, theme policy (light default), divergences and open gaps; read it before styling anything in `src/overlay/`. The canon's `SKILL.md` and `README.md § Design tokens` carry the rules. Components use only `--color-*` semantic tokens, never `--sbm-*` raw values.
