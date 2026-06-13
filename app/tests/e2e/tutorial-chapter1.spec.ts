import { test, expect, type Page } from '@playwright/test'

/**
 * Walks tutorial Chapter 1 ("First Steps") end-to-end:
 * welcome → play a card → move → fight through all 4 combat phases →
 * end turn → completion screen. Actions are gated by the tutorial step
 * number so the walker follows the guided flow exactly like a player.
 */

async function clickNextIfPossible(page: Page): Promise<boolean> {
  const next = page.getByRole('button', { name: /^(Next|Continue|Start|Got it|Finish|Done|완료|다음)/i }).first()
  if (await next.isVisible({ timeout: 400 }).catch(() => false)) {
    await next.click({ force: true })
    await page.waitForTimeout(350)
    return true
  }
  return false
}

async function handleCombat(page: Page, log: (s: string) => void): Promise<boolean> {
  const combatDialog = page.locator('[role="dialog"][aria-label="Combat"]').first()
  if (!await combatDialog.isVisible({ timeout: 300 }).catch(() => false)) return false

  // melee phase → attack with all cards
  if (await combatDialog.getByText(/Melee Attack Phase/i).isVisible({ timeout: 250 }).catch(() => false)) {
    const target = combatDialog.locator('button.relative.flex.w-20').first()
    if (await target.isVisible({ timeout: 300 }).catch(() => false)) {
      await target.click({ force: true })
      await page.waitForTimeout(150)
    }
    for (let c = 0; c < 8; c++) {
      const trayCard = combatDialog.getByRole('button', { name: /tap to play/i }).first()
      if (!await trayCard.isVisible({ timeout: 250 }).catch(() => false)) break
      await trayCard.click({ force: true })
      await page.waitForTimeout(120)
      const basicAttack = page.locator('button').filter({ hasText: /Basic Effect:.*[Aa]ttack/ }).first()
      const sideways = page.getByRole('button', { name: /Play Sideways/i }).first()
      if (await basicAttack.isVisible({ timeout: 200 }).catch(() => false)) await basicAttack.click({ force: true })
      else if (await sideways.isVisible({ timeout: 200 }).catch(() => false)) await sideways.click({ force: true })
      else { await page.keyboard.press('Escape'); break }
      await page.waitForTimeout(120)
    }
    const confirm = combatDialog.getByRole('button', { name: /Confirm/i }).first()
    if (await confirm.isVisible({ timeout: 300 }).catch(() => false) && await confirm.isEnabled().catch(() => false)) {
      log('melee confirm')
      await confirm.click({ force: true })
      await page.waitForTimeout(400)
      return true
    }
  }
  const assignAll = combatDialog.getByRole('button', { name: /Assign all damage to hero/i }).first()
  if (await assignAll.isVisible({ timeout: 250 }).catch(() => false)) {
    log('assign damage')
    await assignAll.click({ force: true })
    const confirmDamage = combatDialog.getByRole('button', { name: /Confirm Damage/i }).first()
    if (await confirmDamage.isVisible({ timeout: 1000 }).catch(() => false)) await confirmDamage.click({ force: true })
    await page.waitForTimeout(350)
    return true
  }
  const endCombat = combatDialog.getByRole('button', { name: /End Combat/i }).first()
  if (await endCombat.isVisible({ timeout: 250 }).catch(() => false)) {
    log('end combat')
    await endCombat.click({ force: true })
    await page.waitForTimeout(500)
    return true
  }
  const skip = combatDialog.getByRole('button', { name: /Skip Phase/i }).last()
  if (await skip.isVisible({ timeout: 250 }).catch(() => false)) {
    log('skip phase')
    await skip.click({ force: true })
    await page.waitForTimeout(350)
    return true
  }
  await page.waitForTimeout(300)
  return true
}

