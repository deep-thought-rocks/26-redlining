// @vitest-environment jsdom
import { afterEach, describe, expect, test } from 'vitest'
import { angularOwners, owners, vueOwners } from './owners'

class AppComponent {}
class CardComponent {}

afterEach(() => {
  delete (window as unknown as { ng?: unknown }).ng
})

describe('owners', () => {
  test('Angular: walks getOwningComponent from the element, outermost first', () => {
    const app = new AppComponent()
    const card = new CardComponent()
    const el = document.createElement('h2')
    ;(window as unknown as { ng: unknown }).ng = {
      getComponent: (target: Element) => (target === el ? null : null),
      getOwningComponent: (target: unknown) =>
        target === el ? card : target === card ? app : null,
    }
    expect(angularOwners(el)).toEqual(['AppComponent', 'CardComponent'])
    expect(owners(el)).toEqual(['AppComponent', 'CardComponent'])
  })

  test('Vue 3: follows the internal instance parents', () => {
    const el = document.createElement('p') as HTMLElement & { __vueParentComponent?: unknown }
    el.__vueParentComponent = {
      type: { __name: 'ReportRow' },
      parent: { type: { name: 'Dashboard' }, parent: { type: {}, parent: null } },
    }
    expect(vueOwners(el)).toEqual(['Dashboard', 'ReportRow'])
    expect(owners(el)).toEqual(['Dashboard', 'ReportRow'])
  })

  test('nothing detected: empty, and a throwing ng global is ignored', () => {
    expect(owners(document.createElement('div'))).toEqual([])
    ;(window as unknown as { ng: unknown }).ng = {
      getComponent: () => {
        throw new Error('not in dev mode')
      },
    }
    expect(owners(document.createElement('div'))).toEqual([])
  })
})
