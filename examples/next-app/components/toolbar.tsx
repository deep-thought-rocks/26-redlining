'use client'

/** Actions above the report list. The PRD scenario removes the CSV export from here. */
export function Toolbar() {
  return (
    <div className="toolbar">
      <button type="button" className="btn" onClick={() => alert('Exported 12 rows')}>
        Export CSV
      </button>
      <button type="button" className="btn btn-primary" onClick={() => alert('New report')}>
        New report
      </button>
    </div>
  )
}
