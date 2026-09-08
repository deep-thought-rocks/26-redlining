# Code quality review

Date: 2026-09-08

## Summary

This review found 14 actionable issues:

- 2 high-priority issues
- 7 medium-priority issues
- 5 lower-priority issues

The two high-priority endpoint issues can be combined. A malicious website can
send a request to a developer's local save endpoint, and a crafted annotation
index can make an asset path escape `.redlining/`.

## High priority

### 1. Asset filename path traversal

**Evidence**

- `packages/redlining/src/server/handler.ts:63-68`
- `packages/redlining/src/server/handler.ts:82-87`
- `packages/redlining/src/server/handler.ts:112-121`
- `packages/redlining/src/export/assets.ts:21-46`

Runtime session validation checks only the outer session shape. It does not
validate nested annotations or ensure that `annotation.index` is a safe
integer. The index is interpolated into an asset filename and passed to
`path.join()`.

A crafted index containing path separators can therefore write image data
outside the configured output directory.

**Recommendation**

Validate the complete session structure. Require every annotation index to be
a finite positive integer. Independently resolve every asset destination and
confirm that it remains inside `outDir` before writing it.

### 2. Cross-origin save requests

**Evidence**

- `packages/redlining/src/server/handler.ts:52-69`

The POST handler accepts requests regardless of their `Origin` or content
type. A hostile website can send a simple `text/plain` request to a
developer's localhost endpoint. CORS prevents the attacker from reading the
response, but it does not prevent the filesystem write.

**Recommendation**

Reject browser requests whose `Origin` does not match the request origin.
Perform this check before reading or parsing the body. Permit a missing
`Origin` only if direct server or CLI clients need it.

## Medium priority

### 3. The Vite adapter buffers unbounded request bodies

**Evidence**

- `packages/redlining/src/vite.ts:50-57`
- `packages/redlining/src/vite.ts:69-78`
- `packages/redlining/src/vite.ts:105`

The adapter buffers the complete body before the handler applies its 16 MB
limit. Detached handler failures can also become unhandled promise
rejections.

The handler compares JavaScript string length rather than UTF-8 byte length,
so the configured byte limit is not accurate for multibyte input.

**Recommendation**

Enforce the byte limit while streaming the request. Stop reading once the
limit is exceeded. Use UTF-8 byte counts and convert adapter failures into
controlled 4xx or 5xx responses.

### 4. Screenshot failures can leave previews reset

**Evidence**

- `packages/redlining/src/overlay/App.tsx:249-259`
- `packages/redlining/src/overlay/screenshot.ts:97-105`

Before-and-after capture resets every tweak preview and then awaits screenshot
capture. Preview restoration is not in a `finally` block. An exception from
the screenshot import or rendering call leaves the page reset and aborts an
otherwise valid save.

**Recommendation**

Restore previews in a `finally` block. Treat screenshot exceptions as
screenshot-only failures so annotations can still be saved.

### 5. Existing Turbopack rules can be overwritten

**Evidence**

- `packages/redlining/src/next/index.ts:47-50`

The integration replaces existing consumer rules for `*.tsx` and `*.jsx`.
Next.js 16 supports arrays of matching rules that execute in order.

**Recommendation**

Preserve any existing same-key rule and append the Redlining rule using the
documented rule-array form.

### 6. The package peer dependency contract is incomplete

**Evidence**

- `packages/redlining/package.json:97-100`
- `packages/redlining/src/overlay/Redlining.tsx:4`

The regular overlay imports `react-dom`, but the package does not declare it
as a peer dependency. Next.js is a mandatory peer even for Vite and
standalone consumers.

**Recommendation**

Declare `react-dom` version 19 or newer as a peer dependency. Mark Next.js as
optional through `peerDependenciesMeta`. Consider whether React peers should
also be optional for standalone-only consumers.

### 7. Nudging replaces existing transforms

**Evidence**

