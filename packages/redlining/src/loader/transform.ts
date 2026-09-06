import { parse } from '@babel/parser'
import type { JSXOpeningElement, Node } from '@babel/types'
import MagicString from 'magic-string'

/** A source map v3 object, as bundler loaders expect it (not JSON text). */
export interface SourceMapV3 {
  version: number
  file?: string
  sources: string[]
  sourcesContent?: (string | null)[]
  names: string[]
  mappings: string
}

export interface TransformResult {
  code: string
  /** Source map for the stamped code, or null when nothing was changed. */
  map: SourceMapV3 | null
}

/**
 * Appends `data-rl="<file>:<line>:<col>"` to every host JSX opening element
 * (lowercase tag) in `source`. Components are never decorated: the attribute
 * would leak into their props. `file` is stamped as given, with `\` normalised
 * to `/`; line and column are 1-based and point at the `<`.
 */
export function transform(source: string, file: string): TransformResult {
  if (!source.includes('<')) return { code: source, map: null }
  const stamp = file.replace(/\\/g, '/')
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] })
  const s = new MagicString(source)
  let changed = false
  walk(ast, (node) => {
    if (node.type !== 'JSXOpeningElement' || !isHost(node) || hasStamp(node)) return
    const { line, column } = node.loc!.start
    s.appendRight(node.name.end!, ` data-rl="${stamp}:${line}:${column + 1}"`)
    changed = true
  })
  if (!changed) return { code: source, map: null }
  const map = s.generateMap({ source: stamp, includeContent: true, hires: true })
  return {
    code: s.toString(),
    map: {
      version: map.version,
      file: map.file,
      sources: map.sources,
      sourcesContent: map.sourcesContent,
      names: map.names,
      mappings: map.mappings,
    },
  }
}

function isHost(node: JSXOpeningElement): boolean {
  return node.name.type === 'JSXIdentifier' && /^[a-z]/.test(node.name.name)
}

function hasStamp(node: JSXOpeningElement): boolean {
  return node.attributes.some(
    (a) =>
      a.type === 'JSXAttribute' && a.name.type === 'JSXIdentifier' && a.name.name === 'data-rl',
  )
}

function walk(node: Node, visit: (node: Node) => void): void {
  visit(node)
  for (const key of Object.keys(node) as (keyof Node)[]) {
    if (key === 'loc') continue
    const value: unknown = node[key]
    if (Array.isArray(value)) {
      for (const item of value) if (isNode(item)) walk(item, visit)
    } else if (isNode(value)) {
      walk(value, visit)
    }
  }
}

function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && typeof (value as Node).type === 'string'
}
