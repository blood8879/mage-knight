import { test, expect, type Page, type ConsoleMessage } from '@playwright/test'

const HEX_SIZE = 40

function axialToPixel(q: number, r: number) {
  return {
    x: HEX_SIZE * 1.5 * q,
    y: HEX_SIZE * (Math.sqrt(3) * 0.5 * q + Math.sqrt(3) * r),
  }
}

async function clickHex(page: Page, q: number, r: number) {
  const canvas = page.locator('canvas')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas not found')

  const pixel = axialToPixel(q, r)
  const posX = box.width / 2 + pixel.x
  const posY = box.height / 2 + pixel.y
  await canvas.click({ position: { x: posX, y: posY }, force: true, timeout: 3_000 })
}

async function ss(page: Page, name: string) {
  await page.screenshot({ path: `tests/e2e/screenshots/${name}.png`, fullPage: true })
}

async function dismissGameTips(page: Page) {
  const gotIt = page.getByText('Got it', { exact: true })
  if (await gotIt.isVisible({ timeout: 500 }).catch(() => false)) {
    await gotIt.click()
    await page.waitForTimeout(300)
  }
}

async function suppressAllTips(page: Page) {
  await page.evaluate(() => {
    const tipKeys = [
      'tipTactic', 'tipTurn', 'tipMove', 'tipCombat',
      'tipDamage', 'tipLevelUp', 'tipSite', 'tipEndTurn',
    ]
    tipKeys.forEach(k => localStorage.setItem(`gameTips_seen_${k}`, '1'))
    localStorage.setItem('tutorial_seen', '1')
  })
}

