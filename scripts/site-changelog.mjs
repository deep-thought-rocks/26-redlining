// Generates site/changelog.html from packages/redlining/CHANGELOG.md, dated from the git tags,
// so the public version history never drifts from the package changelog.
// Usage: node scripts/site-changelog.mjs   (run after every changelog change; CI checks it is current)
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import prettier from 'prettier'

const root = new URL('..', import.meta.url).pathname
const md = readFileSync(`${root}packages/redlining/CHANGELOG.md`, 'utf8')

function tagDate(version) {
  try {
    return execFileSync('git', ['tag', '-l', `v${version}`, '--format=%(taggerdate:short)'], {
      cwd: root,
      encoding: 'utf8',
    }).trim()
  } catch {
    return ''
  }
}

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
/** The changelog uses only `code`, **bold**, _italic_ and bare URLs. */
function inline(text) {
  return escape(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])_([^_]+)_/g, '$1<em>$2</em>')
    .replace(/(https?:\/\/[^\s)]+)/g, '<a href="$1">$1</a>')
}

const releases = []
let current = null
let section = null
for (const line of md.split('\n')) {
  const v = /^## (\d+\.\d+\.\d+)$/.exec(line)
  const h = /^### (.+)$/.exec(line)
  const b = /^- (.+)$/.exec(line)
  if (v) {
    current = { version: v[1], date: tagDate(v[1]), sections: [] }
    releases.push(current)
    section = null
  } else if (h && current) {
    section = { title: h[1], items: [] }
    current.sections.push(section)
  } else if (b && section) {
    section.items.push(b[1])
  }
}

const toc = releases
  .map((r) => `<a href="#v${r.version.replace(/\./g, '-')}">${r.version}</a>`)
  .join('')
const body = releases
  .map((r) => {
    const id = `v${r.version.replace(/\./g, '-')}`
    const sections = r.sections
      .filter((s) => s.items.length)
      .map(
        (s) =>
          `        <h3>${escape(s.title)}</h3>\n        <ul>\n${s.items
            .map((i) => `          <li>${inline(i)}</li>`)
            .join('\n')}\n        </ul>`,
      )
      .join('\n')
    const date = r.date ? ` <small>${r.date}</small>` : ''
    return `        <h2 id="${id}">${r.version}${date}</h2>\n${sections}`
  })
  .join('\n\n')

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Versions · Redlining</title>
    <meta
      name="description"
      content="Version history of the redlining npm package: what each release added, fixed or changed."
    />
    <link rel="canonical" href="https://redlining.deep-thought.rocks/changelog" />
    <link rel="stylesheet" href="site.css" />
    <link rel="icon" href="favicons/favicon.svg" type="image/svg+xml" />
    <link rel="icon" href="favicons/favicon.ico" sizes="32x32" />
    <link rel="icon" href="favicons/favicon-32x32.png" type="image/png" sizes="32x32" />
    <link rel="apple-touch-icon" href="favicons/apple-touch-icon-180x180.png" />
    <link rel="mask-icon" href="favicons/safari-pinned-tab.svg" color="#0a0a0a" />
    <link rel="manifest" href="favicons/site.webmanifest" />
  </head>
  <body>
    <header class="top">
      <div class="wrap">
        <a class="brand" href="index.html"
          ><img src="images/silverballmania-mark.svg" alt="" width="24" height="24" /><span
            >red<b>lining</b></span
          ></a
        >
        <nav>
          <a href="getting-started.html">Getting started</a>
          <a href="guide.html">Guide</a>
          <a href="format.html">Annotation format</a>
          <a href="help.html">Help</a>
          <a href="changelog.html" aria-current="page">Versions</a>
          <a href="https://github.com/deep-thought-rocks/26-redlining">GitHub</a>
        </nav>
      </div>
    </header>
    <div class="wrap layout">
      <aside class="toc">
        <h4>Releases</h4>
        ${toc}
      </aside>
      <main>
        <h1>Versions</h1>
        <p>
          Every release of the <code>redlining</code> package, newest first, as published on
          <a href="https://www.npmjs.com/package/redlining">npm</a>. Generated from the package
          changelog; dates are the release tags. Upgrade with
          <code>npm i -D redlining@latest</code> (or your package manager's equivalent): a caret
          range does not pick up a new minor on its own.
        </p>

${body}
      </main>
    </div>
    <footer>
      <div class="wrap">
        Redlining is MIT licensed. Redlining never edits code — your coding agent stays the only
        thing that changes your codebase.
      </div>
    </footer>
  </body>
</html>
`
const out = `${root}site/changelog.html`
const config = (await prettier.resolveConfig(out)) ?? {}
writeFileSync(out, await prettier.format(page, { ...config, parser: 'html', filepath: out }))
console.log(`site/changelog.html: ${releases.length} releases`)
