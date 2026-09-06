import type { ReactNode } from 'react'

// Nested layout (Server Component). Elements 1-2.
export default function SpikeLayout({ children }: { children: ReactNode }) {
  return (
    <section data-spike="1" style={{ padding: 16 }}>
      <header data-spike="2">
        <strong>Spike layout</strong>
      </header>
      {children}
    </section>
  )
}
