# redlining

## 0.1.0

### Minor Changes

- First release. Figma-style comments on a running Next.js app, exported as a file-anchored spec for Claude Code.

  - `withRedlining()` registers a dev-only loader (Turbopack and webpack) that stamps host JSX elements with `data-rl="file:line:col"`; Server and Client Components alike.
  - `<Redlining />` overlay in a shadow root: select, draw and move modes, numbered pins, ancestor walking, multi-select, list panel, per-route session persistence, a 15-annotation cap, and a screenshot with burned-in pins.
  - Markdown + JSON export; `POST /api/redlining` writes `.redlining/`; `npx redlining init` scaffolds the route, the gitignore entry and the `/redline` Claude Code command.
  - `redlining/vite` plugin on the same transform.
  - Zero production footprint: the loader is dev-only and the package's `production` export is a null component.

  The annotation file format is unstable until 1.0.
