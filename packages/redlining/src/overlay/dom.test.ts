// @vitest-environment jsdom
import { expect, test, vi } from 'vitest'
import { containEvents } from './dom'

function mountHost() {
  const host = document.createElement('div')
  const root = host.attachShadow({ mode: 'open' })
  const button = document.createElement('button')
  root.appendChild(button)
  document.body.appendChild(host)
  return { host, root, button }
}

test('pointer and focus events from inside the overlay stop at the host', () => {
  const { host, root, button } = mountHost()
  const release = containEvents(host)
  const bubbled = vi.fn()
  const captured = vi.fn()
  const inShadow = vi.fn()
  for (const type of ['pointerdown', 'mousedown', 'click', 'focusin']) {
    document.addEventListener(type, bubbled)
    document.addEventListener(type, captured, true)
    root.addEventListener(type, inShadow) // where React's delegation for the portal listens
  }
  button.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }))
  button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }))
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
  button.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }))
  // The page's outside-click and focus-outside dismiss logic (document, bubble) never sees them …
  expect(bubbled).not.toHaveBeenCalled()
  // … the overlay's own capture-phase listeners and React's shadow-root delegation still do.
  expect(captured).toHaveBeenCalledTimes(4)
  expect(inShadow).toHaveBeenCalledTimes(4)

  release()
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
  expect(bubbled).toHaveBeenCalledTimes(1)
})

test('events from the page itself are untouched', () => {
  const { host } = mountHost()
  containEvents(host)
  const bubbled = vi.fn()
  document.addEventListener('pointerdown', bubbled)
  document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
  expect(bubbled).toHaveBeenCalledTimes(1)
})
