'use client'
import { useState } from 'react'

// Client Component. Elements 15-20.
export function ClientPart() {
  const [n, setN] = useState(0)
  return (
    <form data-spike="15" onSubmit={(e) => e.preventDefault()}>
      <label data-spike="16">
        Count
        <input data-spike="17" value={n} readOnly />
      </label>
      <button data-spike="18" type="button" onClick={() => setN(n + 1)}>
        Increment
      </button>
      <ul data-spike="19">
        <li data-spike="20">item</li>
      </ul>
    </form>
  )
}
