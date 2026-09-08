// Maps computed values to the host framework's utility classes and scales. Pure:
// takes the page's tokens and root font size, never touches the DOM.
import type { FrameworkKind } from './framework'

export interface ClassHint {
  className: string
  /** False for an arbitrary value such as `pl-[13px]`. */
  exact: boolean
}

export interface ScaleStep {
  className: string
  px: number
}

export interface ThemeContext {
  /** `:root` custom properties by name, raw declaration text. */
  tokens: Map<string, string>
  /** The root font size in px, for rem values. */
  remPx: number
}

const PREFIX: Record<string, string> = {
  'padding-top': 'pt',
  'padding-right': 'pr',
  'padding-bottom': 'pb',
  'padding-left': 'pl',
  'margin-top': 'mt',
  'margin-right': 'mr',
  'margin-bottom': 'mb',
  'margin-left': 'ml',
  gap: 'gap',
  width: 'w',
  height: 'h',
  'font-size': 'text',
  'line-height': 'leading',
  'letter-spacing': 'tracking',
  'font-weight': 'font',
  'border-radius': 'rounded',
  color: 'text',
  'background-color': 'bg',
  'border-color': 'border',
}
const SPACING_PROPS = new Set([
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'gap',
  'width',
  'height',
])
const COLOR_PROPS = new Set(['color', 'background-color', 'border-color'])

/** Tailwind's default spacing steps; Tailwind 4 accepts any half step, 3 only these. */
const SPACING_STEPS = [
  0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44,
  48, 52, 56, 60, 64, 72, 80, 96,
]
/** Default type scale (both versions): name → px. */
const TEXT: [string, number][] = [
  ['xs', 12],
  ['sm', 14],
  ['base', 16],
  ['lg', 18],
  ['xl', 20],
  ['2xl', 24],
  ['3xl', 30],
  ['4xl', 36],
  ['5xl', 48],
  ['6xl', 60],
  ['7xl', 72],
  ['8xl', 96],
  ['9xl', 128],
]
const LEADING3: [string, number][] = [
  ['3', 12],
  ['4', 16],
  ['5', 20],
  ['6', 24],
  ['7', 28],
  ['8', 32],
  ['9', 36],
  ['10', 40],
]
const RADIUS3: [string, number][] = [
  ['none', 0],
  ['sm', 2],
  ['', 4],
  ['md', 6],
  ['lg', 8],
  ['xl', 12],
  ['2xl', 16],
  ['3xl', 24],
  ['full', 9999],
]
const RADIUS4: [string, number][] = [
  ['none', 0],
  ['xs', 2],
  ['sm', 4],
  ['md', 6],
  ['lg', 8],
  ['xl', 12],
  ['2xl', 16],
  ['3xl', 24],
  ['4xl', 32],
  ['full', 9999],
]
const WEIGHT: [string, number][] = [
  ['thin', 100],
  ['extralight', 200],
  ['light', 300],
  ['normal', 400],
  ['medium', 500],
  ['semibold', 600],
  ['bold', 700],
  ['extrabold', 800],
  ['black', 900],
]

/** "0.25rem" → 4 (at 16px), "12px" → 12, "0" → 0; undefined for anything else. */
export function toPx(value: string, remPx: number): number | undefined {
  const m = /^\s*(-?[\d.]+)\s*(px|rem|em)?\s*$/.exec(value)
  if (!m) return undefined
  const n = parseFloat(m[1]!)
  if (Number.isNaN(n)) return undefined
  return m[2] === 'rem' || m[2] === 'em' ? n * remPx : n
}

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100)
}

function isTailwind(kind: FrameworkKind): boolean {
  return kind === 'tailwind4' || kind === 'tailwind3'
}

function spacingPx(kind: FrameworkKind, ctx: ThemeContext): number {
  const token = kind === 'tailwind4' ? ctx.tokens.get('--spacing') : undefined
  return (token && toPx(token, ctx.remPx)) || ctx.remPx * 0.25
}

