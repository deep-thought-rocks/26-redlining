# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## State of the repo

Scaffold only. Every package entry is a stub with a smoke test; no feature code exists yet. The PRD at `docs/redlining-prd.md` is the single source of truth for scope, data model, export format and architecture — read it before implementing anything, and treat its section numbers (§6 data model, §8 anchor resolution, §9 export format, §11 package layout) as the reference for naming and structure. M0 is done: `docs/m0-spike.md` records the anchor-resolution decision (loader is the default; `_debugStack` is not shipped in v1) and the Turbopack rule shape that works in a pnpm workspace. Next milestone: M1 (PRD §14).

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
```

The example app consumes `redlining` through `workspace:*` and resolves the built `dist/`, so rebuild the package before running or typechecking the example. `next dev` regenerates `examples/next-app/AGENTS.md` and `CLAUDE.md`; commit them rather than fighting them.

## Layout and stack (PRD §11–12)

pnpm monorepo: `packages/redlining/` (published as unscoped npm `redlining`) with `src/overlay/` (React + Shadow DOM + Tailwind 4), `src/resolve/` (fiber walk, container resolution), `src/export/` (Markdown/JSON serializers), `src/next/` (`withRedlining()`, route handler), `src/loader/` (`transform`), `src/cli/` (`redlining init`); plus `examples/next-app/` as the Playwright target.

Build shape in `tsdown.config.ts`: `.` and `./next/route` are ESM-only with `platform: neutral`; `./next` and `./loader` are ESM + CJS (`.mjs`/`.cjs`) so `next.config` can load them either way; the CLI is ESM with no d.ts. The bundler strips `'use client'`, so the overlay entry re-adds it via `banner` — keep the overlay in its own config block for that reason. React is never bundled.

TypeScript 5.9 strict (not 7: typescript-eslint caps below 6.1), Vitest 5 in node environment, ESLint 10 flat + typescript-eslint + react-hooks + prettier-compat, Changesets (config written by hand; `changeset init` needs a TTY). Not yet set up: Playwright, Tailwind in the overlay, CI.

## Design decisions that constrain code

These are settled in the PRD; do not reopen them without asking.

- **Zero production footprint.** `<Redlining />` returns `null` outside `NODE_ENV === 'development'` so it dead-code-eliminates; `withRedlining()` is a no-op outside `PHASE_DEVELOPMENT_SERVER`; the route handler refuses outside dev. CI will assert 0 bytes and no `data-rl` in `next build` output.
- **Loader decorates host elements only** (lowercase JSX tags) with `data-rl="<relpath>:<line>:<col>"`. Never decorate components — it leaks an unknown prop. Component identity comes from the runtime fiber walk instead.
- **Loader is SWC-based, not Babel.** Turbopack does not run Babel and a Babel config would disable SWC. Parse with `@swc/core` (resolved from Next), emit source maps via `magic-string`. Same loader is registered under `turbopack.rules` and the `webpack()` fallback.
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
