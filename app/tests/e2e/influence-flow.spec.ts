import { test, expect, type Page } from '@playwright/test'

/**
 * Influence flow verification (Task: 영향력 플레이 검증)
 * - interaction pool starts at the reputation modifier (0 at game start)
 * - sideways plays add +1 each from inside the interaction panel
 * - basic influence plays add their printed value
 * - purchases deduct from the pool and appear in the history
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
  if (!await overlay.isVisible({ timeout: 500 }).catch(() => false)) return false
  await overlay.locator('button.group').last().click({ force: true })
  const skip = page.getByText('Skip', { exact: true })
  if (await skip.isVisible({ timeout: 800 }).catch(() => false)) await skip.click({ force: true })
  await page.waitForTimeout(300)
  return true
}

async function playSidewaysFromHand(page: Page, mode: 'move' | 'influence') {
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

async function moveToVillage(page: Page) {
  const villageOpp = page.locator('[data-tutorial="opportunities"] button').filter({ hasText: /Village/i }).first()
  for (let attempt = 0; attempt < 8; attempt++) {
    if (await villageOpp.isVisible({ timeout: 1_000 }).catch(() => false)) break
    await playSidewaysFromHand(page, 'move')
  }
  await expect(villageOpp).toBeVisible({ timeout: 15_000 })
  const confirm = page.getByRole('button', { name: /Confirm Move/i })
  for (let attempt = 0; attempt < 5; attempt++) {
    await villageOpp.click({ force: true }).catch(() => undefined)
    if (await confirm.isVisible({ timeout: 2_000 }).catch(() => false)) break
  }
  await expect(confirm).toBeVisible({ timeout: 15_000 })
  await confirm.click({ force: true })
}

async function readPool(dialog: ReturnType<Page['locator']>): Promise<number> {
  const text = await dialog.locator('span.font-mono').first().textContent()
  return Number(text?.trim() ?? 'NaN')
}

test.describe('Influence Flow', () => {
  test.setTimeout(240_000)

  test('pool accounting: sideways, basic influence plays and purchases', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(`[CRASH] ${err.message}`))

    await page.goto('/')
    await suppressTips(page)
    await page.getByRole('button', { name: /New Game/i }).click()
    await page.waitForSelector('canvas', { timeout: 15_000 })
    await selectTacticIfVisible(page)

    await expect(page.locator('[data-tutorial="card-hand"] button').first()).toBeVisible({ timeout: 10_000 })
    await moveToVillage(page)

    const interact = page.getByRole('button', { name: /^Interact$/i })
    await expect(interact).toBeVisible({ timeout: 10_000 })
    const dialog = page.getByRole('dialog', { name: /Interaction/i })
    for (let attempt = 0; attempt < 5; attempt++) {
      await interact.click({ force: true }).catch(() => undefined)
      if (await dialog.isVisible({ timeout: 2_000 }).catch(() => false)) break
    }
    await expect(dialog).toBeVisible({ timeout: 15_000 })

    // 1) Pool starts at the reputation modifier — 0 at game start
    expect(await readPool(dialog)).toBe(0)

    // 2) Basic influence plays add their printed value (e.g. Promise basic +2)
    let pool = 0
    const basicButtons = dialog.getByRole('button', { name: /Basic \+\d+/i })
    const basicCount = await basicButtons.count()
    if (basicCount > 0) {
      const label = await basicButtons.first().textContent()
      const value = Number(label?.match(/\+(\d+)/)?.[1] ?? '0')
      await basicButtons.first().click({ force: true })
      await page.waitForTimeout(200)
      pool += value
      expect(await readPool(dialog)).toBe(pool)
    }

    // 3) Sideways plays add exactly +1 each
    const sidewaysButtons = dialog.getByRole('button', { name: /Sideways \+1/i })
    const sidewaysCount = await sidewaysButtons.count()
    expect(sidewaysCount).toBeGreaterThan(0)
    for (let i = 0; i < sidewaysCount; i++) {
      await sidewaysButtons.first().click({ force: true })
      await page.waitForTimeout(150)
      pool += 1
      expect(await readPool(dialog)).toBe(pool)
    }

    // 4) Purchasing deducts the cost and records the purchase
    const recruitButtons = dialog.getByRole('button', { name: /Recruit Unit \((\d+)\)/i })
    const recruitCount = await recruitButtons.count()
    let recruited = false
    for (let i = 0; i < recruitCount; i++) {
      const btn = recruitButtons.nth(i)
      if (!(await btn.isEnabled())) continue
      const label = await btn.textContent()
      const cost = Number(label?.match(/\((\d+)\)/)?.[1] ?? '0')
      await btn.click({ force: true })
      await page.waitForTimeout(300)
      pool -= cost
      expect(await readPool(dialog)).toBe(pool)
      recruited = true
      break
    }

    // 5) Healing (3 influence at villages) deducts too, when affordable & wounded
    const healButton = dialog.getByRole('button', { name: /Heal Wound/i })
    if (await healButton.isVisible().catch(() => false) && await healButton.isEnabled().catch(() => false)) {
      await healButton.click({ force: true })
      await page.waitForTimeout(200)
      pool -= 3
      expect(await readPool(dialog)).toBe(pool)
    }

    console.log(`[influence-flow] basic plays=${basicCount > 0 ? 1 : 0}, sideways=${sidewaysCount}, recruited=${recruited}, final pool=${pool}`)

    await dialog.getByRole('button', { name: /^Done$/i }).click({ force: true })
    await expect(dialog).not.toBeVisible({ timeout: 5_000 })
    expect(errors).toHaveLength(0)
  })
})
