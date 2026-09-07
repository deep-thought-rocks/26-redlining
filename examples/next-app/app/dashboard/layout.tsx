import type { ReactNode } from 'react'
import { Header } from '../../components/header'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <Header />
      {children}
    </div>
  )
}
