import { defineConfig, devices } from '@playwright/test';

// Chromium on Linux converts download file names to the locale's encoding.
// Under a POSIX/C locale (common in containers) a non-ASCII name such as
// 静夜思-….png falls back to "download", so give the browser a UTF-8 locale.
const localeVariables = process.env.LC_ALL || process.env.LC_CTYPE || process.env.LANG || '';
const browserEnv = process.platform === 'linux' && !/utf-?8/i.test(localeVariables)
  ? { ...process.env, LC_ALL: 'C.UTF-8' }
  : undefined;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    launchOptions: browserEnv ? { env: browserEnv } : {},
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:3000',
    env: {
      VITE_CLERK_PUBLISHABLE_KEY: '',
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
