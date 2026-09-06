import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { Redlining } from './Redlining'

test('renders nothing when disabled', () => {
  expect(renderToStaticMarkup(<Redlining enabled={false} />)).toBe('')
})

test('server-renders only the empty host when enabled; the shadow root mounts on the client', () => {
  const html = renderToStaticMarkup(<Redlining enabled />)
  expect(html).toContain('data-redlining=""')
  expect(html).toContain('data-theme="light"')
  expect(html).not.toContain('rl-toolbar')
})
