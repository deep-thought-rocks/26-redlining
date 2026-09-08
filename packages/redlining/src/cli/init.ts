import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { GITIGNORE_ENTRY, REDLINE_COMMAND, ROUTE_FILE } from './templates'

export interface InitResult {
  written: string[]
  skipped: string[]
  notes: string[]
}

/** `redlining init`: scaffolds the route, the gitignore entry and the slash command. Idempotent. */
export async function init(cwd: string): Promise<InitResult> {
  const result: InitResult = { written: [], skipped: [], notes: [] }

  const appDir = ['src/app', 'app'].find((d) => existsSync(path.join(cwd, d)))
  if (appDir) {
    const route = path.join(appDir, 'api/redlining/route.ts')
    await writeOnce(cwd, route, ROUTE_FILE, result)
    if (
      result.skipped.includes(route) &&
      !(await readFile(path.join(cwd, route), 'utf8')).includes('GET')
    ) {
      result.notes.push(
        `${route} exports only POST; export GET as well (export { GET, POST } from 'redlining/next/route') so the overlay can read the agent's reply.md`,
      )
    }
  } else {
    result.notes.push(
      "No app/ directory found. Create app/api/redlining/route.ts with: export { GET, POST } from 'redlining/next/route'",
    )
  }

  const gitignore = path.join(cwd, '.gitignore')
  const current = existsSync(gitignore) ? await readFile(gitignore, 'utf8') : ''
  if (current.split(/\r?\n/).some((line) => line.trim() === GITIGNORE_ENTRY)) {
    result.skipped.push('.gitignore')
  } else {
    const sep = current.length === 0 || current.endsWith('\n') ? '' : '\n'
    await writeFile(gitignore, `${current}${sep}${GITIGNORE_ENTRY}\n`)
    result.written.push('.gitignore')
  }

  const command = '.claude/commands/redline.md'
  await writeOnce(cwd, command, REDLINE_COMMAND, result)
  if (
    result.skipped.includes(command) &&
    !(await readFile(path.join(cwd, command), 'utf8')).includes('reply.md')
  ) {
    result.notes.push(
      `${command} predates the verify loop; add the reply.md step from the docs, or delete the file and run init again`,
    )
  }
  return result
}

async function writeOnce(
  cwd: string,
  rel: string,
  content: string,
  result: InitResult,
): Promise<void> {
  const file = path.join(cwd, rel)
  if (existsSync(file)) {
    result.skipped.push(rel)
    return
  }
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, content)
  result.written.push(rel)
}
