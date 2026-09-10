import type { Anchor } from '../types'

/** "Toolbar · components/toolbar.tsx:7" — one line per anchor for the panel rows. */
export function short(a: Anchor): string {
  const owner = a.owners[a.owners.length - 1]
  const where = a.file ? `${a.file}:${a.line}` : 'unresolved'
  return `${owner ?? `<${a.tag}>`} · ${where}`
}

export function Detail({ label, anchor: a }: { label: string; anchor: Anchor }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>
        <code>&lt;{a.tag}&gt;</code> {a.file ? `${a.file}:${a.line}` : 'unresolved'}
        {a.owners.length ? <div>owners: {a.owners.join(' › ')}</div> : null}
        {a.context ? (
          <div>
            instance {a.context.index} of {a.context.count} in <code>&lt;{a.context.tag}&gt;</code>{' '}
            {a.context.file}:{a.context.line}
          </div>
        ) : null}
        {a.text ? <div className="rl-row-text">“{a.text}”</div> : null}
      </dd>
    </>
  )
}
