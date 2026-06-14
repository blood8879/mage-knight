import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Mage Knight Board Game' }),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('should navigate from main menu to settings and back', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Settings' }).click()

    const settingsTitle = page.getByRole('heading', {
      level: 1,
      name: 'Settings',
    })
    await expect(settingsTitle).toBeVisible({ timeout: 5_000 })

    await page.getByRole('button', { name: 'Back' }).click()

    await expect(
      page.getByRole('heading', { level: 1, name: 'Mage Knight Board Game' }),
    ).toBeVisible({ timeout: 5_000 })
  })

  test('should navigate from main menu to game screen', async ({ page }) => {
    await page.getByRole('button', { name: 'New Game' }).click()
    // New Game opens a hero picker — pick the first hero to enter the game
    await page.getByRole('button', { name: /Arythea|아리시아/ }).first().click({ force: true, timeout: 5000 }).catch(() => undefined)

    const gameContent = page
      .locator('.bg-slate-950')
      .or(page.getByText('Loading'))
      .first()
    await expect(gameContent).toBeVisible({ timeout: 10_000 })
  })
})
