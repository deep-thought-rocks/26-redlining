import type { NextConfig } from 'next'
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from 'next/constants.js'
import { describe, expect, test } from 'vitest'
import { withRedlining } from './index'

type ConfigFn = (phase: string, ctx: { defaultConfig: NextConfig }) => NextConfig
const ctx = { defaultConfig: {} }

function resolve(config: ReturnType<typeof withRedlining>, phase: string): NextConfig {
  return (config as ConfigFn)(phase, ctx)
}

describe('withRedlining', () => {
  test('returns the config unchanged outside the dev server phase', () => {
    const config = { reactStrictMode: true }
    expect(resolve(withRedlining(config), PHASE_PRODUCTION_BUILD)).toEqual(config)
  })

  test('registers a Turbopack rule per JSX extension in the dev phase', () => {
    const out = resolve(withRedlining({}), PHASE_DEVELOPMENT_SERVER)
    const rules = out.turbopack?.rules as Record<
      string,
      { loaders: { loader: string; options: { projectRoot: string } }[]; condition: unknown }
    >
    expect(Object.keys(rules).sort()).toEqual(['*.jsx', '*.tsx'])
    const rule = rules['*.tsx']!
    expect(rule.loaders).toHaveLength(1)
    expect(rule.loaders[0]!.loader.endsWith('loader.cjs')).toBe(true)
    expect(rule.loaders[0]!.options.projectRoot).toBe(process.cwd())
    expect(JSON.stringify(rule.condition)).toContain('foreign')
  })

  test('keeps existing Turbopack rules and existing config keys', () => {
    const out = resolve(
      withRedlining({
        reactStrictMode: true,
        turbopack: { rules: { '*.svg': { loaders: ['x'], as: '*.js' } } },
      }),
      PHASE_DEVELOPMENT_SERVER,
    )
    expect(out.reactStrictMode).toBe(true)
    expect(Object.keys(out.turbopack!.rules!).sort()).toEqual(['*.jsx', '*.svg', '*.tsx'])
  })

  test('appends to a consumer rule on the same glob instead of replacing it', () => {
    const mine = { loaders: ['my-loader'], as: '*.tsx' }
    const out = resolve(
      withRedlining({ turbopack: { rules: { '*.tsx': mine, '*.jsx': [mine] } } }),
      PHASE_DEVELOPMENT_SERVER,
    )
    const tsx = out.turbopack!.rules!['*.tsx'] as unknown[]
    expect(Array.isArray(tsx)).toBe(true)
    expect(tsx[0]).toBe(mine)
    expect(tsx[1]).toMatchObject({
      loaders: [expect.objectContaining({ loader: expect.stringContaining('loader') })],
    })
    const jsx = out.turbopack!.rules!['*.jsx'] as unknown[]
    expect(jsx).toHaveLength(2)
    expect(jsx[0]).toBe(mine)
  })

  test('adds a pre-loader rule through the webpack hook in dev, composing an existing hook', () => {
    let seen = false
    const out = resolve(
      withRedlining({
        webpack: (cfg) => {
          seen = true
          return cfg
        },
      }),
      PHASE_DEVELOPMENT_SERVER,
    )
    const webpackConfig = { module: { rules: [] as unknown[] } }
    const result = out.webpack!(webpackConfig, {
      dev: true,
      isServer: false,
    } as never) as typeof webpackConfig
    expect(seen).toBe(true)
    expect(result.module.rules).toHaveLength(1)
    expect(result.module.rules[0]).toMatchObject({ enforce: 'pre', test: /\.(tsx|jsx)$/ })
  })

  test('accepts a function config and forwards the phase', () => {
    const out = withRedlining((phase) => ({ env: { PHASE: phase } }))
    expect(resolve(out, PHASE_PRODUCTION_BUILD)).toEqual({ env: { PHASE: PHASE_PRODUCTION_BUILD } })
    expect(resolve(out, PHASE_DEVELOPMENT_SERVER).turbopack?.rules).toBeDefined()
  })

  test('respects a custom include list', () => {
    const out = resolve(withRedlining({}, { include: ['features'] }), PHASE_DEVELOPMENT_SERVER)
    const rule = (out.turbopack!.rules as Record<string, { condition: unknown }>)['*.tsx']!
    const cond = JSON.stringify(rule.condition, (_k, v) => (v instanceof RegExp ? v.source : v))
    expect(cond).toContain('features')
    expect(cond).not.toContain('components')
  })
})
