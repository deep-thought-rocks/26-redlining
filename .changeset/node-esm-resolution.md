---
'redlining': patch
---

`redlining/next` now imports `next/constants.js` with its extension, so an ESM `next.config.mjs` (plain Node resolution, no bundler) loads `withRedlining` again. A packed-tarball smoke test in CI now imports every entry with plain Node.
