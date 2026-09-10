import Link from 'next/link'
import type { ReactNode } from 'react'
import { Redlining } from 'redlining'
import './globals.css'

export const metadata = { title: 'Acme Reports' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* Client-side navigation between the fixtures, for the route-switch e2e. */}
        <nav className="fixture-nav" aria-label="Fixtures">
          <Link href="/spike">Spike</Link>
          <Link href="/dashboard">Dashboard</Link>
        </nav>
        <Redlining />
      </body>
    </html>
  )
}