/** Named steps of a scale: defaults, overridden by `--<prefix>-<name>` tokens on Tailwind 4. */
function named(
  kind: FrameworkKind,
  ctx: ThemeContext,
  tokenPrefix: string,
  defaults: [string, number][],
): [string, number][] {
  const map = new Map(defaults)
  if (kind === 'tailwind4') {
    for (const [name, raw] of ctx.tokens) {
      if (!name.startsWith(tokenPrefix) || name.includes('--', 2)) continue
      const px = toPx(raw, ctx.remPx)
      if (px !== undefined) map.set(name.slice(tokenPrefix.length), px)
    }
  }
  return Array.from(map).sort((a, b) => a[1] - b[1])
}

function cls(prefix: string, name: string): string {
  return name ? `${prefix}-${name}` : prefix
}

/** The framework's steps for `property`, ascending; empty outside Tailwind. */
export function themeScale(kind: FrameworkKind, property: string, ctx: ThemeContext): ScaleStep[] {
  if (!isTailwind(kind)) return []
  const prefix = PREFIX[property]
  if (!prefix) return []
  const step = (name: string, px: number) => ({ className: cls(prefix, name), px })
  if (SPACING_PROPS.has(property)) {
    const unit = spacingPx(kind, ctx)
    return SPACING_STEPS.map((n) => step(fmt(n), n * unit))
  }
  switch (property) {
    case 'font-size':
      return named(kind, ctx, '--text-', TEXT).map(([n, px]) => step(n, px))
    case 'line-height':
      return kind === 'tailwind4'
        ? [3, 4, 5, 6, 7, 8, 9, 10].map((n) => step(String(n), n * spacingPx(kind, ctx)))
        : LEADING3.map(([n, px]) => step(n, px))
    case 'border-radius':
      return named(kind, ctx, '--radius-', kind === 'tailwind4' ? RADIUS4 : RADIUS3).map(
        ([n, px]) => step(n, px),
      )
    case 'font-weight':
      return named(kind, ctx, '--font-weight-', WEIGHT).map(([n, px]) => step(n, px))
    default:
      return []
  }
}

function toHex(color: string): string | undefined {
  const m = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(color.trim())
  if (m)
    return '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')
  return /^#[0-9a-f]{3,8}$/i.test(color.trim()) ? color.trim().toLowerCase() : undefined
}

/**
 * The utility class for `value` on `property`: `pl-6`, `text-lg`, `bg-brand-500`, or an
 * arbitrary `pl-[13px]` when the value is off the scale. `token` is the `--color-*` custom
 * property `value` equals, when known. Undefined outside Tailwind.
 */
export function classFor(
  kind: FrameworkKind,
  property: string,
  value: string,
  ctx: ThemeContext,
  token?: string,
): ClassHint | undefined {
  if (!isTailwind(kind)) return undefined
  const prefix = PREFIX[property]
  if (!prefix) return undefined
  if (COLOR_PROPS.has(property)) {
    if (token?.startsWith('--color-'))
      return { className: `${prefix}-${token.slice(8)}`, exact: true }
    const hex = toHex(value)
    return hex ? { className: `${prefix}-[${hex}]`, exact: false } : undefined
  }
  const n = parseFloat(value)
  if (Number.isNaN(n)) return undefined
  if (SPACING_PROPS.has(property)) {
    const sign = n < 0 ? '-' : ''
    const abs = Math.abs(n)
    if (abs === 1) return { className: `${sign}${prefix}-px`, exact: true }
    const steps = abs / spacingPx(kind, ctx)
    const half = Math.round(steps * 2) / 2
    const onScale =
      Math.abs(steps - half) < 0.02 && (kind === 'tailwind4' ? true : SPACING_STEPS.includes(half))
    if (onScale) return { className: `${sign}${prefix}-${fmt(half)}`, exact: true }
    return { className: `${sign}${prefix}-[${fmt(abs)}px]`, exact: false }
  }
  const hit = themeScale(kind, property, ctx).find((s) => Math.abs(s.px - n) < 0.05)
  if (hit) return { className: hit.className, exact: true }
  if (property === 'letter-spacing' && n === 0) return { className: 'tracking-normal', exact: true }
  if (property === 'font-weight') return undefined
  return { className: `${prefix}-[${fmt(n)}px]`, exact: false }
}
