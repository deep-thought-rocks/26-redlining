// @vitest-environment jsdom
import { describe, expect, test } from 'vitest'
import { ownerChain } from './fiber'

function attach(el: Element, fiber: unknown) {
  ;(el as unknown as Record<string, unknown>)['__reactFiber$abc123'] = fiber
}

describe('ownerChain', () => {
  test('walks _debugOwner and returns names outermost first', () => {
    const el = document.createElement('nav')
    function RootLayout() {}
    function Header() {}
    function MainNav() {}
    attach(el, {
      _debugOwner: {
        type: MainNav,
        _debugOwner: { type: Header, _debugOwner: { type: RootLayout } },
      },
    })
    expect(ownerChain(el)).toEqual(['RootLayout', 'Header', 'MainNav'])
  })

  test('prefers displayName and unwraps memo/forwardRef objects, skipping unnamed owners', () => {
    const el = document.createElement('div')
    const Named = Object.assign(function () {}, { displayName: 'Fancy' })
    const memo = { type: function Inner() {} }
    const forwarded = { render: function Ref() {} }
    attach(el, {
      _debugOwner: {
        type: memo,
        _debugOwner: {
          type: forwarded,
          _debugOwner: { type: Named, _debugOwner: { type: 'div' } },
        },
      },
    })
    expect(ownerChain(el)).toEqual(['Fancy', 'Ref', 'Inner'])
  })

  test('returns [] without a fiber, without _debugOwner, or with a non-object fiber', () => {
    expect(ownerChain(document.createElement('p'))).toEqual([])
    const a = document.createElement('p')
    attach(a, { type: 'p' })
    expect(ownerChain(a)).toEqual([])
    const b = document.createElement('p')
    attach(b, 42)
    expect(ownerChain(b)).toEqual([])
  })
})
