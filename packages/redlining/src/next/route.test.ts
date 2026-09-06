import { expect, test } from 'vitest'
import { POST } from './route'

test('answers 501 until implemented', async () => {
  const response = await POST(new Request('http://localhost/api/redlining', { method: 'POST' }))
  expect(response.status).toBe(501)
})
