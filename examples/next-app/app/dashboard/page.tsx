import { FilterPanel } from '../../components/filter-panel'
import { ReportList, type Report } from '../../components/report-list'
import { Sidebar } from '../../components/sidebar'

const REPORTS: Report[] = [
  {
    name: 'Q3 revenue by region',
    owner: 'Mia Chen · Finance',
    status: 'published',
    updated: '2026-09-05',
  },
  { name: 'Churn cohorts', owner: 'Jonas Weber · Growth', status: 'review', updated: '2026-09-04' },
  { name: 'EU sales import', owner: 'Data platform', status: 'failed', updated: '2026-09-04' },
  {
    name: 'Onboarding funnel',
    owner: 'Priya Nair · Product',
    status: 'published',
    updated: '2026-09-02',
  },
  { name: 'Support SLA', owner: 'Ops', status: 'draft', updated: '2026-08-29' },
]

export default function DashboardPage() {
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Everything your team shipped this week, in one place.</p>
        </div>
      </div>
      <section>
        <FilterPanel total={REPORTS.length} />
        <ReportList reports={REPORTS} />
      </section>
      <Sidebar />
    </main>
  )
}
