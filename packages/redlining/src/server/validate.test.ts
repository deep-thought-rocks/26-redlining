import { describe, expect, test } from 'vitest'
import { crossOrigin, parseSession } from './validate'

const base = {
  route: '/x',
  url: 'http://l/x',
  viewport: { w: 1, h: 1 },
  annotations: [
    {
      id: 'a',
      index: 1,
      action: 'change',
      anchor: {
        tag: 'p',
        owners: [],
        selector: 'p',
        rect: { x: 0, y: 0, w: 1, h: 1 },
        resolved: 'exact',
      },
      note: 'n',
    },
  ],
}

describe('parseSession', () => {
  test('accepts a well-formed session, crops and one level of others', () => {
    const r = parseSession({ ...base, crops: { '1': 'data:image/png;base64,AA' }, others: [base] })
    expect('session' in r).toBe(true)
  })

  test.each([
    [null, 'Expected { session }'],
    [{ ...base, route: 1 }, 'route and url must be strings'],
    [{ ...base, viewport: {} }, 'viewport must be { w, h }'],
    [{ ...base, annotations: 'x' }, 'annotations must be an array'],
    [
      { ...base, annotations: [{ ...base.annotations[0], index: '../../../../tmp/pwned' }] },
      'annotations[0].index must be a positive integer',
    ],
    [
      { ...base, annotations: [{ ...base.annotations[0], index: 0 }] },
      'annotations[0].index must be a positive integer',
    ],
    [
      { ...base, annotations: [{ ...base.annotations[0], index: 1.5 }] },
      'annotations[0].index must be a positive integer',
    ],
    [
      { ...base, annotations: [{ ...base.annotations[0], action: 'delete' }] },
      'annotations[0].action is not one of change, add, remove, move',
    ],
    [
      { ...base, annotations: [{ ...base.annotations[0], anchor: null }] },
      'annotations[0].anchor must be an object',
    ],
    [
      { ...base, annotations: [{ ...base.annotations[0], note: 3 }] },
      'annotations[0].note must be a string',
    ],
    [
      { ...base, annotations: [{ ...base.annotations[0], refs: [1] }] },
      'annotations[0].refs must be an array of strings',
    ],
    [{ ...base, crops: { '../x': 'data:' } }, 'crops key "../x" must be a positive integer'],
    [{ ...base, crops: { '2': 3 } }, 'crops["2"] must be a string'],
    [{ ...base, screenshot: {} }, 'screenshot must be a string'],
    [{ ...base, others: [{ ...base, route: 5 }] }, 'others[0]: route and url must be strings'],
    [{ ...base, others: [{ ...base, others: [base] }] }, 'others[0]: others cannot nest'],
  ])('rejects %j', (value, error) => {
    expect(parseSession(value)).toEqual({ error })
  })
})

describe('crossOrigin', () => {
  const req = (headers: Record<string, string>, url = 'http://localhost:3000/api/redlining') =>
    new Request(url, { method: 'POST', headers })
  test('allows same-origin, loopback aliases, and header-less requests', () => {
    expect(crossOrigin(req({}))).toBeNull()
    expect(crossOrigin(req({ origin: 'http://localhost:3000' }))).toBeNull()
    expect(crossOrigin(req({ origin: 'http://127.0.0.1:3000' }))).toBeNull()
    expect(
      crossOrigin(req({ origin: 'http://localhost:3000', 'sec-fetch-site': 'same-origin' })),
    ).toBeNull()
    expect(crossOrigin(req({ 'sec-fetch-site': 'none' }))).toBeNull()
  })
  test('refuses other origins, other ports, cross-site fetches and null origins', () => {
    expect(crossOrigin(req({ origin: 'https://evil.example' }))).toBe(
      'Origin https://evil.example is not this server',
    )
    expect(crossOrigin(req({ origin: 'http://localhost:5173' }))).toBe(
      'Origin http://localhost:5173 is not this server',
    )
    expect(
      crossOrigin(req({ origin: 'http://localhost:3000', 'sec-fetch-site': 'cross-site' })),
    ).toBe('Sec-Fetch-Site is cross-site')
    expect(crossOrigin(req({ origin: 'null' }))).toBe('Origin is null')
    expect(crossOrigin(req({ origin: 'not a url' }))).toBe('Origin is not a URL')
  })
})
