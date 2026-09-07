import { Toolbar } from './toolbar'

export interface Report {
  name: string
  owner: string
  status: 'published' | 'review' | 'draft' | 'failed'
  updated: string
}

const LABEL: Record<Report['status'], string> = {
  published: 'Published',
  review: 'In review',
  draft: 'Draft',
  failed: 'Failed',
}

export function ReportList({ reports }: { reports: Report[] }) {
  return (
    <section className="card">
      <div className="card-head">
        <h2>Reports</h2>
        <Toolbar />
      </div>
      <ul className="reports">
        {reports.map((r) => (
          <li key={r.name} className="report">
            <div>
              <h3 className="text-base">{r.name}</h3>
              <p>{r.owner}</p>
            </div>
            <span className="status" data-status={r.status}>
              {LABEL[r.status]}
            </span>
            <time className="updated" dateTime={r.updated}>
              {r.updated}
            </time>
          </li>
        ))}
      </ul>
    </section>
  )
}
