import { test, expect, type Page, type ConsoleMessage } from '@playwright/test'

/**
 * Regression: the combat card-tray action picker pops up ABOVE the tapped card
 * (`absolute bottom-full`). It must not be clipped by the tray body — every row
 * (starting with "View Card Details") has to be fully on-screen and clickable.
 */

async function enterCombat(page: Page): Promise<boolean> {
  await page.evaluate(() => {
    localStorage.setItem('tutorial_seen', '1')
    localStorage.setItem('ad_disabled', '1')
    const tipKeys = ['tipTactic','tipTurn','tipMove','tipCombat','tipDamage','tipLevelUp','tipSite','tipEndTurn']
    tipKeys.forEach(k => localStorage.setItem(`gameTips_seen_${k}`, '1'))
  })
  await page.getByRole('button', { name: /New Game/i }).click()
  await page.waitForSelector('canvas', { timeout: 15_000 })
  await page.waitForTimeout(1200)

  // tactic
  const tacticOverlay = page.locator('.backdrop-blur-sm').filter({ hasText: /Select Tactic/i })
  if (await tacticOverlay.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await tacticOverlay.locator('button.group').last().click({ force: true }).catch(() => undefined)
    await page.waitForTimeout(500)
  }

  const fightBtn = page.getByRole('button', { name: /^(Fight|⚔️ Fight)$/i }).or(page.getByRole('button', { name: /Fight/i }))
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await fightBtn.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
      await fightBtn.first().click({ force: true }).catch(() => undefined)
      await page.waitForTimeout(1200)
      if (await page.locator('[aria-label="Combat"]').isVisible({ timeout: 2_000 }).catch(() => false)) return true
    }
  }
  return false
}

test.describe('Combat card picker visibility', () => {
  test.setTimeout(120_000)

  test('action picker is fully visible (not clipped by the tray)', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        const txt = msg.text()
        if (!txt.includes('favicon') && !txt.includes('ads') && !txt.includes('net::ERR')) errors.push(txt)
      }
    })
    page.on('pageerror', (err) => errors.push(`[CRASH] ${err.message}`))

    await page.goto('/?seed=3')
    const inCombat = await enterCombat(page)
    expect(inCombat, 'should reach a combat encounter').toBe(true)

    const combat = page.locator('[aria-label="Combat"]')

    // ensure the tray is expanded
    const trayToggle = combat.getByRole('button', { name: /Card Tray/i })
    await expect(trayToggle).toBeVisible({ timeout: 5_000 })

    // tap the first playable hand card (its tap-area shows "tap to play")
    const cardTapArea = combat.locator('button', { hasText: /tap to play/i }).first()
    await expect(cardTapArea).toBeVisible({ timeout: 5_000 })
    await cardTapArea.click({ force: true })

    // the picker's first row must appear and be fully on-screen
    const detailRow = combat.getByRole('button', { name: /View Card Details/i })
    await expect(detailRow).toBeVisible({ timeout: 3_000 })

    // Rulebook p.7: sideways play is NOT allowed in the Ranged/Siege phase
    // (combat opens in the ranged_siege phase), so the picker must not offer it.
    const sidewaysRow = combat.getByRole('button', { name: /Play Sideways/i })
    await expect(sidewaysRow).toHaveCount(0)

    // CSS overflow clipping does NOT change an element's geometric box, so
    // boundingBox() can't see it, and whether the popover actually overflows the
    // tray body depends on hand size / popover height (seed-dependent). The
    // decisive invariant is structural: the popover pops UP (bottom-full), so no
    // ancestor BETWEEN the popover and the sticky tray panel may clip on the Y
    // axis. The original bug left the tray body at overflow:hidden.
    const offenders = await detailRow.evaluate((rowEl) => {
      const popover = rowEl.closest('.bottom-full') as HTMLElement | null
      if (!popover) return ['POPOVER_NOT_FOUND']
      const bad: string[] = []
      let cur = popover.parentElement
      while (cur && cur !== document.body) {
        const isTrayPanel = (cur.className || '').toString().includes('sticky')
        if (!isTrayPanel) {
          const oy = getComputedStyle(cur).overflowY
          if (oy === 'hidden' || oy === 'auto' || oy === 'scroll') {
            bad.push(`${(cur.className || cur.tagName).toString().slice(0, 40)}:${oy}`)
          }
        }
        if (isTrayPanel) break
        cur = cur.parentElement
      }
      return bad
    })
    expect(offenders, `no Y-clipping ancestor may sit between popover and tray panel: ${JSON.stringify(offenders)}`).toEqual([])

    // the detail row is genuinely clickable WITHOUT force (would throw if covered/clipped)
    await detailRow.click()
    await expect(page.getByText(/Basic Effect|Strong Effect/i).first()).toBeVisible({ timeout: 3_000 })

    expect(errors.filter((e) => e.includes('[CRASH]'))).toHaveLength(0)
  })
})
