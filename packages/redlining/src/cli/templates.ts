/** `.claude/commands/redline.md`, from PRD §10. */
export const REDLINE_COMMAND = `Read \`.redlining/annotations.md\`. If \`.redlining/screenshot.png\` exists, view it — pins are numbered like the annotations. An annotation's \`Reference\` line names a pasted mockup of the intended result and its \`Crop\` line the element as it looks now; view both before editing.

The file may hold several routes, each under its own \`# Redlining — /route\` heading; apply all of them. Apply every annotation in order. Each anchor names the exact file, line, host element and React owner chain — edit there. Only search elsewhere if an anchor is marked "unresolved".

Reuse existing components and design tokens in this repo. Do not change anything not listed.

After applying, verify the result in the running app (use the \`next-dev-loop\` skill if available) and report per annotation: done / partial / skipped, with a one-line reason.

Then write \`.redlining/reply.md\` with one heading per annotation, \`## N · done | partial | skipped — what changed (file:line)\`, under a \`# /route\` heading when the export had several routes. The overlay reads this file to verify the result against the page.

Finally delete the export from \`.redlining/\`: \`annotations.md\`, \`annotations.json\`, the screenshots and every \`ref-*\` and \`crop-*\` image.
`

export const ROUTE_FILE = `export { GET, POST } from 'redlining/next/route'\n`

export const GITIGNORE_ENTRY = '.redlining/'
