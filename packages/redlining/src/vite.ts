import path from 'node:path'
import { transform } from './loader/transform'

export interface RedliningVitePluginOptions {
  /** Project-relative directories whose `.tsx`/`.jsx` files get anchors. Default `['src']`. */
  include?: string[]
  /** Defaults to Vite's project root (`config.root`). */
  projectRoot?: string
}

/** The minimal Vite plugin interface this file needs; avoids a dependency on Vite's types. */
export interface VitePluginLike {
  name: string
  enforce: 'pre'
  apply: 'serve'
  configResolved(config: { root: string }): void
  transform(code: string, id: string): { code: string; map: object } | null
}

/**
 * Vite adapter: stamps `data-rl` on host JSX elements during `vite dev`.
 * Same transform as the Next.js loader; nothing runs in `vite build`.
 */
export function redlining(options: RedliningVitePluginOptions = {}): VitePluginLike {
  const include = (options.include ?? ['src']).map((d) => d.replace(/[/\\]+$/, ''))
  let root = options.projectRoot ?? process.cwd()
  return {
    name: 'redlining',
    enforce: 'pre',
    apply: 'serve',
    configResolved(config) {
      if (!options.projectRoot) root = config.root
    },
    transform(code, id) {
      const file = id.split('?')[0]!
      if (!/\.(tsx|jsx)$/.test(file) || file.includes('/node_modules/')) return null
      const rel = path.relative(root, file).split(path.sep).join('/')
      if (rel.startsWith('..') || !include.some((d) => rel === d || rel.startsWith(d + '/')))
        return null
      const out = transform(code, rel)
      return out.map ? { code: out.code, map: out.map } : null
    },
  }
}

export default redlining
