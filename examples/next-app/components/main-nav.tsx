'use client'

const ITEMS = [
  { href: '/dashboard', label: 'Dashboard', current: true },
  { href: '/dashboard/reports', label: 'Reports' },
  { href: '/dashboard/settings', label: 'Settings' },
]

/** The site navigation. Currently a dropdown; the PRD scenario asks to make it a horizontal top nav. */
export function MainNav() {
  return (
    <details className="main-nav">
      <summary>Dashboard</summary>
      <ul>
        {ITEMS.map((item) => (
          <li key={item.href}>
            <a href={item.href} aria-current={item.current ? 'page' : undefined}>
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </details>
  )
}
