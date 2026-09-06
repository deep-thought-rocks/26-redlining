import { expect, test, vi } from 'vitest'
import redliningLoader, { type LoaderContext } from './index'

const source = 'const x = <div />'

test('stamps paths relative to projectRoot and hands code and map to the callback', () => {
  const callback = vi.fn()
  const ctx: LoaderContext = {
    resourcePath: '/repo/apps/web/app/page.tsx',
    getOptions: () => ({ projectRoot: '/repo/apps/web' }),
    callback,
  }
  expect(redliningLoader.call(ctx, source)).toBeUndefined()
  const [err, code, map] = callback.mock.calls[0]!
  expect(err).toBeNull()
  expect(code).toBe('const x = <div data-rl="app/page.tsx:1:11" />')
  expect(map).toMatchObject({ version: 3, sources: ['app/page.tsx'] })
})

test('falls back to rootContext, query options, and a plain return value', () => {
  const ctx: LoaderContext = {
    resourcePath: '/repo/app/page.tsx',
    rootContext: '/repo',
    query: {},
  }
  expect(redliningLoader.call(ctx, source)).toBe('const x = <div data-rl="app/page.tsx:1:11" />')
})
