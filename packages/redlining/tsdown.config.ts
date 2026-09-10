import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsdown'

const VERSION = JSON.stringify(
  (
    JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
      version: string
    }
  ).version,
)

// PRD §12: ESM + CJS for the config/loader entries (consumed by next.config
// and the bundler), ESM only for the overlay and the route handler.
export default defineConfig([
  {
    // The overlay is a client component; the bundler drops the directive, so
    // it is re-added as a banner. React comes from the host app.
    entry: { index: 'src/index.ts', 'index.prod': 'src/index.prod.ts' },
    format: 'esm',
    platform: 'neutral',
    define: { __REDLINING_VERSION__: VERSION },
    dts: true,
    banner: { js: "'use client';" },
    deps: { neverBundle: ['react', 'react-dom', /^react\//] },
  },
  {
    // The route handler runs in the Node runtime: it writes files.
    entry: { 'next/route': 'src/next/route.ts' },
    format: 'esm',
    platform: 'node',
    define: { __REDLINING_VERSION__: VERSION },
    dts: true,
  },
  {
    entry: { next: 'src/next/index.ts', loader: 'src/loader/index.ts', vite: 'src/vite.ts' },
    format: ['esm', 'cjs'],
    platform: 'node',
    define: { __REDLINING_VERSION__: VERSION },
    dts: true,
    // The loader entry has a default export (the loader) and named ones (transform).
    outputOptions: { exports: 'named' },
    // magic-string is ESM-only; bundling it avoids a broken CJS default-import interop.
    deps: { alwaysBundle: ['magic-string'] },
  },
  {
    // Everything bundled, for pages without a React toolchain (vanilla, Angular, Vue):
    // dev-only by contract, so NODE_ENV is fixed and there is no production stub.
    entry: { standalone: 'src/standalone.tsx' },
    format: 'esm',
    platform: 'browser',
    dts: true,
    minify: true,
    define: { 'process.env.NODE_ENV': '"development"', __REDLINING_VERSION__: VERSION },
    deps: {
      alwaysBundle: [
        'react',
        'react-dom',
        /^react-dom\//,
        /^react\//,
        'lucide-react',
        'html-to-image',
      ],
    },
    outputOptions: { codeSplitting: false },
  },
  {
    entry: { cli: 'src/cli/index.ts' },
    format: 'esm',
    platform: 'node',
    define: { __REDLINING_VERSION__: VERSION },
    dts: false,
  },
])
