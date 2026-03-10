import { test, expect } from '@playwright/test'

test('landing page loads with email form', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: /Moving Fairy/i })).toBeVisible()
  await expect(page.getByText(/Aisling/)).toBeVisible()

  const emailInput = page.getByLabel(/email/i)
  await expect(emailInput).toBeVisible()
  await expect(emailInput).toHaveAttribute('type', 'email')

  await expect(page.getByRole('button', { name: /magic link/i })).toBeVisible()

  await page.screenshot({ path: 'e2e/results/landing-page.png', fullPage: true })
})

test('/auth/login redirects to landing page', async ({ page }) => {
  await page.goto('/auth/login')

  await expect(page).toHaveURL('/')
  await expect(page.getByLabel(/email/i)).toBeVisible()
})

test('email form submits and shows feedback', async ({ page }) => {
  await page.goto('/')

  const emailInput = page.getByLabel(/email/i)
  const submitBtn = page.getByRole('button', { name: /magic link/i })

  await emailInput.fill('test@example.com')
  await submitBtn.click()

  // Should show either "sent" confirmation or an error (Supabase may not be configured)
  // Either way the form should respond
  const sent = page.getByText(/magic link sent/i)
  const error = page.getByRole('alert')
  await expect(sent.or(error)).toBeVisible({ timeout: 10000 })

  await page.screenshot({ path: 'e2e/results/landing-after-submit.png', fullPage: true })
})
