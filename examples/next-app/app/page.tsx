export default function Page() {
  return (
    <main className="home">
      <h1>Redlining playground</h1>
      <p>Press Alt+R on any page to open the overlay.</p>
      <ul>
        <li>
          <a href="/dashboard">/dashboard</a> — a realistic reports dashboard (the PRD scenario)
        </li>
        <li>
          <a href="/spike">/spike</a> — the 20-element anchor-resolution fixture used by the e2e
          suite
        </li>
      </ul>
    </main>
  )
}
