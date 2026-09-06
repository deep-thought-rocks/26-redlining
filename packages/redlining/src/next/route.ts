/** Route handler for `POST /api/redlining`. Writes the session under `.redlining/`. */
export async function POST(_request: Request): Promise<Response> {
  return new Response('Not implemented', { status: 501 })
}
