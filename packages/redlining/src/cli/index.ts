#!/usr/bin/env node
import { init } from './init'

const command = process.argv[2]

if (command !== 'init') {
  process.stderr.write('Usage: redlining init\n')
  process.exit(1)
}

const result = await init(process.cwd())
for (const f of result.written) process.stdout.write(`  wrote    ${f}\n`)
for (const f of result.skipped) process.stdout.write(`  exists   ${f}\n`)
for (const n of result.notes) process.stdout.write(`  note     ${n}\n`)
process.stdout.write(
  '\nNext: add <Redlining /> to your root layout and wrap next.config with withRedlining().\n',
)
