// Production build of the package entry: the overlay never ships to production.
// Only the component stub is exported; `stripRedlining` is a test-time helper
// and lives on the development entry, so nothing else reaches the bundle.
export type { RedliningProps } from './overlay/Redlining'
export function Redlining(): null {
  return null
}
