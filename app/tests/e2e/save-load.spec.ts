import { test, expect, type Page } from '@playwright/test'

/**
 * Save/Continue round-trip:
 * play a couple of turns → Save & Main Menu → Continue → the loaded game
 * resumes at the same round/turn with the same fame, and remains playable.
 */

async function suppressTips(page: Page) {
  await page.evaluate(() => {
    const tipKeys = ['tipTactic','tipTurn','tipMove','tipCombat','tipDamage','tipLevelUp','tipSite','tipEndTurn']
    tipKeys.forEach(k => localStorage.setItem(`gameTips_seen_${k}`, '1'))
    localStorage.setItem('tutorial_seen', '1')
    localStorage.setItem('ad_disabled', '1')
  })
}

async function selectTacticIfVisible(page: Page) {
  const overlay = page.locator('.backdrop-blur-sm').filter({ hasText: /Select Tactic/i })
  if (!await overlay.isVisible({ timeout: 1500 }).catch(() => false)) return false
  await overlay.locator('button.group').first().click({ force: true })
  await page.waitForTimeout(400)
  return true
}

interface Snapshot { round: number; turnCount: number; fame: number; handSize: number }

async function readState(page: Page): Promise<Snapshot | null> {
  return page.evaluate(() => {
    const s = (window as unknown as Record<string, any>).__MK_STATE__
    if (!s) return null
    return {
      round: s.round,
      turnCount: s.turnCount,
      fame: s.player.fame,
      handSize: s.player.deck.hand.length,
    }
  })
}

test.describe('Save / Continue', () => {
  test.setTimeout(180_000)

  test('autosaves, exits to menu and continues the same game', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        if (!text.includes('favicon') && !text.includes('ads') && !text.includes('net::ERR')) errors.push(text)
      }
    })
    page.on('pageerror', (err) => errors.push(`[CRASH] ${err.message}`))

    await page.goto('/?seed=10&debug=1')
    await suppressTips(page)
    await page.getByRole('button', { name: /New Game/i }).click()
    await page.getByRole("button", { name: /Arythea|아리시아/ }).first().click({ force: true, timeout: 5000 }).catch(() => undefined)
    await page.waitForSelector('canvas', { timeout: 15_000 })
    await selectTacticIfVisible(page)
    await expect(page.locator('[data-tutorial="card-hand"] button').first()).toBeVisible({ timeout: 15_000 })

    // Wait for the first turn to actually begin before ending it
    await expect.poll(async () => (await readState(page))?.turnCount ?? 0, { timeout: 15_000 }).toBeGreaterThanOrEqual(1)

    // End a turn so the next one begins (autosave fires on the boundary);
    // retried because banner animations can swallow the first click
    const initialTurn = (await readState(page))!.turnCount
    for (let attempt = 0; attempt < 5; attempt++) {
      await page.getByRole('button', { name: /End Turn/i }).first().click({ force: true })
      await page.waitForTimeout(1000)
      const s = await readState(page)
      console.log(`  [end-turn attempt ${attempt}] state: ${JSON.stringify(s)}`)
      if ((s?.turnCount ?? 0) > initialTurn) break
    }

    const before = await readState(page)
    expect(before).not.toBeNull()
    expect(before!.turnCount).toBeGreaterThanOrEqual(2)
    console.log(`  before: round ${before!.round}, turn ${before!.turnCount}, fame ${before!.fame}`)

    // Save & exit via the in-game menu
    await page.getByRole('button', { name: /Menu/i }).first().click({ force: true })
    await page.getByRole('button', { name: /Save & Main Menu/i }).click({ force: true })
    await expect(page.getByRole('button', { name: /New Game/i })).toBeVisible({ timeout: 15_000 })

    // Continue resumes the same game
    const continueBtn = page.getByRole('button', { name: /Continue/i }).first()
    await expect(continueBtn).toBeVisible({ timeout: 15_000 })
    await continueBtn.click({ force: true })
    await page.waitForSelector('canvas', { timeout: 15_000 })
    await page.waitForTimeout(800)

    const after = await readState(page)
    expect(after).not.toBeNull()
    expect(after!.round).toBe(before!.round)
    expect(after!.turnCount).toBe(before!.turnCount)
    expect(after!.fame).toBe(before!.fame)
    expect(after!.handSize).toBe(before!.handSize)
    console.log(`  after:  round ${after!.round}, turn ${after!.turnCount}, fame ${after!.fame}`)

    // The restored game is still playable: end another turn (with retries —
    // transition banners can swallow the first click)
    let next = after
    for (let attempt = 0; attempt < 5; attempt++) {
      await page.getByRole('button', { name: /End Turn/i }).first().click({ force: true })
      await page.waitForTimeout(1000)
      next = await readState(page)
      if ((next?.turnCount ?? 0) > after!.turnCount) break
    }
    expect(next!.turnCount).toBeGreaterThan(after!.turnCount)

    console.log(`Console errors: ${errors.length ? errors.join('\n') : 'none'}`)
    expect(errors).toEqual([])
  })
})
