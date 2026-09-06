import path from 'node:path'
import { transform, type SourceMapV3 } from './transform'

export { transform } from './transform'
export type { SourceMapV3, TransformResult } from './transform'

export interface LoaderOptions {
  /** Absolute path the stamped file paths are made relative to. */
  projectRoot?: string
}

/** The subset of the webpack loader context that Turbopack and webpack both provide. */
export interface LoaderContext {
  resourcePath: string
  rootContext?: string
  query?: unknown
  getOptions?: () => LoaderOptions
  callback?: (err: Error | null, code?: string, map?: SourceMapV3) => void
}

/** webpack-style loader entry; registered by `withRedlining()` in development only. */
export default function redliningLoader(this: LoaderContext, source: string): string | undefined {
  const options =
    (typeof this.getOptions === 'function' ? this.getOptions() : (this.query as LoaderOptions)) ??
    {}
  const root = options.projectRoot ?? this.rootContext ?? process.cwd()
  const file = path.relative(root, this.resourcePath)
  const { code, map } = transform(source, file)
  if (typeof this.callback === 'function') {
    this.callback(null, code, map ?? undefined)
    return undefined
  }
  return code
}
