import { test, expect, type Page } from '@playwright/test'

/**
 * Deterministic verification of the card decision flows:
 * - Tranquility basic: choose draw → hand size stays equal (played 1, drew 1)
 * - Crystallize basic: pay a mana color → crystal of that color +1
 * - Mana Draw basic: grants an extra Source die this turn
 * The Arythea deck contains all these cards, so cycling turns will surface them.
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
  if (!await overlay.isVisible({ timeout: 600 }).catch(() => false)) return false
  await overlay.locator('button.group').last().click({ force: true })
  const skip = page.getByText('Skip', { exact: true })
  if (await skip.isVisible({ timeout: 800 }).catch(() => false)) await skip.click({ force: true })
  await page.waitForTimeout(300)
  return true
}

async function handleTransitions(page: Page) {
  const roundContinue = page.locator('.backdrop-blur-sm').filter({ hasText: /Round Complete/i }).getByRole('button', { name: /Continue/i })
  if (await roundContinue.isVisible({ timeout: 300 }).catch(() => false)) {
    await roundContinue.click({ force: true }).catch(() => undefined)
    await page.waitForTimeout(400)
  }
  await selectTacticIfVisible(page)
}

function handCardButton(page: Page, name: RegExp) {
  return page.locator('[data-tutorial="card-hand"] button').filter({ hasText: name }).first()
}

async function takeBasicSourceDie(page: Page): Promise<string | null> {
  for (const color of ['red', 'blue', 'green', 'white']) {
    const die = page.locator(`button[title="${color} mana die"]:not([disabled])`).first()
    if (await die.isVisible({ timeout: 200 }).catch(() => false)) {
      const tokensBefore = await page.locator(`div[title="${color} mana (from die)"]`).count()
      await die.click({ force: true }).catch(() => undefined)
      await page.waitForTimeout(250)
      const tokensAfter = await page.locator(`div[title="${color} mana (from die)"]`).count()
      if (tokensAfter > tokensBefore) return color
    }
  }
  return null
}

async function readCrystalCount(page: Page, color: string): Promise<number> {
  const btn = page.locator(`button[title^="${color}:"]`).first()
  const title = await btn.getAttribute('title').catch(() => null)
  return Number(title?.match(/: (\d+)\//)?.[1] ?? '0')
}

test.describe('Card Decisions', () => {
  test.setTimeout(300_000)

  test('Tranquility draw choice, Crystallize color pick and Mana Draw extra die', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(`[CRASH] ${err.message}`))

    await page.goto('/?seed=7')
    await suppressAllTips(page)
    await page.getByRole('button', { name: /New Game/i }).click()
    await page.waitForSelector('canvas', { timeout: 15_000 })
    await selectTacticIfVisible(page)

    const exercised = { tranquility: false, crystallize: false, manaDraw: false }

    for (let turn = 0; turn < 40; turn++) {
      if (exercised.tranquility && exercised.crystallize && exercised.manaDraw) break
      await handleTransitions(page)

      const hand = page.locator('[data-tutorial="card-hand"] button')
      if (await hand.count() === 0) {
        const endRound = page.locator('[data-tutorial="end-round"]')
        if (await endRound.isVisible({ timeout: 300 }).catch(() => false)) {
          await endRound.click({ force: true }).catch(() => undefined)
          await page.waitForTimeout(600)
          continue
        }
      }

      // ── Tranquility: basic → Choose Effect → Draw ──
      if (!exercised.tranquility) {
        const card = handCardButton(page, /Tranquility/i)
        if (await card.isVisible({ timeout: 300 }).catch(() => false)) {
          const handBefore = await hand.count()
          await card.click({ force: true })
          const basic = page.getByRole('button', { name: /^Basic Effect$/i }).first()
          await expect(basic).toBeVisible({ timeout: 3_000 })
          await basic.click({ force: true })
          const overlay = page.locator('.backdrop-blur-sm').filter({ hasText: /Choose Effect/ })
          await expect(overlay).toBeVisible({ timeout: 3_000 })
          // pick the draw option (labelled via actionType.draw_card)
          const drawOption = overlay.locator('button.rounded-xl').filter({ hasText: /Draw/i }).first()
          await expect(drawOption).toBeVisible({ timeout: 2_000 })
          await drawOption.click({ force: true })
          await page.waitForTimeout(400)
          // played 1 card, drew 1 → same hand size
          expect(await hand.count()).toBe(handBefore)
          exercised.tranquility = true
          console.log('[decisions] Tranquility draw verified')
          continue
        }
      }

      // ── Crystallize: take a die, basic → Choose Color → crystal +1 ──
      if (!exercised.crystallize) {
        const card = handCardButton(page, /Crystallize/i)
        if (await card.isVisible({ timeout: 300 }).catch(() => false)) {
          const dieColor = await takeBasicSourceDie(page)
          if (dieColor) {
            const countsBefore: Record<string, number> = {}
            for (const c of ['red', 'blue', 'green', 'white']) countsBefore[c] = await readCrystalCount(page, c)
            await card.click({ force: true })
            const basic = page.getByRole('button', { name: /^Basic Effect$/i }).first()
            await expect(basic).toBeVisible({ timeout: 3_000 })
            await basic.click({ force: true })
            const overlay = page.locator('.backdrop-blur-sm').filter({ hasText: /Choose Color/ })
            await expect(overlay).toBeVisible({ timeout: 3_000 })
            // pick the first offered (payable) color and assert that crystal +1
            const firstOption = overlay.locator('button.rounded-xl').first()
            await expect(firstOption).toBeVisible({ timeout: 2_000 })
            const pickedLabel = ((await firstOption.textContent()) ?? '').trim().toLowerCase()
            await firstOption.click({ force: true })
            await page.waitForTimeout(400)
            const picked = ['red', 'blue', 'green', 'white'].find((c) => pickedLabel.includes(c)) ?? dieColor
            expect(await readCrystalCount(page, picked)).toBe(countsBefore[picked] + 1)
            exercised.crystallize = true
            console.log(`[decisions] Crystallize verified (${picked} crystal ${countsBefore[picked]} → ${countsBefore[picked] + 1})`)
            continue
          }
        }
      }

      // ── Mana Draw basic: extra Source die allowed this turn ──
      if (!exercised.manaDraw) {
        const card = handCardButton(page, /Mana Draw/i)
        if (await card.isVisible({ timeout: 300 }).catch(() => false)) {
          const first = await takeBasicSourceDie(page)
          if (first) {
            await card.click({ force: true })
            const basic = page.getByRole('button', { name: /^Basic Effect$/i }).first()
            await expect(basic).toBeVisible({ timeout: 3_000 })
            await basic.click({ force: true })
            await page.waitForTimeout(300)
            const second = await takeBasicSourceDie(page)
            // a second die could be taken only thanks to Mana Draw
            expect(second).not.toBeNull()
            exercised.manaDraw = true
            console.log(`[decisions] Mana Draw verified (extra die: ${second})`)
            continue
          }
        }
      }

      // otherwise end the turn to cycle cards
      await page.keyboard.press('Escape')
      const endTurn = page.locator('[data-tutorial="end-turn"]')
      if (await endTurn.isVisible({ timeout: 500 }).catch(() => false)) {
        await endTurn.click({ force: true }).catch(() => undefined)
        await page.waitForTimeout(500)
      } else {
        const endRound = page.locator('[data-tutorial="end-round"]')
        if (await endRound.isVisible({ timeout: 300 }).catch(() => false)) {
          await endRound.click({ force: true }).catch(() => undefined)
          await page.waitForTimeout(600)
        } else {
          await page.waitForTimeout(400)
        }
      }
    }

    console.log('[decisions] exercised:', JSON.stringify(exercised))
    expect(exercised.tranquility).toBe(true)
    expect(exercised.crystallize).toBe(true)
    expect(exercised.manaDraw).toBe(true)
    expect(errors).toHaveLength(0)
  })
})
