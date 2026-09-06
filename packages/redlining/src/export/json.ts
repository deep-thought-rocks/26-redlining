import type { Session } from '../types'

/** The session as pretty-printed JSON (PRD §9.2), with a trailing newline. */
export function toJson(session: Session): string {
  return JSON.stringify(session, null, 2) + '\n'
}
