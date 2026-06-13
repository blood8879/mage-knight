import { test, expect } from '@playwright/test'

test.describe('Settings Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Mage Knight Board Game' }),
    ).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: 'Settings' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Settings' }),
    ).toBeVisible({ timeout: 5_000 })
  })

  test('should display the settings title', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: 'Settings' }),
    ).toBeVisible()
  })

  test('should show language options', async ({ page }) => {
    await expect(page.getByText('English', { exact: false }).first()).toBeVisible()
    await expect(page.getByText('한국어').first()).toBeVisible()
    await expect(page.getByText('Español').first()).toBeVisible()
  })

  test('should show theme section', async ({ page }) => {
    await expect(page.getByText('Dark')).toBeVisible()
    await expect(page.getByText('Light')).toBeVisible()
  })

  test('should show general settings toggles', async ({ page }) => {
    await expect(page.getByText('Sound Effects')).toBeVisible()
    await expect(page.getByText('Music')).toBeVisible()
    await expect(page.getByText('Animations')).toBeVisible()
  })

  test('should show a back button that returns to main menu', async ({
    page,
  }) => {
    const backButton = page.getByRole('button', { name: 'Back' })
    await expect(backButton).toBeVisible()

    await backButton.click()

    await expect(
      page.getByRole('heading', { level: 1, name: 'Mage Knight Board Game' }),
    ).toBeVisible({ timeout: 5_000 })
  })
})
