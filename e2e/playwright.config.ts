import { defineConfig, devices } from '@playwright/test';
import { ENV } from './config/env';

export default defineConfig({
  testDir: './tests',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { outputFolder: 'artifacts/html', open: 'never' }]],
  outputDir: 'artifacts/test-results',
  use: {
    browserName: 'chromium',
    ignoreHTTPSErrors: true,
    trace: 'on',
    video: 'on',
    screenshot: 'on',
    actionTimeout: 20_000,
  },
  projects: [
    {
      name: 'health',
      testMatch: 'health/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'], browserName: 'chromium', baseURL: ENV.websiteBaseUrl },
    },
    {
      name: 'api',
      testMatch: 'api/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'], browserName: 'chromium', baseURL: ENV.apiBaseUrl },
    },
    {
      name: 'reservations',
      testMatch: 'reservations/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'], browserName: 'chromium', baseURL: ENV.apiBaseUrl },
    },
    {
      name: 'website',
      testMatch: 'website/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'], browserName: 'chromium', baseURL: ENV.websiteBaseUrl },
    },
    {
      name: 'admin',
      testMatch: 'admin/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'], browserName: 'chromium', baseURL: ENV.adminBaseUrl },
    },
    {
      name: 'pos',
      testMatch: 'pos/**/*.spec.ts',
      use: { ...devices['iPad Pro 11 landscape'], browserName: 'chromium', baseURL: ENV.posBaseUrl },
    },
    {
      name: 'kds',
      testMatch: 'kds/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'], browserName: 'chromium', baseURL: ENV.kdsBaseUrl },
    },
    {
      name: 'customer',
      testMatch: 'customer/**/*.spec.ts',
      use: { ...devices['Pixel 5'], browserName: 'chromium', baseURL: ENV.customerBaseUrl },
    },
    {
      name: 'mobile-reservation',
      testMatch: 'mobile-reservation/**/*.spec.ts',
      use: { ...devices['Pixel 5'], browserName: 'chromium' },
    },
    {
      name: 'all-flow',
      testMatch: 'all-flow/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'], browserName: 'chromium' },
    },
  ],
});
