import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';

// Environment comes from .env (see .env.example). No dotenv dependency needed.
if (fs.existsSync('.env')) process.loadEnvFile('.env');

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4000';
const startDemo = process.env.START_DEMO_APP !== '0' && /localhost:4000/.test(BASE_URL) && fs.existsSync('demo-app/server.js');
export const AUTH_FILE = '.auth/user.json';

export default defineConfig({
  testDir: './playwright/tests',
  outputDir: './reports/artifacts', // screenshots, traces, error-context per failed test
  fullyParallel: true,
  workers: process.env.WORKERS ? Number(process.env.WORKERS) : undefined,
  retries: Number(process.env.RETRIES ?? 0),
  forbidOnly: !!process.env.CI,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['json', { outputFile: 'reports/results.json' }],
    ['./playwright/utils/traceability-reporter.ts', { outputDir: 'reports' }],
  ],
  use: {
    baseURL: BASE_URL,
    testIdAttribute: 'data-testid',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 10_000,
    locale: 'vi-VN',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE },
      dependencies: ['setup'],
    },
  ],
  webServer: startDemo
    ? {
        command: 'node demo-app/server.js',
        url: `${BASE_URL}/api/health`,
        reuseExistingServer: !process.env.CI,
        env: { DEMO_UI_VERSION: process.env.DEMO_UI_VERSION ?? '1' },
      }
    : undefined,
});
