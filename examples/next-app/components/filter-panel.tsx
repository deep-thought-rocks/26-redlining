'use client'

import { useState } from 'react'

const STATUSES = ['All', 'Published', 'In review', 'Draft', 'Failed'] as const

/** Search and status filters for the report list. The PRD scenario draws a sortable table into this panel, after the search input. */
export function FilterPanel({ total }: { total: number }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('All')
  return (
    <section className="card">
      <div className="card-head">
        <h2>Filters</h2>
        <span className="filters-meta">{total} reports</span>
      </div>
      <div className="card-body filters">
        <label className="search" style={{ width: '100%' }}>
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            placeholder="Filter by name or owner"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Filter reports"
          />
        </label>
        <div className="chips" role="group" aria-label="Status">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className="chip"
              aria-pressed={status === s}
              onClick={() => setStatus(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
