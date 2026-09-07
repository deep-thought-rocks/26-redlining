import { MainNav } from './main-nav'

export function Header() {
  return (
    <header className="header">
      <a className="brand" href="/dashboard">
        <span className="brand-mark" aria-hidden="true" />
        Acme Reports
      </a>
      <MainNav />
      <span className="header-spacer" />
      <label className="search">
        <span aria-hidden="true">⌕</span>
        <input type="search" placeholder="Search everything…" aria-label="Search" />
      </label>
      <span className="avatar" title="Frank">
        FG
      </span>
    </header>
  )
}
