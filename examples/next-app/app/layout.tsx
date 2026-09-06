import type { ReactNode } from 'react'
import { Redlining } from 'redlining'

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
