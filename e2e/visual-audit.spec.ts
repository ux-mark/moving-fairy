import { test, expect } from '@playwright/test'

test('visual audit - landing page', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: 'e2e/results/audit-landing-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 375, height: 812 })
  await page.screenshot({ path: 'e2e/results/audit-landing-mobile.png', fullPage: true })
})

test('visual audit - inventory page', async ({ page }) => {
  // Try test-auth, then follow wherever it goes
  const response = await page.goto('/api/test-auth')
  await page.waitForLoadState('networkidle')

  // Take screenshot of whatever page we landed on
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.screenshot({ path: 'e2e/results/audit-inventory-desktop.png', fullPage: true })

  await page.setViewportSize({ width: 375, height: 812 })
  await page.screenshot({ path: 'e2e/results/audit-inventory-mobile.png', fullPage: true })
})
