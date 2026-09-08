import { Redlining } from 'redlining'

export function App() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 32 }}>
      <h1>Vite fixture</h1>
      <p className="lead">Three host elements, stamped by redlining/vite.</p>
      <button type="button">Sign up</button>
      <Redlining />
    </main>
  )
}
