'use client'

export function QuickStats() {
  return (
    <aside className="card">
      <div className="card-head">
        <h2>This week</h2>
      </div>
      <div className="card-body stats">
        <div className="stat">
          <b>12</b>
          <span>reports</span>
        </div>
        <div className="stat">
          <b>3</b>
          <span>in review</span>
        </div>
        <div className="stat">
          <b>98.2%</b>
          <span>delivered</span>
        </div>
        <div className="stat">
          <b>1</b>
          <span>failed</span>
        </div>
      </div>
    </aside>
  )
}

export function Sidebar() {
  return (
    <div className="sidebar">
      <QuickStats />
      <section className="card">
        <div className="card-head">
          <h2>Activity</h2>
        </div>
        <div className="card-body">
          <ul className="activity">
            <li>
              <span>
                Mia published <b>Q3 revenue</b>
              </span>
              <time>2h</time>
            </li>
            <li>
              <span>
                Import of <b>EU sales</b> failed
              </span>
              <time>5h</time>
            </li>
            <li>
              <span>
                Jonas requested review on <b>Churn cohorts</b>
              </span>
              <time>1d</time>
            </li>
          </ul>
        </div>
      </section>
    </div>
  )
}
