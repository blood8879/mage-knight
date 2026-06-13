import { test, expect, type Page } from '@playwright/test'

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
  if (!await overlay.isVisible({ timeout: 500 }).catch(() => false)) return false
  await overlay.locator('button.group').last().click({ force: true })
  const skip = page.getByText('Skip', { exact: true })
  if (await skip.isVisible({ timeout: 800 }).catch(() => false)) await skip.click({ force: true })
  await page.waitForTimeout(300)
  return true
}

async function playSideways(page: Page, mode: 'move' | 'influence') {
  const hand = page.locator('[data-tutorial="card-hand"] button')
  if (await hand.count() === 0) return false
  await hand.first().click({ force: true, timeout: 2_000 }).catch(() => undefined)
  const label = mode === 'move' ? /\+1 move/i : /\+1 influence/i
  const button = page.getByRole('button', { name: label })
  if (!await button.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await page.keyboard.press('Escape')
    return false
  }
  try {
    await button.click({ force: true, timeout: 1_000 })
  } catch {
    await page.keyboard.press('Escape')
    return false
  }
  await page.waitForTimeout(120)
  return true
}

async function moveToVillageOpportunity(page: Page) {
  const village = page.locator('[data-tutorial="opportunities"] button').filter({ hasText: /Village/i }).first()
  // generous timeout + click retries — parallel workers slow the dev server
  // and animations can swallow individual clicks
  await expect(village).toBeVisible({ timeout: 15_000 })
  const confirm = page.getByRole('button', { name: /Confirm Move/i })
  for (let attempt = 0; attempt < 5; attempt++) {
    await village.click({ force: true }).catch(() => undefined)
    if (await confirm.isVisible({ timeout: 2_000 }).catch(() => false)) break
  }
  await expect(confirm).toBeVisible({ timeout: 15_000 })
  await confirm.click({ force: true })
}

async function continueToScore(page: Page) {
  for (let i = 0; i < 120; i++) {
    if (await page.getByText(/Total Score/i).isVisible({ timeout: 200 }).catch(() => false)) return true

    const gameOver = page.getByText(/Game Over/i)
    if (await gameOver.isVisible({ timeout: 200 }).catch(() => false)) {
      await page.waitForTimeout(1500)
      continue
    }

    const roundContinue = page.locator('.backdrop-blur-sm').filter({ hasText: /Round Complete/i }).getByRole('button', { name: /Continue/i })
    if (await roundContinue.isVisible({ timeout: 200 }).catch(() => false)) {
      await roundContinue.click({ force: true })
      await page.waitForTimeout(500)
      continue
    }

    if (await selectTacticIfVisible(page)) continue

    const hand = page.locator('[data-tutorial="card-hand"] button')
    if (await hand.count() > 0) {
      await playSideways(page, 'move')
      await playSideways(page, 'move')
    }

    const endTurn = page.locator('[data-tutorial="end-turn"]')
    if (await endTurn.isVisible({ timeout: 300 }).catch(() => false)) {
      await endTurn.click({ force: true })
      await page.waitForTimeout(500)
      continue
    }

    const endRound = page.locator('[data-tutorial="end-round"]')
    if (await endRound.isVisible({ timeout: 300 }).catch(() => false)) {
      await endRound.click({ force: true })
      await page.waitForTimeout(800)
      continue
    }

    await page.waitForTimeout(300)
  }
  return false
}

test.describe('Comprehensive Playthrough', () => {
  test.setTimeout(240_000)

  test('performs a real interaction reward and then reaches score screen', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        if (!text.includes('favicon') && !text.includes('ads') && !text.includes('net::ERR')) errors.push(text)
      }
    })
    page.on('pageerror', (err) => errors.push(`[CRASH] ${err.message}`))

    await page.goto('/')
    await suppressTips(page)
    await page.getByRole('button', { name: /New Game/i }).click()
    await page.waitForSelector('canvas', { timeout: 15_000 })
    await selectTacticIfVisible(page)

    await expect(page.locator('[data-tutorial="card-hand"] button').first()).toBeVisible({ timeout: 10_000 })
    // Generate move points until the village shows as reachable — retried
    // because card-modal timing is unreliable under parallel-worker load
    const villageOpp = page.locator('[data-tutorial="opportunities"] button').filter({ hasText: /Village/i }).first()
    for (let attempt = 0; attempt < 8; attempt++) {
      if (await villageOpp.isVisible({ timeout: 1_000 }).catch(() => false)) break
      await playSideways(page, 'move')
    }
    await moveToVillageOpportunity(page)

    const interact = page.getByRole('button', { name: /^Interact$/i })
    await expect(interact).toBeVisible({ timeout: 10_000 })
    await playSideways(page, 'influence')
    await playSideways(page, 'influence')
    await page.keyboard.press('Escape')

    // Retry the click — overlays/banners can swallow it under load
    const interactionDialog = page.getByRole('dialog', { name: /Interaction/i })
    for (let attempt = 0; attempt < 5; attempt++) {
      await interact.click({ force: true }).catch(() => undefined)
      if (await interactionDialog.isVisible({ timeout: 2_000 }).catch(() => false)) break
    }
    await expect(interactionDialog).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /Plunder Village/i }).click({ force: true })
    await page.getByRole('button', { name: /^Done$/i }).click({ force: true })

    const reachedScore = await continueToScore(page)
    expect(reachedScore).toBeTruthy()
    expect(errors.filter(e => e.includes('[CRASH]'))).toHaveLength(0)
    expect(errors).toHaveLength(0)
  })
})
