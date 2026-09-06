import { defineConfig, devices } from '@playwright/test'

const PORT = 3199

export default defineConfig({
  testDir: 'e2e',
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
    command: `pnpm --filter next-app exec next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/spike`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
