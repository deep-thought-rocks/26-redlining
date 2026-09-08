import { copyFileSync } from 'node:fs'
import path from 'node:path'

/** The standalone fixture page loads the built bundle from the example's public dir. */
export default function globalSetup() {
  copyFileSync(
    path.resolve('packages/redlining/dist/standalone.js'),
    path.resolve('examples/next-app/public/redlining-standalone.js'),
  )
}
