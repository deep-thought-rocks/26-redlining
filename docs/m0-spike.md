# M0 spike — anchor resolution on Next 16.3 Turbopack

Date: 2026-09-06 · Next 16.3.4 stable and 16.4.0-canary.19 · Node 24.1 · pnpm workspace

Question (PRD §8.3): can `file:line` for a clicked host element come from the fiber's
`_debugStack` with zero build configuration, or does it need the loader (§8.1)?

## Setup

`examples/next-app/app/spike/` holds 20 host elements across a nested layout (Server
Component, elements 1–2), a page (Server Component, 3–14) and a Client Component (15–20),
each tagged `data-spike="N"`. Path A was a throwaway regex loader registered under
`turbopack.rules`; path B was a throwaway client probe that read `fiber._debugStack`,
parsed the V8 frames and posted them to Next's dev endpoint
`POST /__nextjs_original-stack-frames`. Both throwaways were deleted after the spike; the
fixture page is kept for M1 e2e.

## Results

| Path | Stable 16.3.4 | Canary 16.4.0-canary.19 | Notes |
|---|---|---|---|
| A — loader `data-rl` | **20/20** | **20/20** | line:col identical to source for every element, Server and Client Components alike |
| B — `_debugStack` + endpoint | 14/20 | 14/20 | all 14 Server Component elements exact (`about://React/Server/file://…` frames); all 6 Client Component elements fail |
| B — client elements with a server-side path rewrite | 20/20 | 20/20 | works only when the browser chunk URL is rewritten to `file://<projectRoot>/.next/dev/static/chunks/<chunk>` |

Path A and path B agree on every resolved position (e.g. `<main>` → `app/spike/page.tsx:7:5`).
Owner chain via `_debugOwner`: `ClientPart` for 15–20, empty for server-only subtrees, as §8.2 expects.

## What was learned

1. **`turbopack.rules` works for this use.** A webpack-style loader receives `resourcePath`
   and `rootContext`; returning a string is enough. The rule key must be a filename glob
   (`'*.tsx'`) with a `condition` for the path, because a key containing `/` matches the
   path relative to Turbopack's **root**, and in a pnpm workspace that root is the monorepo
   (lockfile location), not the app. `{ not: 'foreign' }` keeps node_modules out.
   The RSC layer is compiled under `.next/dev/server/chunks/ssr/` and the loader runs there.
2. **The endpoint contract** is `{ frames: [{ file, methodName, line1, column1, arguments: [] }],
   isServer, isEdgeServer, isAppDirectory }` → `[{ status: 'fulfilled', value: { originalStackFrame:
   { file, line1, column1, methodName, ignored } } } | { status: 'rejected', reason }]`.
   Server frames arrive virtualised as `about://React/Server/file://…?N` and the endpoint
   devirtualises them itself. Browser frames arrive as `http://localhost/_next/static/chunks/…`
   and are rejected with `Unknown url scheme 'http'`; a bare path resolves to itself; only the
   on-disk `file://` form maps back to source. Next's own devtools take a different route
   (`/__nextjs_source-map` + in-browser mapping), which we would have to reimplement.
3. **A regex loader is not viable** beyond a spike: it stamped `Promise<string | null>` in a
   `.tsx` file and broke the build. The real loader must parse (SWC), per §8.1.

## Decision

**The loader is the default (§8.1); `_debugStack` is not shipped in v1.** The PRD's rule was
20/20 on stable and canary; path B reaches 14/20 unaided and needs two Next internals (the
stack-frame endpoint and the `.next/dev/static/chunks` layout) plus a server hop to reach 20/20.
Path A is 20/20 on both with one documented config surface.

`_debugStack` remains a candidate **fallback for the `ancestor` / `selector-only` rungs**
(§8.5) — it can name the file for undecorated elements in third-party components — and can
be revisited if Next documents the endpoint.

Consequences for M1:
- `withRedlining()` registers `'*.tsx'` / `'*.jsx'` rules with `condition: { all: [{ not: 'foreign' },
  { path: <include regex> }] }`, not path globs, so monorepos work.
- Loader output paths are relative to `rootContext`; normalise to project-relative before stamping.
- The `data-rl` line:col from the loader is the canonical anchor; the probe's numbers matched it
  exactly, so no offset correction is needed.
