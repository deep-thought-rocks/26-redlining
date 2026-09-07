import { describe, expect, test } from 'vitest'
import { redlining } from './vite'

describe('vite plugin', () => {
  test('stamps included tsx/jsx files relative to the resolved root and skips the rest', () => {
    const plugin = redlining()
    plugin.configResolved({ root: '/proj' })
    const out = plugin.transform('const x = <div />', '/proj/src/App.tsx?import')
    expect(out?.code).toBe('const x = <div data-rl="src/App.tsx:1:11" />')
    expect(out?.map).toMatchObject({ version: 3, sources: ['src/App.tsx'] })
    expect(plugin.transform('const x = <div />', '/proj/lib/x.tsx')).toBeNull()
    expect(plugin.transform('const x = <div />', '/proj/src/x.ts')).toBeNull()
    expect(plugin.transform('const x = <div />', '/proj/node_modules/pkg/src/x.tsx')).toBeNull()
    expect(plugin.transform('const x = 1', '/proj/src/plain.tsx')).toBeNull()
  })

  test('honours include and an explicit projectRoot, and only applies to serve', () => {
    const plugin = redlining({ include: ['app', 'components/'], projectRoot: '/p' })
    plugin.configResolved({ root: '/ignored' })
    expect(plugin.transform('<a />', '/p/components/B.jsx')?.code).toBe(
      '<a data-rl="components/B.jsx:1:1" />',
    )
    expect(plugin.transform('<a />', '/p/src/A.tsx')).toBeNull()
    expect(plugin.apply).toBe('serve')
    expect(plugin.enforce).toBe('pre')
  })
})
