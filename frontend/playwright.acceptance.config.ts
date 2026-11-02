import { defineConfig } from '@playwright/test';
import regression from './playwright.config';

export default defineConfig({
  ...regression,
  testDir: './acceptance',
  timeout: 120_000,
  expect: { timeout: 25_000 },
  outputDir: '../artifacts/phase-7/test-results',
  reporter: [['list'], ['junit', { outputFile: '../artifacts/phase-7/junit.xml' }]],
  use: {
    ...regression.use,
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://frontend:3000',
  },
});
