import { defineConfig, devices } from '@playwright/test'

// The anchor and save scenarios again, against `next dev --webpack`; tagged @webpack in the spec.
// A separate config because two Next dev servers cannot share one .next directory.
const PORT = 3198

export default defineConfig({
  testDir: 'e2e',
  testMatch: 'overlay.spec.ts',
  grep: /@webpack/,
  globalSetup: './e2e/global-setup.ts',
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
    command: `pnpm --filter next-app exec next dev --webpack -p ${PORT}`,
    url: `http://localhost:${PORT}/spike`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
