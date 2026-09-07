import type { ReactNode } from 'react'

// Nested layout (Server Component). Elements 1-2.
export default function SpikeLayout({ children }: { children: ReactNode }) {
  return (
    <section
      data-spike="1"
      style={{
        padding: 32,
        fontFamily: 'system-ui, sans-serif',
        color: '#111',
        lineHeight: 1.5,
        maxWidth: 720,
      }}
    >
      <header data-spike="2" style={{ marginBottom: 16, color: '#666', fontSize: 14 }}>
        <strong>Spike layout</strong>
      </header>
      {children}
    </section>
  )
}
