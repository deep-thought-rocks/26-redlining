import { Check, ChevronDown, ChevronRight, EyeOff, RotateCcw, Undo2, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { captionFor, describe } from '../export/changes'
import type { Anchor, Change, ChangeSource } from '../types'
import { provenance, suggestClass } from './cascade'
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

const WIDTH = 360

interface Field {
  property: string
  label: string
  unit: 'px' | ''
  step: number
  min?: number
  max?: number
}

/** Style properties edited with steppers: unit and step size. */
const FIELDS: Field[] = [
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
  { property: 'gap', label: 'Gap', unit: 'px', step: 2, min: 0 },
]
const WEIGHTS = ['400', '500', '600', '700']
const COLORS: { property: string; label: string }[] = [
  { property: 'color', label: 'Text' },
  { property: 'background-color', label: 'Background' },
  { property: 'border-color', label: 'Border' },
]
const JUSTIFY = ['flex-start', 'center', 'space-between', 'flex-end']
const ALIGN = ['stretch', 'flex-start', 'center', 'flex-end']

/** Upserts a style change for `property`, keeping the first-seen `from`. */
export function upsert(changes: Change[], next: Change): Change[] {
  const i = changes.findIndex((c) => c.kind === next.kind && c.property === next.property)
  if (i === -1) return [...changes, next]
  const merged = { ...next, from: changes[i]!.from }
  return changes.map((c, k) => (k === i ? merged : c))
}

/** "179.688px" → "179.7", "normal" → "normal", "1" → "1". */
export function short(value: string): string {
  const n = parseFloat(value)
  if (Number.isNaN(n)) return value
  return String(Math.round(n * 10) / 10)
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
  const changed = (property: string) =>
    changes.some((c) => c.kind === 'style' && c.property === property)
  // Provenance per property, resolved once per element.
  const [sources] = useState(() => new Map<string, ChangeSource>())
  const sourceOf = (property: string) => {
    let s = sources.get(property)
    if (!s) {
      s = provenance(element, property)
      sources.set(property, s)
    }
    return s
  }
  const [text, setText] = useState(() => soleTextNode(element)?.data ?? '')
  const textEditable = useMemo(() => canEditText(element), [element])
  const tokens = useMemo(() => colorTokens(), [])
  const display = computed(element, 'display')
  const isFlexOrGrid = /flex|grid/.test(display)
  const hidden = changes.some((c) => c.kind === 'visibility' && c.to === 'none')
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const toggle = (title: string) =>
    setOpen((cur) => {
      const next = new Set(cur)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })

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
    const source = sourceOf(property)
    const change: Change = {
      kind: 'style',
      property,
      from: base(property),
      to: value,
      input,
      source,
    }
    const token = tokenFor(value)
    if (token) change.token = token
    if (property === 'width' || property === 'height') {
      const rel = relativeTo(element, property, parseFloat(value))
      if (rel) change.relative = rel
    }
    const suggestion = suggestClass(element, property, value, source)
    if (suggestion) change.suggestion = suggestion
    onChange(upsert(next, change))
  }
  const stepField = (f: Field, delta: number) => {
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

  const stepper = (property: string) => {
    const f = FIELDS.find((x) => x.property === property)!
    const value = current(property)
    const source = sourceOf(property)
    const caption = captionFor(source)
    return (
      <div key={property} className="rl-field" data-changed={changed(property) || undefined}>
        <span>
          {f.label}
          {caption ? (
            <small
              className={`rl-caption${source.kind === 'layout' ? ' rl-caption--warn' : ''}`}
              title={
                source.value
                  ? `${source.selector ?? ''} { ${property}: ${source.value} }`
                  : undefined
              }
            >
              {caption}
            </small>
          ) : null}
        </span>
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
            value={short(value)}
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
  }

  const sides = (prefix: string) =>
    ['top', 'right', 'bottom', 'left'].map((s) => short(current(`${prefix}-${s}`))).join(' ')
  const anyChanged = (props: string[]) => props.some(changed)
  const section = (
    id: string,
    title: string,
    summary: string,
    props: string[],
    body: ReactNode,
  ) => {
    const isOpen = open.has(id)
    return (
      <div
        key={id}
        className="rl-section"
        data-open={isOpen || undefined}
        data-changed={anyChanged(props) || undefined}
      >
        <button
          type="button"
          className="rl-section-head"
          aria-expanded={isOpen}
          data-testid={`rl-section-${id}`}
          onClick={() => toggle(id)}
        >
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="rl-section-title">{title}</span>
          <span className="rl-summary">{summary}</span>
        </button>
        {isOpen ? body : null}
      </div>
    )
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

      {section(
        'type',
        'Type',
        `${short(current('font-size'))} · ${current('font-weight')} · ${short(current('line-height'))} · ${short(current('letter-spacing'))}`,
        ['font-size', 'font-weight', 'line-height', 'letter-spacing'],
        <>
          {stepper('font-size')}
          <div className="rl-field" data-changed={changed('font-weight') || undefined}>
            <span>
              Weight
              {captionFor(sourceOf('font-weight')) ? (
                <small className="rl-caption">{captionFor(sourceOf('font-weight'))}</small>
              ) : null}
            </span>
            <div className="rl-chips">
              {WEIGHTS.map((v) => (
                <button
                  key={v}
                  type="button"
                  className="rl-chip"
                  aria-pressed={current('font-weight') === v}
                  onClick={() => setStyle('font-weight', v, v)}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          {stepper('line-height')}
          {stepper('letter-spacing')}
        </>,
      )}
      {section(
        'box',
        'Box',
        `${short(current('width'))} × ${short(current('height'))} · r ${short(current('border-radius'))} · ${Math.round(parseFloat(current('opacity')) * 100)}%`,
        ['width', 'height', 'border-radius', 'opacity'],
        <>
          {stepper('width')}
          {stepper('height')}
          {stepper('border-radius')}
          {stepper('opacity')}
        </>,
      )}
      {section(
        'padding',
        'Padding',
        sides('padding'),
        ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
        <>{['padding-top', 'padding-right', 'padding-bottom', 'padding-left'].map(stepper)}</>,
      )}
      {section(
        'margin',
        'Margin',
        sides('margin'),
        ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
        <>{['margin-top', 'margin-right', 'margin-bottom', 'margin-left'].map(stepper)}</>,
      )}
      {section(
        'colour',
        'Colour',
        COLORS.map(({ property }) => colorShort(current(property))).join(' · '),
        COLORS.map((c) => c.property),
        <>
          {COLORS.map(({ property, label }) => {
            const value = current(property)
            const tokenNow =
              changes.find((c) => c.kind === 'style' && c.property === property)?.token ?? ''
            const caption = captionFor(sourceOf(property))
            return (
              <div
                key={property}
                className="rl-field"
                data-changed={changed(property) || undefined}
              >
                <span>
                  {label}
                  {caption ? <small className="rl-caption">{caption}</small> : null}
                </span>
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
        </>,
      )}
      {isFlexOrGrid
        ? section(
            'layout',
            `Layout (${display})`,
            `gap ${short(current('gap'))} · ${current('justify-content').replace('flex-', '')} · ${current('align-items').replace('flex-', '')}`,
            ['gap', 'justify-content', 'align-items'],
            <>
              {stepper('gap')}
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
            </>,
          )
        : null}

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
        <p className="rl-hint">
          Open a section and step a value, or edit the text; the page updates live.
        </p>
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

/** "rgba(0, 0, 0, 0)" → "none", else the hex form. */
function colorShort(value: string): string {
  return /^rgba\(\d+, \d+, \d+, 0\)$/.test(value) ? 'none' : toHex(value)
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