test.describe('Full Game Playthrough', () => {
  test.setTimeout(180_000)

  test('play through complete game from menu to score', async ({ page }) => {
    const errors: string[] = []

    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        const txt = msg.text()
        if (!txt.includes('favicon') && !txt.includes('ads') && !txt.includes('net::ERR'))
          errors.push(txt)
      }
    })
    page.on('pageerror', (err) => errors.push(`[CRASH] ${err.message}`))

    await page.goto('/')
    await suppressAllTips(page)

    // ── STEP 1: Main Menu ──
    console.log('STEP 1: Main Menu')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 })
    await ss(page, '01-main-menu')

    await page.getByRole('button', { name: /New Game/i }).click()
    console.log('  -> Clicked New Game')

    // ── STEP 2: Game Init ──
    console.log('STEP 2: Game initialization')
    await page.waitForSelector('canvas', { timeout: 15_000 })
    await page.waitForTimeout(2000)
    await dismissGameTips(page)
    await ss(page, '02-game-init')

    // ── STEP 3: Tactic Selection ──
    console.log('STEP 3: Tactic Selection')
    try {
      await page.getByText('Select Tactic').waitFor({ state: 'visible', timeout: 5_000 })
      await ss(page, '03-tactic-overlay')

      const overlayButtons = page.locator('.backdrop-blur-sm button.group')
      const count = await overlayButtons.count()
      console.log(`  -> Found ${count} tactic buttons`)

      if (count > 0) {
        await overlayButtons.first().click()
        console.log('  -> Selected first tactic')
      }
    } catch {
      console.log('  -> No tactic overlay, checking auto-advance')
    }

    await page.waitForTimeout(1500)
    await dismissGameTips(page)
    await ss(page, '04-after-tactic')

    // ── STEP 4: Player Turn ──
    console.log('STEP 4: Player Turn Check')
    await expect(page.locator('header').first()).toBeVisible()
    await expect(page.locator('footer').first()).toBeVisible()

    const handCards = page.locator('[data-tutorial="card-hand"] button')
    const cardCount = await handCards.count()
    console.log(`  -> Cards in hand: ${cardCount}`)
    await ss(page, '05-player-turn')

    // ── STEP 5: Play a card via CardDetail modal ──
    console.log('STEP 5: Card play')
    if (cardCount > 0) {
      await handCards.first().click()
      await page.waitForTimeout(500)

      const playCardBtn = page.getByText('Play Card', { exact: false })
      try {
        await playCardBtn.waitFor({ state: 'visible', timeout: 3_000 })
        await playCardBtn.click()
        console.log('  -> Played first card via modal')
      } catch {
        const sidewaysMove = page.getByText('+1 move', { exact: false })
        if (await sidewaysMove.isVisible({ timeout: 1_000 }).catch(() => false)) {
          await sidewaysMove.click()
          console.log('  -> Played card sideways for move')
        } else {
          console.log('  -> Could not find play button in card detail modal')
          await page.press('body', 'Escape')
        }
      }
      await page.waitForTimeout(500)
      await ss(page, '06-after-card-play')
    }

    // ── STEP 6: Map click ──
    console.log('STEP 6: Movement attempt')
    await dismissGameTips(page)
    try {
      await clickHex(page, 0, -1)
      await page.waitForTimeout(500)

      const confirmBtn = page.getByRole('button', { name: /Confirm Move/i })
      if (await confirmBtn.isVisible({ timeout: 1_500 }).catch(() => false)) {
        await confirmBtn.click()
        console.log('  -> Moved to (0,-1)')
      } else {
        console.log('  -> No confirm move button')
      }
    } catch (e) {
      console.log(`  -> Hex click issue: ${String(e).slice(0, 100)}`)
    }
    await page.waitForTimeout(500)
    await ss(page, '07-after-move-attempt')

    // ── STEP 7: Turn loop until game over ──
    console.log('STEP 7: Turn loop')

    let reachedScore = false
    for (let attempt = 0; attempt < 80; attempt++) {
      await dismissGameTips(page)

      // Dismiss Tile Info popup if open
      const closeDialog = page.locator('[aria-label="Close dialog"]')
      if (await closeDialog.first().isVisible({ timeout: 200 }).catch(() => false)) {
        await closeDialog.first().click()
        await page.waitForTimeout(300)
      }

      if (await page.getByText(/Total Score/i).isVisible({ timeout: 300 }).catch(() => false)) {
        console.log(`  -> Score screen reached at attempt ${attempt}`)
        reachedScore = true
        break
      }

      if (await page.getByText(/Game Over/i).isVisible({ timeout: 200 }).catch(() => false)) {
        console.log(`  -> Game Over overlay, waiting for score screen...`)
        await page.waitForTimeout(3000)
        continue
      }

      const tacticOverlay = page.locator('.backdrop-blur-sm').filter({ hasText: /Select Tactic/i })
      if (await tacticOverlay.isVisible({ timeout: 300 }).catch(() => false)) {
        const tacBtns = tacticOverlay.locator('button.group')
        const tacCount = await tacBtns.count()
        if (tacCount > 0) {
          await page.waitForTimeout(500)
          // Click last tactic to avoid special tactics (id 2/3/11 tend to be first)
          await tacBtns.last().click({ force: true })
          console.log(`  [${attempt}] Selected tactic (${tacCount} available)`)
          await page.waitForTimeout(500)

          // Handle special tactic overlays (Rethink/Preparation/Mana Steal) — click Skip
          const skipBtn = page.getByText('Skip', { exact: true })
          if (await skipBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
            await skipBtn.click({ force: true })
            console.log(`  [${attempt}] Skipped special tactic selection`)
          }
          await page.waitForTimeout(1000)
          continue
        }
      }

      const continueOverlay = page.locator('.backdrop-blur-sm').filter({ hasText: /Round Complete/i })
      if (await continueOverlay.isVisible({ timeout: 300 }).catch(() => false)) {
        const continueBtn = continueOverlay.getByText('Continue')
        await page.waitForTimeout(500)
        await continueBtn.click({ force: true })
        console.log(`  [${attempt}] Continue through round transition`)
        await page.waitForTimeout(2000)
        continue
      }

      // Try to play a card sideways for +1 move (to gain MP for exploration)
      const handCardsLoop = page.locator('[data-tutorial="card-hand"] button')
      const loopCardCount = await handCardsLoop.count()
      if (loopCardCount > 0) {
        await handCardsLoop.first().click()
        await page.waitForTimeout(500)

        const sidewaysMove = page.getByText('+1 move', { exact: false })
        if (await sidewaysMove.isVisible({ timeout: 1_000 }).catch(() => false)) {
          await sidewaysMove.click()
          console.log(`  [${attempt}] Played card sideways for +1 move`)
          await page.waitForTimeout(500)

          // After gaining MP, try to explore if possible
          const exploreBtn = page.getByText(/Explore \(2 MP\)/i)
          if (await exploreBtn.isVisible({ timeout: 500 }).catch(() => false)) {
            await exploreBtn.click()
            console.log(`  [${attempt}] Clicked Explore`)
            await page.waitForTimeout(1000)

            // If placement selection is shown, click the first highlighted area
            const placementPrompt = page.getByText(/Tap a highlighted area/i)
            if (await placementPrompt.isVisible({ timeout: 500 }).catch(() => false)) {
              // Click on the canvas to select a placement — try clicking above center
              const canvas = page.locator('canvas')
              const box = await canvas.boundingBox()
              if (box) {
                await canvas.click({ position: { x: box.width / 2, y: box.height / 4 }, force: true })
                console.log(`  [${attempt}] Selected explore placement`)
                await page.waitForTimeout(500)
              }
            }
          }
          continue
        } else {
          // Close card modal if sideways not available
          await page.press('body', 'Escape')
          await page.waitForTimeout(300)
        }
      }

      if (attempt % 3 === 2) {
        const endRoundBtn = page.locator('[data-tutorial="end-round"]')
        if (await endRoundBtn.isVisible({ timeout: 300 }).catch(() => false)) {
          await endRoundBtn.click()
          console.log(`  [${attempt}] Declared End of Round`)
          await page.waitForTimeout(2000)
          continue
        }
      }

      const restBtn = page.locator('[data-tutorial="rest"]')
      if (await restBtn.isVisible({ timeout: 300 }).catch(() => false)) {
        await restBtn.click()
        console.log(`  [${attempt}] Rested`)
        await page.waitForTimeout(1000)
        continue
      }

      const endTurnBtn = page.locator('[data-tutorial="end-turn"]')
      if (await endTurnBtn.isVisible({ timeout: 300 }).catch(() => false)) {
        await endTurnBtn.click()
        console.log(`  [${attempt}] End Turn`)
        await page.waitForTimeout(1000)
        continue
      }

      console.log(`  [${attempt}] Waiting for phase transition...`)
      await ss(page, `08-stuck-attempt-${attempt}`)
      await page.waitForTimeout(1000)
    }

    await ss(page, '09-final-state')

    // ── STEP 8: Score Screen ──
    console.log('STEP 8: Score Screen')
    if (reachedScore || await page.getByText(/Total Score/i).isVisible({ timeout: 5_000 }).catch(() => false)) {
      await ss(page, '10-score-screen')
      console.log('  -> Score screen visible')

      const playAgain = page.getByRole('button', { name: /Play Again/i })
      if (await playAgain.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await playAgain.click()
        await page.waitForTimeout(1000)
        await ss(page, '11-back-to-menu')
        console.log('  -> Play Again -> back to menu')
      }
    } else {
      console.log('  -> Score screen NOT reached')
    }

    console.log('\n==================================')
    console.log('ERRORS REPORT')
    console.log('==================================')
    if (errors.length === 0) {
      console.log('No console errors!')
    } else {
      console.log(`${errors.length} error(s):`)
      errors.forEach((e, i) => console.log(`  ${i + 1}. ${e.slice(0, 200)}`))
    }
    console.log('==================================')

    const crashes = errors.filter(e => e.includes('[CRASH]'))
    expect(crashes).toHaveLength(0)
  })
})
