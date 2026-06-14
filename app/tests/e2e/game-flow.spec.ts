import { test, expect } from '@playwright/test'

test.describe('Game Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Mage Knight Board Game' }),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('should start a new game and render game screen elements', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'New Game' }).click()
    await page.getByRole("button", { name: /Arythea|아리시아/ }).first().click({ force: true, timeout: 5000 }).catch(() => undefined)

    await page.waitForSelector('.bg-slate-950', { timeout: 10_000 })

    await expect(
      page
        .getByText(/Loading|Initializing|Select a tactic|Start your turn|New round/)
        .first(),
    ).toBeVisible({ timeout: 15_000 })
  })

  test('should show game phase UI during gameplay', async ({ page }) => {
    await page.evaluate(() => {
      const tipKeys = [
        'tipTactic', 'tipTurn', 'tipMove', 'tipCombat',
        'tipDamage', 'tipLevelUp', 'tipSite', 'tipEndTurn',
      ]
      tipKeys.forEach(k => localStorage.setItem(`gameTips_seen_${k}`, '1'))
    })

    await page.getByRole('button', { name: 'New Game' }).click()
    await page.getByRole("button", { name: /Arythea|아리시아/ }).first().click({ force: true, timeout: 5000 }).catch(() => undefined)

    await page.waitForSelector('canvas', { timeout: 15_000 })
    await page.waitForTimeout(1000)

    const gameUI = page
      .getByText(/Select Tactic|Play cards|Choose your action|End Turn|Round \d/)
      .first()
    await expect(gameUI).toBeVisible({ timeout: 15_000 })
  })
})
