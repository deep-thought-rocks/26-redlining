/** Removes `data-rl` attributes from dev-rendered HTML, for snapshot tests. */
export function stripRedlining(html: string): string {
  return html.replace(/\sdata-rl="[^"]*"/g, '')
}
