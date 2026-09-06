import { defineConfig } from 'tsdown'

// PRD §12: ESM + CJS for the config/loader entries (consumed by next.config
// and the bundler), ESM only for the overlay and the route handler.
export default defineConfig([
  {
    // The overlay is a client component; the bundler drops the directive, so
    // it is re-added as a banner. React comes from the host app.
    entry: { index: 'src/index.ts' },
    format: 'esm',
    platform: 'neutral',
    dts: true,
    banner: { js: "'use client';" },
    deps: { neverBundle: ['react', 'react-dom', /^react\//] },
  },
  {
    entry: { 'next/route': 'src/next/route.ts' },
    format: 'esm',
    platform: 'neutral',
    dts: true,
  },
  {
    entry: { next: 'src/next/index.ts', loader: 'src/loader/index.ts' },
    format: ['esm', 'cjs'],
    platform: 'node',
    dts: true,
  },
  {
    entry: { cli: 'src/cli/index.ts' },
    format: 'esm',
    platform: 'node',
    dts: false,
  },
])
