import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run against the deployed site by default.
// Override with E2E_BASE_URL (e.g. a local `npx serve dist --single`).
const baseURL = process.env.E2E_BASE_URL ?? 'https://refillrounds.vercel.app';

// Playwright's bundled browsers don't support older macOS versions; locally we
// can fall back to the installed Google Chrome with E2E_USE_CHROME=1.
const chromeChannel = process.env.E2E_USE_CHROME ? { channel: 'chrome' as const } : {};

export default defineConfig({
  testDir: './e2e',
  timeout: 3 * 60 * 1000,
  expect: { timeout: 10 * 1000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'], ...chromeChannel } },
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'], ...chromeChannel } },
    // WebKit = Safari engine. Runs in CI (Linux); skipped locally when using installed Chrome.
    ...(process.env.E2E_USE_CHROME ? [] : [{ name: 'mobile-safari', use: { ...devices['iPhone 14'] } }]),
  ],
});
