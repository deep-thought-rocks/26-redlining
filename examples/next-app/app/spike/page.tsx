import { ClientPart } from './ClientPart'

// Server Component page. Elements 3-14. Fixture for anchor-resolution tests (M0 spike, kept for M1 e2e).
export default function SpikePage() {
  return (
    <main data-spike="3">
      <nav
        data-spike="4"
        style={{ display: 'flex', gap: 16, padding: '8px 0', borderBottom: '1px solid #ddd' }}
      >
        <a data-spike="5" href="#">
          Dashboard
        </a>
        <a data-spike="6" href="#">
          Reports
        </a>
      </nav>
      <article data-spike="7">
        <h1 data-spike="8">Anchor resolution spike</h1>
        <p data-spike="9">Twenty host elements across three files.</p>
        <table data-spike="10" style={{ borderCollapse: 'collapse', margin: '12px 0' }}>
          <tbody data-spike="11">
            <tr data-spike="12">
              <td data-spike="13" style={{ border: '1px solid #ddd', padding: '6px 12px' }}>
                cell
              </td>
            </tr>
          </tbody>
        </table>
        <aside data-spike="14">aside</aside>
      </article>
      <ClientPart />
    </main>
  )
}
