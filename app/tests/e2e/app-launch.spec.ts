import { test, expect } from '@playwright/test'

test.describe('App Launch', () => {
  test('should load and display the main menu title', async ({ page }) => {
    await page.goto('/')

    const title = page.getByRole('heading', { level: 1 })
    await expect(title).toBeVisible({ timeout: 10_000 })
    await expect(title).toHaveText('Mage Knight Board Game')
  })

  test('should display the subtitle', async ({ page }) => {
    await page.goto('/')

    const subtitle = page.getByText('Digital Companion')
    await expect(subtitle).toBeVisible({ timeout: 10_000 })
  })

  test('should show New Game and Settings buttons', async ({ page }) => {
    await page.goto('/')

    await expect(
      page.getByRole('button', { name: 'New Game' }),
    ).toBeVisible({ timeout: 10_000 })

    await expect(
      page.getByRole('button', { name: 'Settings' }),
    ).toBeVisible()
  })

  test('should show language selection buttons', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('button', { name: 'English' })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByRole('button', { name: '한국어' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Español' })).toBeVisible()
  })
})
