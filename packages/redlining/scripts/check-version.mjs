// Runs first in prepublishOnly: refuses to publish a version that is already on npm
// and names the next one, so "cannot publish over" never reaches the registry.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
let published = []
try {
  published = JSON.parse(
    execFileSync('npm', ['view', pkg.name, 'versions', '--json'], { encoding: 'utf8' }),
  )
  if (!Array.isArray(published)) published = [published]
} catch {
  // Offline or a new package: nothing to compare against; let publish decide.
}
if (published.includes(pkg.version)) {
  const [major, minor, patch] = pkg.version.split('.').map(Number)
  process.stderr.write(
    `redlining ${pkg.version} is already on npm. Step the version first (the release prep does this; ` +
      `by hand: set "version" to ${major}.${minor}.${patch + 1} or ${major}.${minor + 1}.0 and add the CHANGELOG entry).\n`,
  )
  process.exit(1)
}
