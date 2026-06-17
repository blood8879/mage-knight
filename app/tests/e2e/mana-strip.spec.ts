import { test, expect, type Page } from '@playwright/test'

/**
 * The mana pool ManaStrip must be reachable inside full-screen overlays
 * (combat tray + interaction panel) so the player can take Source dice / spend
 * crystals when mana wasn't activated before entering.
 */

async function newGame(page: Page, url: string) {
  await page.addInitScript(() => {
    localStorage.setItem('tutorial_seen', '1')
    localStorage.setItem('ad_disabled', '1')
    ;['tipTactic','tipTurn','tipMove','tipCombat','tipDamage','tipLevelUp','tipSite','tipEndTurn'].forEach((k) => localStorage.setItem(`gameTips_seen_${k}`, '1'))
  })
  // Block the service worker so its controllerchange auto-reload can't flake the run.
  await page.route('**/sw.js', (r) => r.abort())
  await page.goto(url)
  await page.getByRole('button', { name: /New Game/i }).click()
    await page.getByRole("button", { name: /Arythea|아리시아/ }).first().click({ force: true, timeout: 5000 }).catch(() => undefined)
  await page.waitForSelector('canvas', { timeout: 15_000 })
  await page.waitForTimeout(1000)
  const tac = page.locator('.backdrop-blur-sm').filter({ hasText: /Select Tactic/i })
  if (await tac.isVisible({ timeout: 2000 }).catch(() => false)) {
    await tac.locator('button.group').first().click({ force: true })
    await page.waitForTimeout(400)
  }
}

/** Explore toward an enemy and enter combat. The map varies by seed, so we can't
 * rely on an enemy being adjacent at the start — move via opportunities / sideways. */
async function reachCombat(page: Page): Promise<boolean> {
  const fight = page.getByRole('button', { name: /Fight/i })
  for (let attempt = 0; attempt < 30; attempt++) {
    if (await fight.first().isVisible({ timeout: 800 }).catch(() => false)) {
      await fight.first().click({ force: true }).catch(() => undefined)
      await page.waitForTimeout(1000)
      if (await page.locator('[aria-label="Combat"]').isVisible({ timeout: 1500 }).catch(() => false)) return true
    }
    const opp = page.locator('[data-tutorial="opportunities"] button').first()
    if (await opp.isVisible({ timeout: 400 }).catch(() => false)) {
      await opp.click({ force: true }).catch(() => undefined)
      const confirm = page.getByRole('button', { name: /Confirm Move/i })
      if (await confirm.isVisible({ timeout: 800 }).catch(() => false)) await confirm.click({ force: true }).catch(() => undefined)
      await page.waitForTimeout(300)
      continue
    }
    await playSidewaysMove(page)
  }
  return false
}

async function playSidewaysMove(page: Page) {
  const hand = page.locator('[data-tutorial="card-hand"] button')
  if (await hand.count() === 0) return
  await hand.first().click({ force: true, timeout: 2000 }).catch(() => undefined)
  const btn = page.getByRole('button', { name: /\+1 move/i })
  if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) await btn.click({ force: true }).catch(() => undefined)
  else await page.keyboard.press('Escape')
  await page.waitForTimeout(120)
}

test.describe('ManaStrip in overlays', () => {
  test.setTimeout(180_000)

  test('combat tray exposes the mana strip with Source dice', async ({ page }) => {
    await newGame(page, '/?seed=3')
    await expect(page.locator('[data-tutorial="card-hand"] button').first()).toBeVisible({ timeout: 10_000 })
    const inCombat = await reachCombat(page)
    expect(inCombat, 'should reach combat').toBe(true)

    const strip = page.locator('[aria-label="Combat"] [data-testid="mana-strip"]')
    await expect(strip).toBeVisible({ timeout: 5000 })
    expect(await strip.locator('button[aria-label$="mana die"]').count(), 'Source dice present in combat').toBeGreaterThan(0)
  })

  test('interaction panel exposes the mana strip with Source dice', async ({ page }) => {
    await newGame(page, '/')
    await expect(page.locator('[data-tutorial="card-hand"] button').first()).toBeVisible({ timeout: 10_000 })

    const villageOpp = page.locator('[data-tutorial="opportunities"] button').filter({ hasText: /Village/i }).first()
    for (let i = 0; i < 10; i++) {
      if (await villageOpp.isVisible({ timeout: 1000 }).catch(() => false)) break
      await playSidewaysMove(page)
    }
    await expect(villageOpp).toBeVisible({ timeout: 15_000 })
    const confirm = page.getByRole('button', { name: /Confirm Move/i })
    for (let i = 0; i < 6; i++) {
      await villageOpp.click({ force: true }).catch(() => undefined)
      if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) break
    }
    await confirm.click({ force: true })

    const interact = page.getByRole('button', { name: /^Interact$/i })
    await expect(interact).toBeVisible({ timeout: 10_000 })
    const dialog = page.getByRole('dialog', { name: /Interaction/i })
    for (let i = 0; i < 5; i++) {
      await interact.click({ force: true }).catch(() => undefined)
      if (await dialog.isVisible({ timeout: 2000 }).catch(() => false)) break
    }
    await expect(dialog).toBeVisible({ timeout: 15_000 })

    const strip = dialog.locator('[data-testid="mana-strip"]')
    await expect(strip).toBeVisible({ timeout: 5000 })
    expect(await strip.locator('button[aria-label$="mana die"]').count()).toBeGreaterThan(0)

    await dialog.getByRole('button', { name: /^Done$/i }).click({ force: true })
  })
})
