import { expect, test } from 'vitest'
import { parseReply } from './reply'

test('parses one line per annotation, with continuation lines and route headings', () => {
  const md = `# Reply

## 1 · done — font-size text-sm → text-lg (components/toolbar.tsx:31)
## 2 · partial — moved the card; the gap still needs a token
  see components/sidebar.tsx:12
## 3 - SKIPPED: the element no longer exists

# /settings
## 1 · done — bigger toggle
`
  expect(parseReply(md)).toEqual([
    { index: 1, state: 'done', text: 'font-size text-sm → text-lg (components/toolbar.tsx:31)' },
    {
      index: 2,
      state: 'partial',
      text: 'moved the card; the gap still needs a token see components/sidebar.tsx:12',
    },
    { index: 3, state: 'skipped', text: 'the element no longer exists' },
    { index: 1, state: 'done', text: 'bigger toggle', route: '/settings' },
  ])
  expect(parseReply('')).toEqual([])
  expect(parseReply('## 4 · unknown — nope')).toEqual([])
})
