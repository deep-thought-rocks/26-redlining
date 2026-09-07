import { Check, EyeOff, RotateCcw, Undo2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { describe } from '../export/changes'
import type { Anchor, Change } from '../types'
import {
  canEditText,
  colorTokens,
  computed,
  isInline,
  relativeTo,
  soleTextNode,
  toHex,
  toRgb,
  tokenFor,
} from './preview'

export interface InspectorProps {
  element: Element
  anchor: Anchor
  changes: Change[]
  onChange(changes: Change[]): void
  onUndo(): void
  onReset(): void
  onDone(): void
  onCancel(): void
}

const WIDTH = 340

/** Style properties edited with steppers: unit and step size. */
const FIELDS: {
  property: string
  label: string
  unit: 'px' | ''
  step: number
  min?: number
  max?: number
}[] = [
  { property: 'font-size', label: 'Font size', unit: 'px', step: 1, min: 6 },
  { property: 'line-height', label: 'Line height', unit: 'px', step: 1, min: 8 },
  { property: 'letter-spacing', label: 'Tracking', unit: 'px', step: 0.25, min: -2, max: 8 },
  { property: 'width', label: 'Width', unit: 'px', step: 4, min: 0 },
  { property: 'height', label: 'Height', unit: 'px', step: 4, min: 0 },
  { property: 'padding-top', label: 'Padding top', unit: 'px', step: 2, min: 0 },
  { property: 'padding-right', label: 'Padding right', unit: 'px', step: 2, min: 0 },
  { property: 'padding-bottom', label: 'Padding bottom', unit: 'px', step: 2, min: 0 },
  { property: 'padding-left', label: 'Padding left', unit: 'px', step: 2, min: 0 },
  { property: 'margin-top', label: 'Margin top', unit: 'px', step: 2 },
  { property: 'margin-right', label: 'Margin right', unit: 'px', step: 2 },
  { property: 'margin-bottom', label: 'Margin bottom', unit: 'px', step: 2 },
  { property: 'margin-left', label: 'Margin left', unit: 'px', step: 2 },
  { property: 'border-radius', label: 'Radius', unit: 'px', step: 2, min: 0 },
  { property: 'opacity', label: 'Opacity', unit: '', step: 0.1, min: 0, max: 1 },
]
const WEIGHTS = ['400', '500', '600', '700']
const COLORS: { property: string; label: string }[] = [
  { property: 'color', label: 'Text' },
  { property: 'background-color', label: 'Background' },
  { property: 'border-color', label: 'Border' },
]
const JUSTIFY = ['flex-start', 'center', 'space-between', 'flex-end']
const ALIGN = ['stretch', 'flex-start', 'center', 'flex-end']
const SECTIONS: { title: string; properties: string[] }[] = [
  { title: 'Type', properties: ['font-size', 'font-weight', 'line-height', 'letter-spacing'] },
  { title: 'Box', properties: ['width', 'height', 'border-radius', 'opacity'] },
  {
    title: 'Padding',
    properties: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
  },
  { title: 'Margin', properties: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'] },
]

/** Upserts a style change for `property`, keeping the first-seen `from`. */
export function upsert(changes: Change[], next: Change): Change[] {
  const i = changes.findIndex((c) => c.kind === next.kind && c.property === next.property)
  if (i === -1) return [...changes, next]
  const merged = { ...next, from: changes[i]!.from }
  return changes.map((c, k) => (k === i ? merged : c))
}

export function Inspector(p: InspectorProps) {
  const { element, anchor, changes, onChange } = p
  const el = element as HTMLElement
  // First-seen computed values per property, so `from` stays the pre-change value.
  const [baseline] = useState(() => new Map<string, string>())
  const base = (property: string) => {
    let v = baseline.get(property)
    if (v === undefined) {
      v = computed(el, property)
      baseline.set(property, v)
    }
    return v
  }
  const current = (property: string) =>
    changes.find((c) => c.kind === 'style' && c.property === property)?.to ?? base(property)
  const [text, setText] = useState(() => soleTextNode(element)?.data ?? '')
  const textEditable = useMemo(() => canEditText(element), [element])
  const tokens = useMemo(() => colorTokens(), [])
  const display = computed(element, 'display')
  const isFlexOrGrid = /flex|grid/.test(display)
  const hidden = changes.some((c) => c.kind === 'visibility' && c.to === 'none')

  const setStyle = (property: string, value: string, input?: string) => {
    let next = changes
    if (
      (property === 'width' || property === 'height') &&
      isInline(element) &&
      !changes.some((c) => c.property === 'display')
    ) {
      next = upsert(next, {
        kind: 'style',
        property: 'display',
        from: 'inline',
        to: 'inline-block',
      })
    }
    const change: Change = { kind: 'style', property, from: base(property), to: value, input }
    const token = tokenFor(value)
    if (token) change.token = token
    if (property === 'width' || property === 'height') {
      const rel = relativeTo(element, property, parseFloat(value))
      if (rel) change.relative = rel
    }
    onChange(upsert(next, change))
  }
  const stepField = (f: (typeof FIELDS)[number], delta: number) => {
    const n = parseFloat(current(f.property)) || 0
    let v = Math.round((n + delta) / f.step) * f.step
    if (f.min !== undefined) v = Math.max(f.min, v)
    if (f.max !== undefined) v = Math.min(f.max, v)
    const value = f.unit ? `${round(v)}${f.unit}` : `${round(v)}`
    setStyle(f.property, value, `${round(v)}`)
  }
  const commitText = () => {
    const from = soleTextNode(element)?.data ?? ''
    const original = changes.find((c) => c.kind === 'text')?.from ?? from
    if (text === original) onChange(changes.filter((c) => c.kind !== 'text'))
    else onChange(upsert(changes, { kind: 'text', property: 'text', from: original, to: text }))
  }

  const r = anchor.rect
  // Never cover the element: below it, else above, else beside (left, then right),
  // else clamped; always clear of the toolbar corner (bottom 80px) and the edges.
  const height = Math.min(window.innerHeight * 0.7, 640)
  const clampX = (x: number) => Math.max(8, Math.min(x, window.innerWidth - WIDTH - 8))
  const clampY = (y: number) => Math.max(8, Math.min(y, window.innerHeight - 80 - height))
  let left: number
  let top: number
  if (r.y + r.h + 8 + height <= window.innerHeight - 80) {
    left = clampX(r.x)
    top = r.y + r.h + 8
  } else if (r.y - 8 - height >= 8) {
    left = clampX(r.x)
    top = r.y - 8 - height
  } else if (r.x - WIDTH - 8 >= 8) {
    left = r.x - WIDTH - 8
    top = clampY(r.y)
  } else if (r.x + r.w + 8 + WIDTH <= window.innerWidth - 8) {
    left = r.x + r.w + 8
    top = clampY(r.y)
  } else {
    left = clampX(r.x)
    top = clampY(r.y + r.h + 8)
  }
  left += window.scrollX
  top += window.scrollY
  const owner = anchor.owners[anchor.owners.length - 1]

  return (
    <div
      className="rl-popover rl-inspector"
      data-testid="rl-inspector"
      role="dialog"
      aria-label="Tweak"
      style={{ left, top }}
    >
      <header>
        <b>Tweak {owner ?? `<${anchor.tag}>`}</b>
        {anchor.file ? `${anchor.file}:${anchor.line}` : 'unresolved'}
      </header>

      {textEditable ? (
        <label className="rl-field rl-field--wide">
          <span>Text</span>
          <input
            className="rl-input"
            data-testid="rl-tweak-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commitText}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                ;(e.target as HTMLInputElement).blur()
              }
              e.stopPropagation()
            }}
          />
        </label>
      ) : null}

      {SECTIONS.map((section) => (
        <fieldset key={section.title} className="rl-section">
          <legend>{section.title}</legend>
          {section.properties.map((property) => {
            if (property === 'font-weight') {
              const w = current('font-weight')
              return (
                <div key={property} className="rl-field">
                  <span>Weight</span>
                  <div className="rl-chips">
                    {WEIGHTS.map((v) => (
                      <button
                        key={v}
                        type="button"
                        className="rl-chip"
                        aria-pressed={w === v}
                        onClick={() => setStyle('font-weight', v, v)}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              )
            }
            const f = FIELDS.find((x) => x.property === property)!
            const value = current(property)
            const changed = changes.some((c) => c.kind === 'style' && c.property === property)
            return (
              <div key={property} className="rl-field" data-changed={changed || undefined}>
                <span>{f.label}</span>
                <div className="rl-stepper">
                  <button
                    type="button"
                    aria-label={`${f.label} −${f.step}`}
                    onClick={() => stepField(f, -f.step)}
                  >
                    −
                  </button>
                  <input
                    className="rl-input"
                    data-testid={`rl-tweak-${property}`}
                    value={value.replace(/px$/, '')}
                    onChange={(e) => {
                      const n = parseFloat(e.target.value)
                      if (!Number.isNaN(n))
                        setStyle(property, f.unit ? `${n}${f.unit}` : `${n}`, e.target.value)
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                  <button
                    type="button"
                    aria-label={`${f.label} +${f.step}`}
                    onClick={() => stepField(f, f.step)}
                  >
                    +
                  </button>
                </div>
              </div>
            )
          })}
        </fieldset>
      ))}

      <fieldset className="rl-section">
        <legend>Colour</legend>
        {COLORS.map(({ property, label }) => {
          const value = current(property)
          const changed = changes.some((c) => c.kind === 'style' && c.property === property)
          const tokenNow =
            changes.find((c) => c.kind === 'style' && c.property === property)?.token ?? ''
          return (
            <div key={property} className="rl-field" data-changed={changed || undefined}>
              <span>{label}</span>
              <div className="rl-color">
                <input
                  type="color"
                  aria-label={`${label} colour`}
                  data-testid={`rl-tweak-${property}`}
                  value={toHex(value)}
                  onChange={(e) => setStyle(property, toRgb(e.target.value), e.target.value)}
                />
                <select
                  aria-label={`${label} token`}
                  data-testid={`rl-token-${property}`}
                  value={tokenNow}
                  onChange={(e) => {
                    const t = tokens.find((x) => x.name === e.target.value)
                    if (t) setStyle(property, t.value, t.name)
                  }}
                >
                  <option value="">token…</option>
                  {tokens.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )
        })}
      </fieldset>

      {isFlexOrGrid ? (
        <fieldset className="rl-section">
          <legend>Layout ({display})</legend>
          {(() => {
            const f = { property: 'gap', label: 'Gap', unit: 'px' as const, step: 2, min: 0 }
            const value = current('gap')
            return (
              <div
                className="rl-field"
                data-changed={changes.some((c) => c.property === 'gap') || undefined}
              >
                <span>Gap</span>
                <div className="rl-stepper">
                  <button type="button" aria-label="Gap −2" onClick={() => stepField(f, -2)}>
                    −
                  </button>
                  <input
                    className="rl-input"
                    data-testid="rl-tweak-gap"
                    value={value.replace(/px$/, '')}
                    readOnly
                  />
                  <button type="button" aria-label="Gap +2" onClick={() => stepField(f, 2)}>
                    +
                  </button>
                </div>
              </div>
            )
          })()}
          <div className="rl-field">
            <span>Justify</span>
            <div className="rl-chips">
              {JUSTIFY.map((v) => (
                <button
                  key={v}
                  type="button"
                  className="rl-chip"
                  aria-pressed={current('justify-content') === v}
                  onClick={() => setStyle('justify-content', v, v)}
                >
                  {v.replace('flex-', '')}
                </button>
              ))}
            </div>
          </div>
          <div className="rl-field">
            <span>Align</span>
            <div className="rl-chips">
              {ALIGN.map((v) => (
                <button
                  key={v}
                  type="button"
                  className="rl-chip"
                  aria-pressed={current('align-items') === v}
                  onClick={() => setStyle('align-items', v, v)}
                >
                  {v.replace('flex-', '')}
                </button>
              ))}
            </div>
          </div>
        </fieldset>
      ) : null}

      <div className="rl-chips" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="rl-chip"
          aria-pressed={hidden}
          onClick={() =>
            onChange(
              hidden
                ? changes.filter((c) => c.kind !== 'visibility')
                : [
                    ...changes,
                    { kind: 'visibility', property: 'display', from: base('display'), to: 'none' },
                  ],
            )
          }
        >
          <EyeOff size={12} /> Hide
        </button>
        <button
          type="button"
          className="rl-chip"
          onClick={p.onUndo}
          disabled={changes.length === 0}
          aria-label="Undo last change (⌘Z)"
        >
          <Undo2 size={12} /> Undo
        </button>
        <button
          type="button"
          className="rl-chip"
          onClick={p.onReset}
          disabled={changes.length === 0}
        >
          <RotateCcw size={12} /> Reset
        </button>
      </div>

      {changes.length ? (
        <ul className="rl-changes" data-testid="rl-tweak-changes">
          {changes.map((c, i) => (
            <li key={i}>{describe(c)}</li>
          ))}
        </ul>
      ) : (
        <p className="rl-hint">Step a value or edit the text; the page updates live.</p>
      )}

      <div className="rl-actions">
        <span className="rl-kbd">⌘Z undo · esc cancel</span>
        <button type="button" className="rl-action" onClick={p.onCancel}>
          <X size={14} /> Cancel
        </button>
        <button
          type="button"
          className="rl-action rl-action--primary"
          onClick={p.onDone}
          disabled={changes.length === 0}
          data-testid="rl-tweak-done"
        >
          <Check size={14} /> Done
        </button>
      </div>
    </div>
  )
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
