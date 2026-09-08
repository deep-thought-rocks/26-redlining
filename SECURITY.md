# Security policy

Redlining is a development-only overlay. The save endpoint (`redlining/next/route`, or the
Vite dev-server middleware) refuses to run outside `NODE_ENV=development`, writes only under
`.redlining/` inside the project, validates every posted session, and rejects cross-origin
browser requests. Never expose a dev server that hosts it to the internet; the overlay's
`production` export condition and the route's guard exist so that shipping it by accident
does nothing.

## Supported versions

Only the latest published `0.x` minor receives fixes. Upgrade with
`pnpm add -D redlining@latest`.

## Reporting a vulnerability

Please report privately through GitHub's
[Report a vulnerability](https://github.com/deep-thought-rocks/26-redlining/security/advisories/new)
form on this repository; do not open a public issue for a security problem.

You will get an acknowledgement within a few days. Confirmed issues are fixed in the next
patch release and noted in `packages/redlining/CHANGELOG.md`; reports that turn out not to be
vulnerabilities get an explanation.