test.describe('Tutorial Chapter 1', () => {
  test.setTimeout(180_000)

  test('completes the full first-steps tutorial', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        if (!text.includes('favicon') && !text.includes('ads') && !text.includes('net::ERR')) errors.push(text)
      }
    })
    page.on('pageerror', (err) => errors.push(`[CRASH] ${err.message}`))

    await page.goto('/')
    await page.getByRole('button', { name: /Tutorial/i }).first().click()
    await page.waitForTimeout(800)

    // Chapter select (if shown) → chapter 1; otherwise the tutorial auto-starts
    const welcome = page.getByText(/Step 1\/\d+/).first()
    if (!await welcome.isVisible({ timeout: 1500 }).catch(() => false)) {
      const chapter1 = page.locator('button').filter({ hasText: /First Steps|Chapter 1/ }).first()
      if (await chapter1.isVisible({ timeout: 1000 }).catch(() => false)) {
        await chapter1.click({ force: true })
      }
    }
    await page.waitForSelector('canvas', { timeout: 15_000 })
    await page.waitForTimeout(800)

    let completed = false
    const seenSteps = new Set<string>()

    for (let i = 0; i < 80; i++) {
      const stepLabel = await page.getByText(/Step \d+\/\d+/).first().textContent({ timeout: 500 }).catch(() => null)
      if (stepLabel) seenSteps.add(stepLabel)
      const stepNum = stepLabel ? Number(/Step (\d+)\//.exec(stepLabel)?.[1] ?? 0) : 0
      const log = (s: string) => console.log(`  [${i}|step ${stepNum}] ${s}`)

      // Completion?
      if (await page.getByText(/Chapter Complete|🎉/).first().isVisible({ timeout: 300 }).catch(() => false)) {
        completed = true
        await clickNextIfPossible(page)
        break
      }

      // Combat handling has priority whenever the dialog is open
      if (await handleCombat(page, log)) continue

      // Informational step → Next
      if (await clickNextIfPossible(page)) { log('next'); continue }

      // Step 3: play the first card with its basic effect (Move 2)
      if (stepNum === 3) {
        const hand = page.locator('[data-tutorial="card-hand"] button')
        if (await hand.count() > 0) {
          log('play card basic')
          await hand.first().click({ force: true }).catch(() => undefined)
          const playBasic = page.getByRole('button', { name: /Basic Effect/i }).first()
          if (await playBasic.isVisible({ timeout: 800 }).catch(() => false) && await playBasic.isEnabled().catch(() => false)) {
            await playBasic.click({ force: true })
            await page.waitForTimeout(400)
            continue
          }
          await page.keyboard.press('Escape')
        }
      }

      // Step 6: move the hero — confirm a pending move, or select a hex
      if (stepNum === 6) {
        const confirmMove = page.getByRole('button', { name: /Confirm Move/i }).first()
        if (await confirmMove.isVisible({ timeout: 250 }).catch(() => false)) {
          log('confirm move')
          await confirmMove.click({ force: true })
          await page.waitForTimeout(500)
          continue
        }
        const canvas = page.locator('canvas').first()
        const box = await canvas.boundingBox()
        if (box) {
          log('canvas hex click')
          const cx = box.width / 2
          const cy = box.height / 2
          // Flat-top hexes, size 40: axial neighbor pixel offsets
          const offsets = [
            { x: 0, y: -69 },
            { x: 60, y: -35 },
            { x: -60, y: -35 },
            { x: 0, y: 69 },
            { x: 60, y: 35 },
            { x: -60, y: 35 },
          ]
          for (const o of offsets) {
            await canvas.click({ position: { x: cx + o.x, y: cy + o.y }, force: true })
            await page.waitForTimeout(250)
            if (await page.getByRole('button', { name: /Confirm Move/i }).first().isVisible({ timeout: 250 }).catch(() => false)) break
          }
          continue
        }
      }

      // Step 7: fight the spotted enemy
      if (stepNum === 7) {
        const fight = page.getByRole('button', { name: /^⚔️ Fight$|^Fight$/ }).first()
        if (await fight.isVisible({ timeout: 300 }).catch(() => false)) {
          log('fight')
          await fight.click({ force: true })
          await page.waitForTimeout(600)
          continue
        }
      }

      // Step 13: end the turn
      if (stepNum >= 13) {
        const endTurnBtn = page.getByRole('button', { name: /End Turn/i }).first()
        if (await endTurnBtn.isVisible({ timeout: 250 }).catch(() => false)) {
          log('end turn')
          await endTurnBtn.click({ force: true })
          await page.waitForTimeout(500)
          continue
        }
      }

      await page.waitForTimeout(300)
    }

    console.log(`Steps seen: ${[...seenSteps].join(', ')}`)
    console.log(`Completed: ${completed}`)
    console.log(`Console errors: ${errors.length ? errors.join('\n') : 'none'}`)

    expect(completed).toBe(true)
    expect(errors).toEqual([])
  })
})
