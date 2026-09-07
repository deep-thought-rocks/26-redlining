import type { ReactNode } from 'react'
import { Redlining } from 'redlining'
import './globals.css'

export const metadata = { title: 'Acme Reports' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Redlining />
      </body>
    </html>
  )
}
