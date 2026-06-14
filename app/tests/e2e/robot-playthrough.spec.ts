import { test, expect, type Page, type ConsoleMessage } from '@playwright/test'

/**
 * Robot playthrough — drives the game like a curious user for several rounds,
 * exercising card basic effects (decision overlays), interactions, recruiting
 * and combat, while watching for crashes, console errors and stuck states.
 */

async function suppressAllTips(page: Page) {
  await page.evaluate(() => {
    const tipKeys = ['tipTactic','tipTurn','tipMove','tipCombat','tipDamage','tipLevelUp','tipSite','tipEndTurn']
    tipKeys.forEach(k => localStorage.setItem(`gameTips_seen_${k}`, '1'))
    localStorage.setItem('tutorial_seen', '1')
    localStorage.setItem('ad_disabled', '1')
  })
}

async function visible(page: Page, locator: ReturnType<Page['locator']>, timeout = 250): Promise<boolean> {
  return await locator.isVisible({ timeout }).catch(() => false)
}

test.describe('Robot Playthrough', () => {
  test.setTimeout(420_000)

  test('plays adaptively for many turns without crashing or getting stuck', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        const txt = msg.text()
        if (!txt.includes('favicon') && !txt.includes('ads') && !txt.includes('net::ERR')) errors.push(txt)
      }
    })
    page.on('pageerror', (err) => errors.push(`[CRASH] ${err.message}`))

    await page.goto('/?seed=42')
    await suppressAllTips(page)
    await page.getByRole('button', { name: /New Game/i }).click()
    await page.getByRole("button", { name: /Arythea|아리시아/ }).first().click({ force: true, timeout: 5000 }).catch(() => undefined)
    await page.waitForSelector('canvas', { timeout: 15_000 })

    const stats = {
      turnsEnded: 0, cardsPlayedBasic: 0, sideways: 0, decisions: 0,
      combos: 0, interactions: 0, recruits: 0, combats: 0, levelUps: 0, rounds: 0,
    }
    let stuckCounter = 0
    let lastSignature = ''

    for (let step = 0; step < 400; step++) {
      // ── Terminal states ──
      if (await visible(page, page.getByText(/Total Score/i))) break

      // Stuck detection: snapshot key UI state
      const signature = await page.evaluate(() => document.body.innerText.length) + ''
      if (signature === lastSignature) stuckCounter++
      else stuckCounter = 0
      lastSignature = signature
      if (stuckCounter > 40) throw new Error(`Robot stuck at step ${step}`)

      // ── Overlays (priority order) ──
      const roundContinue = page.locator('.backdrop-blur-sm').filter({ hasText: /Round Complete/i }).getByRole('button', { name: /Continue/i })
      if (await visible(page, roundContinue)) {
        await roundContinue.click({ force: true }).catch(() => undefined)
        stats.rounds++
        await page.waitForTimeout(400)
        continue
      }

      const tacticOverlay = page.locator('.backdrop-blur-sm').filter({ hasText: /Select Tactic/i })
      if (await visible(page, tacticOverlay)) {
        await tacticOverlay.locator('button.group').last().click({ force: true }).catch(() => undefined)
        const skip = page.getByText('Skip', { exact: true })
        if (await visible(page, skip, 600)) await skip.click({ force: true }).catch(() => undefined)
        await page.waitForTimeout(300)
        continue
      }

      // Level-up: pick first skill & first AA then continue
      const levelUpDialog = page.locator('div[role="dialog"]').filter({ hasText: /Level Up!/i })
      if (await visible(page, levelUpDialog)) {
        stats.levelUps++
        const choices = levelUpDialog.locator('button')
        const count = await choices.count()
        for (let i = 0; i < count; i++) {
          const cls = (await choices.nth(i).getAttribute('class')) ?? ''
          if (cls.includes('rounded-xl')) await choices.nth(i).click({ force: true }).catch(() => undefined)
        }
        const cont = levelUpDialog.getByRole('button', { name: /Continue/i })
        if (await visible(page, cont) && await cont.isEnabled().catch(() => false)) {
          await cont.click({ force: true }).catch(() => undefined)
        }
        await page.waitForTimeout(300)
        continue
      }

      // Reward overlay
      const rewardClaim = page.getByRole('button', { name: /Claim|Take Reward|Collect/i }).first()
      if (await visible(page, rewardClaim)) {
        await rewardClaim.click({ force: true }).catch(() => undefined)
        await page.waitForTimeout(300)
        continue
      }

      // Card decision overlays (choose effect / choose color)
      const decisionOverlay = page.locator('.backdrop-blur-sm').filter({ hasText: /Choose Effect|Choose Color/ })
      if (await visible(page, decisionOverlay)) {
        stats.decisions++
        const option = decisionOverlay.locator('button.rounded-xl').first()
        if (await visible(page, option)) await option.click({ force: true }).catch(() => undefined)
        else await decisionOverlay.getByRole('button', { name: /Cancel/i }).click({ force: true }).catch(() => undefined)
        await page.waitForTimeout(250)
        continue
      }

      // Combo target selection (CardSelectionOverlay) / Improvisation discard
      const selectionOverlay = page.locator('.backdrop-blur-sm').filter({ hasText: /Choose a card to play with it|Improvisation/i })
      if (await visible(page, selectionOverlay)) {
        stats.combos++
        const firstCard = selectionOverlay.locator('button').first()
        await firstCard.click({ force: true }).catch(() => undefined)
        const confirm = selectionOverlay.getByRole('button', { name: /Play|Discard|Confirm/i }).last()
        if (await visible(page, confirm) && await confirm.isEnabled().catch(() => false)) {
          await confirm.click({ force: true }).catch(() => undefined)
        }
        // Improvisation step 2
        const effectChoice = page.locator('.backdrop-blur-sm').filter({ hasText: /Choose Effect/i }).locator('button.rounded-xl').first()
        if (await visible(page, effectChoice, 800)) await effectChoice.click({ force: true }).catch(() => undefined)
        await page.waitForTimeout(250)
        continue
      }

      // Interaction dialog: play influence then buy what's affordable
      const interactionDialog = page.getByRole('dialog', { name: /Interaction/i })
      if (await visible(page, interactionDialog)) {
        const sideways = interactionDialog.getByRole('button', { name: /Sideways \+1/i })
        while (await sideways.count() > 0) {
          await sideways.first().click({ force: true }).catch(() => undefined)
          await page.waitForTimeout(120)
          stats.sideways++
          if (stats.sideways > 60) break
        }
        const recruit = interactionDialog.getByRole('button', { name: /Recruit Unit/i })
        const rc = await recruit.count()
        for (let i = 0; i < rc; i++) {
          if (await recruit.nth(i).isEnabled().catch(() => false)) {
            await recruit.nth(i).click({ force: true }).catch(() => undefined)
            stats.recruits++
            break
          }
        }
        await interactionDialog.getByRole('button', { name: /^Done$/i }).click({ force: true }).catch(() => undefined)
        await page.waitForTimeout(300)
        continue
      }

      // Combat: confirm through phases (no card plays — take the hits)
      const combatRegion = page.locator('[aria-label="Combat"]')
      if (await visible(page, combatRegion)) {
        const next = page.getByRole('button', { name: /Confirm|Continue|End Combat|Next|Assign|Skip/i }).first()
        if (await visible(page, next) && await next.isEnabled().catch(() => false)) {
          await next.click({ force: true }).catch(() => undefined)
        } else {
          // assign damage to hero buttons (+) if present
          const plus = page.getByRole('button', { name: '+' }).first()
          if (await visible(page, plus)) await plus.click({ force: true }).catch(() => undefined)
        }
        await page.waitForTimeout(300)
        continue
      }

      // Interact at site when available (every time — exercises shops)
      const interact = page.getByRole('button', { name: /^Interact$/i })
      if (await visible(page, interact)) {
        stats.interactions++
        await interact.click({ force: true }).catch(() => undefined)
        await page.waitForTimeout(400)
        continue
      }

      // Card detail modal open → prefer Basic Effect (exercises new effect paths)
      const basicButton = page.getByRole('button', { name: /^Basic Effect$/i }).first()
      if (await visible(page, basicButton)) {
        if (await basicButton.isEnabled().catch(() => false) && step % 3 !== 2) {
          await basicButton.click({ force: true }).catch(() => undefined)
          stats.cardsPlayedBasic++
        } else {
          const side = page.getByRole('button', { name: /\+1 move/i })
          if (await visible(page, side)) {
            await side.click({ force: true }).catch(() => undefined)
            stats.sideways++
          } else {
            await page.keyboard.press('Escape')
          }
        }
        await page.waitForTimeout(250)
        continue
      }

      // Movement pending confirm
      const confirmMove = page.getByRole('button', { name: /Confirm Move/i })
      if (await visible(page, confirmMove)) {
        await confirmMove.click({ force: true }).catch(() => undefined)
        await page.waitForTimeout(300)
        continue
      }

      // Move toward an opportunity if any is reachable
      const opportunity = page.locator('[data-tutorial="opportunities"] button').first()
      if (await visible(page, opportunity) && step % 2 === 0) {
        await opportunity.click({ force: true }).catch(() => undefined)
        await page.waitForTimeout(300)
        continue
      }

      // Open a hand card
      const hand = page.locator('[data-tutorial="card-hand"] button')
      if (await hand.count() > 0 && step % 4 !== 3) {
        await hand.first().click({ force: true }).catch(() => undefined)
        await page.waitForTimeout(200)
        continue
      }

      // End turn / end round
      const endTurn = page.locator('[data-tutorial="end-turn"]')
      if (await visible(page, endTurn)) {
        await endTurn.click({ force: true }).catch(() => undefined)
        stats.turnsEnded++
        await page.waitForTimeout(400)
        continue
      }
      const endRound = page.locator('[data-tutorial="end-round"]')
      if (await visible(page, endRound)) {
        await endRound.click({ force: true }).catch(() => undefined)
        await page.waitForTimeout(600)
        continue
      }

      await page.waitForTimeout(300)
    }

    console.log('[robot]', JSON.stringify(stats))
    // The game must have progressed meaningfully
    expect(stats.turnsEnded).toBeGreaterThan(3)
    expect(errors.filter((e) => e.includes('[CRASH]'))).toHaveLength(0)
    expect(errors).toHaveLength(0)
  })
})
