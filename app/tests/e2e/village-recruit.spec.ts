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
  await expect(village).toBeVisible({ timeout: 15_000 })
  const confirm = page.getByRole('button', { name: /Confirm Move/i })
  for (let attempt = 0; attempt < 5; attempt++) {
    await village.click({ force: true }).catch(() => undefined)
    if (await confirm.isVisible({ timeout: 2_000 }).catch(() => false)) break
  }
  await expect(confirm).toBeVisible({ timeout: 15_000 })
  await confirm.click({ force: true })
}

test.describe('Village Recruit (interaction hand section)', () => {
  test.setTimeout(240_000)

  test('plays influence cards inside the interaction panel and recruits a unit', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(`[CRASH] ${err.message}`))

    await page.goto('/')
    await suppressTips(page)
    await page.getByRole('button', { name: /New Game/i }).click()
    await page.getByRole("button", { name: /Arythea|아리시아/ }).first().click({ force: true, timeout: 5000 }).catch(() => undefined)
    await page.waitForSelector('canvas', { timeout: 15_000 })
    await selectTacticIfVisible(page)

    await expect(page.locator('[data-tutorial="card-hand"] button').first()).toBeVisible({ timeout: 10_000 })
    const villageOpp = page.locator('[data-tutorial="opportunities"] button').filter({ hasText: /Village/i }).first()
    for (let attempt = 0; attempt < 8; attempt++) {
      if (await villageOpp.isVisible({ timeout: 1_000 }).catch(() => false)) break
      await playSideways(page, 'move')
    }
    await moveToVillageOpportunity(page)

    const interact = page.getByRole('button', { name: /^Interact$/i })
    await expect(interact).toBeVisible({ timeout: 10_000 })

    const interactionDialog = page.getByRole('dialog', { name: /Interaction/i })
    for (let attempt = 0; attempt < 5; attempt++) {
      await interact.click({ force: true }).catch(() => undefined)
      if (await interactionDialog.isVisible({ timeout: 2_000 }).catch(() => false)) break
    }
    await expect(interactionDialog).toBeVisible({ timeout: 15_000 })

    // New hand section must be present inside the dialog
    await expect(interactionDialog.getByText(/Play cards from hand/i)).toBeVisible({ timeout: 5_000 })

    // Play every hand card sideways for +1 influence each
    const sidewaysButtons = interactionDialog.getByRole('button', { name: /Sideways \+1/i })
    const initialCount = await sidewaysButtons.count()
    expect(initialCount).toBeGreaterThan(0)
    for (let i = 0; i < initialCount; i++) {
      await sidewaysButtons.first().click({ force: true })
      await page.waitForTimeout(150)
    }

    // Influence pool badge should now show the played amount (>= initialCount, reputation 0)
    const poolBadge = interactionDialog.locator('span.font-mono').first()
    const poolText = await poolBadge.textContent()
    expect(Number(poolText?.trim())).toBeGreaterThanOrEqual(initialCount)

    // If a village unit is in the offer and affordable, recruit it
    const recruitButtons = interactionDialog.getByRole('button', { name: /Recruit Unit/i })
    const recruitCount = await recruitButtons.count()
    let recruited = false
    for (let i = 0; i < recruitCount; i++) {
      const btn = recruitButtons.nth(i)
      if (await btn.isEnabled()) {
        await btn.click({ force: true })
        recruited = true
        break
      }
    }
    if (recruited) {
      // Purchase history shows the recruited unit
      await expect(interactionDialog.getByText(/Purchase/i).first()).toBeVisible({ timeout: 5_000 })
    }
    console.log(`[verify] influence pool=${poolText}, recruit buttons=${recruitCount}, recruited=${recruited}`)

    await interactionDialog.getByRole('button', { name: /^Done$/i }).click({ force: true })
    expect(errors).toHaveLength(0)
  })
})
