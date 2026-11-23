const { defineConfig, devices } = require('@playwright/test');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const external = process.env.BASE_URL;
const profiles = [
  { name: 'chromium', device: 'Desktop Chrome', port: 3107 },
  { name: 'firefox', device: 'Desktop Firefox', port: 3108 },
  { name: 'webkit', device: 'Desktop Safari', port: 3109 },
  { name: 'mobile-chromium', device: 'Pixel 7', port: 3110, mobile: true },
  { name: 'mobile-webkit', device: 'iPhone 13', port: 3111, mobile: true },
];
module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 30000,
  expect: { timeout: 7000 },
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure', video: 'retain-on-failure' },
  projects: profiles.map(p => ({
    name: p.name,
    use: { ...devices[p.device], baseURL: external || 'http://127.0.0.1:' + p.port },
    ...(p.mobile ? { testMatch: '**/mobile.spec.js' } : { testIgnore: '**/mobile.spec.js' }),
  })),
  webServer: external ? undefined : profiles.map(p => ({
    name: p.name,
    command: 'node server.js',
    url: 'http://127.0.0.1:' + p.port + '/api/health',
    reuseExistingServer: false,
    env: { PORT: String(p.port), ALLOW_TEST_RESET: '0', DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'qa-shop-' + p.name + '-')) },
  })),
});
