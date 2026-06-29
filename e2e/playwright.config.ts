import { defineConfig, devices } from '@playwright/test';

/**
 * One orchestrated test drives three actors (see tests/order-lifecycle.spec.ts),
 * each created as its own device-emulated context inside the test. The project
 * below is just the default harness; trace + video are forced ON both here and
 * per-actor so every device produces a replayable artifact.
 *
 * globalSetup mints authenticated POS + KDS sessions (via the API) and writes
 * artifacts/session.json — it requires `pnpm db:seed && pnpm db:seed:e2e` to have
 * run in ../api first (see README).
 */
export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { outputFolder: 'artifacts/html', open: 'never' }]],
  outputDir: 'artifacts/test-results',
  use: {
    ignoreHTTPSErrors: true,
    trace: 'on',
    video: 'on',
    screenshot: 'on',
    actionTimeout: 20_000,
  },
  projects: [{ name: 'golden-path', use: { ...devices['Desktop Chrome'] } }],
});
