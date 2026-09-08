import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { init } from './init'

describe('redlining init', () => {
  let cwd: string
  beforeEach(async () => {
    cwd = await mkdtemp(path.join(tmpdir(), 'redlining-init-'))
  })
  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true })
  })

  test('writes the route, the gitignore entry and the command, then skips them all on a second run', async () => {
    mkdirSync(path.join(cwd, 'app'))
    writeFileSync(path.join(cwd, '.gitignore'), 'node_modules')
    const first = await init(cwd)
    expect(first).toEqual({
      written: ['app/api/redlining/route.ts', '.gitignore', '.claude/commands/redline.md'],
      skipped: [],
      notes: [],
    })
    expect(readFileSync(path.join(cwd, 'app/api/redlining/route.ts'), 'utf8')).toBe(
      "export { GET, POST } from 'redlining/next/route'\n",
    )
    expect(readFileSync(path.join(cwd, '.gitignore'), 'utf8')).toBe('node_modules\n.redlining/\n')
    const command = readFileSync(path.join(cwd, '.claude/commands/redline.md'), 'utf8')
    expect(command).toContain('Read `.redlining/annotations.md`')
    expect(command).toContain('several routes')
    expect(command).toContain('reply.md')

    const second = await init(cwd)
    expect(second).toEqual({
      written: [],
      skipped: ['app/api/redlining/route.ts', '.gitignore', '.claude/commands/redline.md'],
      notes: [],
    })
  })

  test('prefers src/app and creates .gitignore when absent', async () => {
    mkdirSync(path.join(cwd, 'src/app'), { recursive: true })
    const r = await init(cwd)
    expect(r.written).toContain('src/app/api/redlining/route.ts')
    expect(readFileSync(path.join(cwd, '.gitignore'), 'utf8')).toBe('.redlining/\n')
  })

  test('points out a route without GET and a command without the reply step', async () => {
    mkdirSync(path.join(cwd, 'app/api/redlining'), { recursive: true })
    writeFileSync(
      path.join(cwd, 'app/api/redlining/route.ts'),
      "export { POST } from 'redlining/next/route'\n",
    )
    mkdirSync(path.join(cwd, '.claude/commands'), { recursive: true })
    writeFileSync(
      path.join(cwd, '.claude/commands/redline.md'),
      'Read `.redlining/annotations.md`.\n',
    )
    const r = await init(cwd)
    expect(r.notes).toHaveLength(2)
    expect(r.notes[0]).toContain('exports only POST')
    expect(r.notes[1]).toContain('predates the verify loop')
  })

  test('leaves a note instead of guessing when there is no app directory', async () => {
    const r = await init(cwd)
    expect(r.notes[0]).toMatch(/No app\/ directory/)
    expect(existsSync(path.join(cwd, 'app'))).toBe(false)
    expect(r.written).toEqual(['.gitignore', '.claude/commands/redline.md'])
  })
})
