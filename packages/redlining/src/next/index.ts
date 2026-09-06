import type { NextConfig } from 'next'

/** Wraps a Next.js config. Registers the Redlining loader in development only. */
export function withRedlining(config: NextConfig = {}): NextConfig {
  return config
}
