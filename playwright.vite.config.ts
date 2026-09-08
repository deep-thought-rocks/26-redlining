import { defineConfig, devices } from '@playwright/test'

// The Vite fixture: examples/vite-app with redlining({ endpoint: true }).
const PORT = 3197

export default defineConfig({
  testDir: 'e2e',
  testMatch: 'vite.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['Desktop Chrome'],
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  webServer: {
    command: `pnpm --filter vite-app exec vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
