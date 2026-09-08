import { createRequire } from 'node:module'
import path from 'node:path'
import type { NextConfig } from 'next'
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js'

export interface RedliningOptions {
  /** Project-relative directories whose `.tsx`/`.jsx` files get anchors. */
  include?: string[]
}

type ConfigContext = { defaultConfig: NextConfig }
type ConfigFn = (phase: string, ctx: ConfigContext) => NextConfig | Promise<NextConfig>
type WebpackHook = NonNullable<NextConfig['webpack']>
type TurbopackRules = NonNullable<NonNullable<NextConfig['turbopack']>['rules']>

const DEFAULT_INCLUDE = ['app', 'components', 'src']
const LOADER = createRequire(import.meta.url).resolve('redlining/loader')

/**
 * Registers the Redlining loader for the development server only. Returns a
 * config function, which Next.js accepts in place of a plain object.
 */
export function withRedlining(
  config: NextConfig | ConfigFn = {},
  options: RedliningOptions = {},
): ConfigFn {
  const include = options.include ?? DEFAULT_INCLUDE
  return (phase, ctx) => {
    const base = typeof config === 'function' ? config(phase, ctx) : config
    if (phase !== PHASE_DEVELOPMENT_SERVER) return base
    return base instanceof Promise ? base.then((b) => apply(b, include)) : apply(base, include)
  }
}

function apply(base: NextConfig, include: string[]): NextConfig {
  const projectRoot = process.cwd()
  const loader = { loader: LOADER, options: { projectRoot } }
  // Turbopack's root can be a workspace above the project (it follows the
  // lockfile), so paths are matched with a regex instead of a root-relative glob.
  const dirs = include
    .map((d) => d.replace(/[/\\]+$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
  const rule = (ext: string) => ({
    condition: { all: [{ not: 'foreign' }, { path: new RegExp(`(^|/)(${dirs})/.*\\.${ext}$`) }] },
    loaders: [loader],
  })
  // A consumer's own rule for the same glob is kept: Next runs an array of rules in order.
  const withExisting = (glob: string, ours: ReturnType<typeof rule>) => {
    const existing = base.turbopack?.rules?.[glob]
    if (!existing) return ours
    return [...(Array.isArray(existing) ? existing : [existing]), ours]
  }
  const rules: TurbopackRules = {
    ...base.turbopack?.rules,
    '*.tsx': withExisting('*.tsx', rule('tsx')),
    '*.jsx': withExisting('*.jsx', rule('jsx')),
  }

  const webpack: WebpackHook = (webpackConfig, wctx) => {
    const prev = base.webpack ? base.webpack(webpackConfig, wctx) : webpackConfig
    if (wctx.dev) {
      prev.module ??= { rules: [] }
      prev.module.rules ??= []
      prev.module.rules.push({
        enforce: 'pre',
        test: /\.(tsx|jsx)$/,
        include: include.map((d) => path.join(projectRoot, d)),
        use: [loader],
      })
    }
    return prev
  }

  return { ...base, turbopack: { ...base.turbopack, rules }, webpack }
}
