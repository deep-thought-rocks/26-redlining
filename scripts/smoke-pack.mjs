// Packs the package and imports every public entry from a throwaway consumer
// with plain Node (no bundler), ESM and CJS. Catches what bundlers hide, such as
// extensionless deep imports. Usage: node scripts/smoke-pack.mjs (after pnpm build).
import { execSync } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const root = new URL('..', import.meta.url).pathname
const pkg = path.join(root, 'packages/redlining')
const dir = mkdtempSync(path.join(tmpdir(), 'redlining-smoke-'))
const sh = (cmd, cwd) =>
  execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'inherit'] })
    .toString()
    .trim()

try {
  cpSync(path.join(root, 'README.md'), path.join(pkg, 'README.md'))
  cpSync(path.join(root, 'LICENSE'), path.join(pkg, 'LICENSE'))
  const tarball = sh(`npm pack --pack-destination "${dir}" 2>/dev/null`, pkg).split('\n').pop()
  writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'smoke', private: true, type: 'module' }),
  )
  sh(
    `npm install "./${tarball}" next@16 react@19 react-dom@19 --no-audit --no-fund --loglevel=error`,
    dir,
  )
  writeFileSync(
    path.join(dir, 'esm.mjs'),
    `
const n = await import('redlining/next')
const cfg = await n.withRedlining({})('phase-development-server', { defaultConfig: {} })
if (!cfg.turbopack?.rules?.['*.tsx']) throw new Error('withRedlining did not register rules')
const l = await import('redlining/loader')
if (!l.transform('const x = <div />', 'a.tsx').code.includes('data-rl="a.tsx:1:11"')) throw new Error('transform')
const v = await import('redlining/vite'); if (typeof v.redlining !== 'function') throw new Error('vite')
const r = await import('redlining/next/route'); if (typeof r.POST !== 'function') throw new Error('route')
const i = await import('redlining'); if (typeof i.Redlining !== 'function' || typeof i.stripRedlining !== 'function') throw new Error('index')
const s = await import('redlining/standalone'); if (typeof s.mount !== 'function') throw new Error('standalone')
if (typeof r.GET !== 'function') throw new Error('route GET')
console.log('esm ok')
`,
  )
  writeFileSync(
    path.join(dir, 'cjs.cjs'),
    `
const n = require('redlining/next'); if (typeof n.withRedlining !== 'function') throw new Error('next cjs')
const l = require('redlining/loader'); if (typeof l.default !== 'function' || typeof l.transform !== 'function') throw new Error('loader cjs')
const v = require('redlining/vite'); if (typeof v.redlining !== 'function') throw new Error('vite cjs')
console.log('cjs ok')
`,
  )
  console.log(sh('node esm.mjs', dir))
  console.log(sh('node cjs.cjs', dir))
  console.log(sh('npx redlining 2>&1 || true', dir))
} finally {
  rmSync(path.join(pkg, 'README.md'), { force: true })
  rmSync(path.join(pkg, 'LICENSE'), { force: true })
  rmSync(dir, { recursive: true, force: true })
}
