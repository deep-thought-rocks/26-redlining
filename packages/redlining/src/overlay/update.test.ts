// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { fetchLatest, isNewer } from './update'

describe('isNewer', () => {
  test('compares numeric semver parts and treats dev as never newer', () => {
    expect(isNewer('0.6.5', '0.6.4')).toBe(true)
    expect(isNewer('0.7.0', '0.6.9')).toBe(true)
    expect(isNewer('1.0.0', '0.9.9')).toBe(true)
    expect(isNewer('0.6.4', '0.6.4')).toBe(false)
    expect(isNewer('0.6.3', '0.6.4')).toBe(false)
    expect(isNewer('0.6.5', 'dev')).toBe(false)
  })
})

describe('fetchLatest', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  test('asks the registry once and caches for a day; automation gets nothing', async () => {
    Object.defineProperty(navigator, 'webdriver', { value: false, configurable: true })
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ version: '0.9.0' })))
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchLatest(localStorage, 1000)).toBe('0.9.0')
    expect(await fetchLatest(localStorage, 2000)).toBe('0.9.0')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(await fetchLatest(localStorage, 1000 + 25 * 60 * 60 * 1000)).toBe('0.9.0')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    Object.defineProperty(navigator, 'webdriver', { value: true, configurable: true })
    localStorage.clear()
    expect(await fetchLatest(localStorage, 1000)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test('offline or a bad answer yields null without throwing', async () => {
    Object.defineProperty(navigator, 'webdriver', { value: false, configurable: true })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('offline'))),
    )
    expect(await fetchLatest(localStorage, 1000)).toBeNull()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 200 })),
    )
    expect(await fetchLatest(localStorage, 1000)).toBeNull()
  })
})
