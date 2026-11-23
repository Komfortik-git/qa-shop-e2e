const { defineConfig, devices } = require('@playwright/test');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');

const external = process.env.BASE_URL;
module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 30000,
  expect: { timeout: 7000 },
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: external || 'http://127.0.0.1:3107',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: external ? undefined : {
    command: 'node server.js',
    url: 'http://127.0.0.1:3107/api/health',
    reuseExistingServer: false,
    env: { PORT: '3107', ALLOW_TEST_RESET: '0', DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'qa-shop-e2e-')) },
  },
});
