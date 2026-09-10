// The package version, inlined by tsdown from package.json; "dev" in tests and source runs.
declare const __REDLINING_VERSION__: string | undefined
export const VERSION: string =
  typeof __REDLINING_VERSION__ === 'string' ? __REDLINING_VERSION__ : 'dev'
