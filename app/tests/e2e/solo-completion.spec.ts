import { test, expect, type Page, type ConsoleMessage } from '@playwright/test'

/**
 * Solo completion — the dummy player must keep taking turns and the game must
 * reach the final score screen through all rounds without manual intervention.
 */

async function suppressAllTips(page: Page) {
  await page.evaluate(() => {
    const tipKeys = ['tipTactic','tipTurn','tipMove','tipCombat','tipDamage','tipLevelUp','tipSite','tipEndTurn']
    tipKeys.forEach(k => localStorage.setItem(`gameTips_seen_${k}`, '1'))
    localStorage.setItem('tutorial_seen', '1')
    localStorage.setItem('ad_disabled', '1')
  })
}

async function selectTacticIfVisible(page: Page) {
  const overlay = page.locator('.backdrop-blur-sm').filter({ hasText: /Select Tactic/i })
  if (!await overlay.isVisible({ timeout: 400 }).catch(() => false)) return false
  await overlay.locator('button.group').last().click({ force: true })
  const skip = page.getByText('Skip', { exact: true })
  if (await skip.isVisible({ timeout: 800 }).catch(() => false)) await skip.click({ force: true })
  await page.waitForTimeout(300)
  return true
}

test.describe('Solo Completion', () => {
  test.setTimeout(360_000)

  test('dummy player advances rounds until the game ends at the score screen', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        const txt = msg.text()
        if (!txt.includes('favicon') && !txt.includes('ads') && !txt.includes('net::ERR')) errors.push(txt)
      }
    })
    page.on('pageerror', (err) => errors.push(`[CRASH] ${err.message}`))

    await page.goto('/?seed=5')
    await suppressAllTips(page)
    await page.getByRole('button', { name: /New Game/i }).click()
    await page.waitForSelector('canvas', { timeout: 15_000 })

    let roundsCompleted = 0
    let dummyTurnSeen = false
    let reachedScore = false

    for (let i = 0; i < 200; i++) {
      if (await page.getByText(/Total Score/i).isVisible({ timeout: 250 }).catch(() => false)) {
        reachedScore = true
        break
      }

      // dummy turn banner (TurnTransition) may flash between turns
      if (!dummyTurnSeen && await page.getByText(/Dummy's Turn/i).isVisible({ timeout: 100 }).catch(() => false)) {
        dummyTurnSeen = true
      }

      const roundContinue = page.locator('.backdrop-blur-sm').filter({ hasText: /Round Complete/i }).getByRole('button', { name: /Continue/i })
      if (await roundContinue.isVisible({ timeout: 250 }).catch(() => false)) {
        roundsCompleted++
        await roundContinue.click({ force: true }).catch(() => undefined)
        await page.waitForTimeout(400)
        continue
      }

      if (await selectTacticIfVisible(page)) continue

      // play sideways move twice to thin the hand, then end the turn
      const hand = page.locator('[data-tutorial="card-hand"] button')
      if (await hand.count() > 0) {
        for (let k = 0; k < 2; k++) {
          await hand.first().click({ force: true, timeout: 1_500 }).catch(() => undefined)
          const side = page.getByRole('button', { name: /\+1 move/i })
          if (await side.isVisible({ timeout: 700 }).catch(() => false)) {
            await side.click({ force: true }).catch(() => undefined)
          } else {
            await page.keyboard.press('Escape')
            break
          }
          await page.waitForTimeout(120)
        }
      }

      const endTurn = page.locator('[data-tutorial="end-turn"]')
      if (await endTurn.isVisible({ timeout: 400 }).catch(() => false)) {
        await endTurn.click({ force: true }).catch(() => undefined)
        await page.waitForTimeout(450)
        continue
      }
      const endRound = page.locator('[data-tutorial="end-round"]')
      if (await endRound.isVisible({ timeout: 300 }).catch(() => false)) {
        await endRound.click({ force: true }).catch(() => undefined)
        await page.waitForTimeout(600)
        continue
      }
      await page.waitForTimeout(300)
    }

    console.log(`[solo-completion] rounds=${roundsCompleted}, dummySeen=${dummyTurnSeen}, score=${reachedScore}`)
    expect(reachedScore).toBe(true)
    expect(roundsCompleted).toBeGreaterThanOrEqual(2)
    expect(errors.filter((e) => e.includes('[CRASH]'))).toHaveLength(0)
    expect(errors).toHaveLength(0)
  })
})
