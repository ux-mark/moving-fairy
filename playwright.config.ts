import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  outputDir: 'e2e/results/',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3333',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 14'],
      },
    },
    {
      name: 'tablet',
      use: {
        ...devices['iPad (gen 7)'],
      },
    },
  ],
  webServer: {
    command: 'pnpm dev --port 3001',
    url: 'http://localhost:3333',
    reuseExistingServer: !process.env.CI,
  },
})
