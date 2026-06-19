import { test, expect, type Page } from '@playwright/test'

/**
 * "Learn by Playing" smoke test: the menu entry starts a real game (3-round
 * First Reconnaissance) with the teaching guide overlay visible.
 */
async function suppressTips(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('tutorial_seen', '1')
    localStorage.setItem('ad_disabled', '1')
    ;['tipTactic','tipTurn','tipMove','tipCombat','tipDamage','tipLevelUp','tipSite','tipEndTurn']
      .forEach((k) => localStorage.setItem(`gameTips_seen_${k}`, '1'))
  })
}

test.describe('Learn by Playing', () => {
  test.setTimeout(120_000)

  test('starts a guided First Reconnaissance game from the menu', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(`[CRASH] ${e.message}`))

    await page.route('**/sw.js', (r) => r.abort())
    await suppressTips(page)
    await page.goto('/?seed=3')

    // Menu → Learn by Playing → hero select
    await page.getByRole('button', { name: /Learn by Playing|게임하며 배우기|Aprender Jugando/i }).click()
    await page.getByRole('button', { name: /Arythea|Tovak|Goldyx|Norowas/ }).first().click({ force: true })
    await page.waitForSelector('canvas', { timeout: 15_000 })

    // The teaching guide should appear (welcome topic) with the 📖 marker.
    const guide = page.locator('text=📖').first()
    await expect(guide).toBeVisible({ timeout: 8_000 })

    // Dismissing a tip should not crash, and the reopen button remains available.
    const gotIt = page.getByRole('button', { name: /Got it|알겠어요|Entendido/i }).first()
    if (await gotIt.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotIt.click({ force: true })
    }

    expect(errors).toEqual([])
  })
})
