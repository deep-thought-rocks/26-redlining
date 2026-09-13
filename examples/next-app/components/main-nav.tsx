'use client'

import { useEffect, useRef } from 'react'

const ITEMS = [
  { href: '/dashboard', label: 'Dashboard', current: true },
  { href: '/dashboard/reports', label: 'Reports' },
  { href: '/dashboard/settings', label: 'Settings' },
]

/** The site navigation. Currently a dropdown; the PRD scenario asks to make it a horizontal top nav. */
export function MainNav() {
  const ref = useRef<HTMLDetailsElement>(null)
  // Closes on a pointer down anywhere else, like a real menu (and like a Radix dialog would).
  useEffect(() => {
    const outside = (e: PointerEvent) => {
      const el = ref.current
      if (el?.open && !el.contains(e.target as Node)) el.open = false
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [])
  return (
    <details className="main-nav" ref={ref}>
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
