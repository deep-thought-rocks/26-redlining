/** `.claude/commands/redline.md`, from PRD §10. */
export const REDLINE_COMMAND = `Read \`.redlining/annotations.md\`. If \`.redlining/screenshot.png\` exists, view it — pins are numbered like the annotations.

Apply every annotation in order. Each anchor names the exact file, line, host element and React owner chain — edit there. Only search elsewhere if an anchor is marked "unresolved".

Reuse existing components and design tokens in this repo. Do not change anything not listed.

After applying, verify the result in the running app (use the \`next-dev-loop\` skill if available) and report per annotation: done / partial / skipped, with a one-line reason.

Finally delete \`.redlining/annotations.md\`, \`.redlining/annotations.json\` and \`.redlining/screenshot.png\`.
`

export const ROUTE_FILE = `export { POST } from 'redlining/next/route'\n`

export const GITIGNORE_ENTRY = '.redlining/'