- `packages/redlining/src/overlay/TweakLayer.tsx:43-65`
- `packages/redlining/src/overlay/preview.ts:60-62`

Nudging writes a new `transform` containing only `translate()`. Existing
rotation, scaling, matrix transforms, and combined transforms are discarded.

**Recommendation**

Use the independent CSS `translate` property, or safely compose the
translation with the element's baseline transform.

### 8. Multiple tweak annotations on one element do not compose

**Evidence**

- `packages/redlining/src/overlay/App.tsx:69-75`
- `packages/redlining/src/overlay/App.tsx:191-203`
- `packages/redlining/src/overlay/preview.ts:44-68`

Each entry resets its element to the original snapshot before applying only
its own changes. A later tweak annotation on the same element therefore
erases the earlier preview.

**Recommendation**

Reset each element once and then replay all of its entries in stable order.
Alternatively, merge tweak changes that target the same element.

### 9. CSS provenance can identify the wrong declaration

**Evidence**

- `packages/redlining/src/overlay/cascade.ts:153-160`
- `packages/redlining/src/overlay/cascade.ts:178-183`

Normal inline declarations are selected before stylesheet `!important`
declarations. The implementation also treats unlayered declarations as
higher priority for both normal and important declarations, but important
cascade-layer ordering is reversed.

This can make an export direct the coding agent to the wrong rule.

**Recommendation**

Compare importance, origin and inline status, layer order, specificity, and
source order in one cascade model.

## Lower priority

### 10. Packed CLI failures are hidden by the smoke test

**Evidence**

- `scripts/smoke-pack.mjs:55`

The packed CLI command ends with `|| true`. A missing CLI file, import error,
or runtime crash therefore still produces a successful smoke-test result.

**Recommendation**

Assert the intended usage exit explicitly. Run the packed `redlining init`
command in a temporary fixture and verify its output and idempotence.

### 11. Interaction layers do not restore existing body styles

**Evidence**

- `packages/redlining/src/overlay/SelectLayer.tsx:93-99`
- `packages/redlining/src/overlay/DrawLayer.tsx:20-25`
- `packages/redlining/src/overlay/TweakLayer.tsx:137-140`
- `packages/redlining/src/overlay/TweakLayer.tsx:207-257`

The overlay clears `body.style.cursor` and `body.style.userSelect` to empty
strings during cleanup. It does not restore the application's original inline
values.

**Recommendation**

Capture the previous inline values when an interaction begins. Restore those
exact values during cleanup.

### 12. The README contradicts the Vite endpoint implementation

**Evidence**

- `README.md:82-86`
- `README.md:154`

The support table advertises `redlining({ endpoint: true })`, while the Vite
setup section says that no non-Next route handler exists.

**Recommendation**

Update the Vite setup paragraph to describe the shipped development-server
endpoint.

### 13. Clipboard failures are silent

**Evidence**

- `packages/redlining/src/overlay/App.tsx:243-246`

Clipboard permission and insecure-context failures reject a promise that the
callers deliberately discard.

**Recommendation**

Catch clipboard failures. Show a clear toast or provide a manual-copy
fallback.

### 14. Important integration paths are tested only with fakes

**Evidence**

- `packages/redlining/src/vite.test.ts`
- `packages/redlining/src/next/index.test.ts`

The Vite middleware and webpack configuration paths are unit-tested with
hand-built objects rather than real development servers. Package or framework
compatibility regressions can therefore pass the existing suite.

**Recommendation**

Add one packed Vite fixture that exercises the transform and endpoint through
a real development server. Add one `next dev --webpack` fixture that verifies
the same anchor behavior as the existing Turbopack fixture.

## Verification

The following checks passed during the review:

- Build
- 136 unit tests across 29 test files
- ESLint
- TypeScript type checking
- Prettier formatting check
- 20 Playwright end-to-end tests
- Packed-package ESM and CommonJS smoke tests

Passing checks do not cover the scenarios described above.
