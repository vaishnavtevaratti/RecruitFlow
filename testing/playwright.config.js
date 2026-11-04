// RecruitFlow — Playwright configuration.
// Starts an isolated API (port E2E_API_PORT, database E2E_DB_NAME) and a Vite dev server
// (port E2E_WEB_PORT) pointed at it, so tests never touch the development database.

const path = require('path');
const { defineConfig, devices } = require('@playwright/test');
const env = require('./support/env');

const ROOT = path.resolve(__dirname, '..');

module.exports = defineConfig({
  testDir: './tests',
  outputDir: './reports/artifacts',
  globalSetup: require.resolve('./support/global-setup'),
  globalTeardown: require.resolve('./support/global-teardown'),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // One worker: dashboard assertions compare UI numbers with live DB counts
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['json', { outputFile: 'reports/results.json' }],
    ['./support/summary-reporter.js', { outputFile: 'reports/SUMMARY.md' }]
  ],
  use: {
    baseURL: env.WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000
  },
  projects: [
    {
      name: 'desktop',
      testIgnore: /responsive\.spec\.js/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }
    },
    {
      // Iterates desktop 1440, laptop 1280, tablet 768 and mobile 375 inside the spec
      name: 'responsive',
      testMatch: /responsive\.spec\.js/,
      use: { ...devices['Desktop Chrome'] }
    },
    {
      // Auth smoke flows on real tablet/mobile emulation (touch, mobile UA)
      name: 'tablet',
      testMatch: /auth\.spec\.js/,
      grep: /@smoke/,
      use: { ...devices['iPad (gen 7)'], browserName: 'chromium' }
    },
    {
      name: 'mobile',
      testMatch: /auth\.spec\.js/,
      grep: /@smoke/,
      use: { ...devices['Pixel 5'] }
    }
  ],
  webServer: [
    {
      command: 'node src/server.js',
      cwd: path.join(ROOT, 'server'),
      url: `${env.API_URL}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        PORT: String(env.API_PORT),
        DB_NAME: env.DB_NAME,
        NODE_ENV: 'test',
        CORS_ORIGIN: env.WEB_URL,
        // Negative tests make many deliberate failed logins
        AUTH_RATE_LIMIT_MAX: '1000'
      }
    },
    {
      command: `npx vite --port ${env.WEB_PORT} --strictPort --host 127.0.0.1`,
      cwd: path.join(ROOT, 'client'),
      url: env.WEB_URL,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { VITE_API_URL: env.API_URL }
    }
  ]
});
