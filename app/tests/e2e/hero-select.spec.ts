import { test, expect, type Page } from '@playwright/test'

/**
 * Hero selection: New Game opens a hero picker; choosing a non-Arythea hero
 * starts a game with that hero's unique card in hand.
 */

async function setup(page: Page, lang = 'en') {
  await page.addInitScript((l) => {
    localStorage.setItem('mageknightLang', l as string)
    localStorage.setItem('tutorial_seen', '1')
    localStorage.setItem('ad_disabled', '1')
    ;['tipTactic','tipTurn','tipMove','tipCombat','tipDamage','tipLevelUp','tipSite','tipEndTurn'].forEach((k) => localStorage.setItem(`gameTips_seen_${k}`, '1'))
  }, lang)
}

test('choosing Tovak starts a game with Tovak\'s unique card (Cold Toughness)', async ({ page }) => {
  const crashes: string[] = []
  page.on('pageerror', (e) => crashes.push(e.message))

  await setup(page, 'en')
  await page.goto('/?seed=10')
  await page.getByRole('button', { name: /New Game/i }).click()

  // Hero picker appears
  await expect(page.getByText(/Choose your hero/i)).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: /Tovak/i }).click()

  // Game starts
  await page.waitForSelector('canvas', { timeout: 15000 })
  const tac = page.locator('.backdrop-blur-sm').filter({ hasText: /Select Tactic/i })
  if (await tac.isVisible({ timeout: 2000 }).catch(() => false)) {
    await tac.locator('button.group').first().click({ force: true }); await page.waitForTimeout(500)
  }

  // Tovak's unique starting card (Cold Toughness) is in hand; Arythea's (Battle Versatility) is not
  const hand = page.locator('[data-tutorial="card-hand"]')
  await expect(hand.first()).toBeVisible({ timeout: 10000 })
  await expect(hand.getByText(/Cold Toughness/i).first()).toBeVisible({ timeout: 5000 })
  await expect(hand.getByText(/Battle Versatility/i)).toHaveCount(0)

  expect(crashes).toEqual([])
})
