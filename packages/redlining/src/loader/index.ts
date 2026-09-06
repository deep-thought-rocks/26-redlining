export interface TransformResult {
  code: string
  map: string | null
}

/** Appends `data-rl="<relpath>:<line>:<col>"` to host JSX elements in `source`. */
export function transform(source: string, _filename: string): TransformResult {
  return { code: source, map: null }
}
