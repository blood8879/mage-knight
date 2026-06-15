import { test, expect, type Page, type ConsoleMessage } from '@playwright/test'

/**
 * Rule-audit playthrough.
 *
 * Drives the game autonomously like a curious user for a full game, and after
 * every action snapshots window.__MK_STATE__ (exposed under ?debug) to assert
 * invariants grounded in the Mage Knight rulebook. A run is a clean completion
 * only when it reaches the score screen with ZERO console errors, ZERO crashes
 * and ZERO rule violations.
 *
 * Seed comes from env MK_SEED (default 42) so a shell loop can sweep seeds and
 * stop on the first violation.
 */

const SEED = Number(process.env.MK_SEED ?? '42')
const FAME_LEVEL_THRESHOLDS = [0, 3, 8, 15, 24, 35, 48, 63, 80, 99]

type Snapshot = {
  phase: string
  round: number
  fame: number
  reputation: number
  level: number
  handLimit: number
  unitLimit: number
  unitCount: number
  crystals: { red: number; blue: number; green: number; white: number }
  diceCount: number
  movePointsAvailable: number
  movePointsSpent: number
  handSize: number
}

async function readState(page: Page): Promise<Snapshot | null> {
  return await page.evaluate(() => {
    const s = (window as unknown as Record<string, unknown>).__MK_STATE__ as
      | Record<string, unknown>
      | undefined
    if (!s) return null
    const p = s.player as Record<string, unknown>
    const mana = p.mana as Record<string, unknown>
    const turn = p.turn as Record<string, unknown>
    const deck = p.deck as Record<string, unknown>
    return {
      phase: s.phase as string,
      round: s.round as number,
      fame: p.fame as number,
      reputation: p.reputation as number,
      level: p.level as number,
      handLimit: p.handLimit as number,
      unitLimit: p.unitLimit as number,
      unitCount: (p.units as unknown[]).length,
      crystals: mana.crystals as Snapshot['crystals'],
      diceCount: (mana.dice as unknown[]).length,
      movePointsAvailable: turn.movePointsAvailable as number,
      movePointsSpent: turn.movePointsSpent as number,
      handSize: (deck.hand as unknown[]).length,
    }
  })
}

/** Returns a rule-violation string, or null if the snapshot is legal. */
function checkInvariants(s: Snapshot, expectedDice: number | null): string | null {
  const bad = (n: unknown) => typeof n !== 'number' || Number.isNaN(n)

  if (bad(s.reputation) || s.reputation < -7 || s.reputation > 7)
    return `reputation out of [-7,7]: ${s.reputation}`

  for (const c of ['red', 'blue', 'green', 'white'] as const) {
    const v = s.crystals[c]
    if (bad(v) || v < 0 || v > 3) return `crystal ${c} out of [0,3]: ${v}`
  }

  if (expectedDice != null && s.diceCount !== expectedDice)
    return `Source dice count changed: ${s.diceCount} (expected ${expectedDice})`

  if (bad(s.movePointsAvailable) || s.movePointsAvailable < 0)
    return `movePointsAvailable negative/NaN: ${s.movePointsAvailable}`
  if (bad(s.movePointsSpent) || s.movePointsSpent < 0)
    return `movePointsSpent negative/NaN: ${s.movePointsSpent}`
  if (s.movePointsSpent > s.movePointsAvailable)
    return `movePointsSpent ${s.movePointsSpent} > available ${s.movePointsAvailable}`

  if (bad(s.unitCount) || s.unitCount > s.unitLimit)
    return `units ${s.unitCount} exceed limit ${s.unitLimit}`

  if (bad(s.level) || s.level < 1 || s.level > 10) return `level out of [1,10]: ${s.level}`
  if (bad(s.fame) || s.fame < 0) return `fame negative/NaN: ${s.fame}`
  if (s.fame < FAME_LEVEL_THRESHOLDS[s.level - 1])
    return `fame ${s.fame} below threshold for level ${s.level} (${FAME_LEVEL_THRESHOLDS[s.level - 1]})`

  return null
}

async function visible(page: Page, locator: ReturnType<Page['locator']>, timeout = 250): Promise<boolean> {
  return await locator.isVisible({ timeout }).catch(() => false)
}

test.describe('Rule-audit playthrough', () => {
  test.setTimeout(600_000)

  test(`completes a full game without rule violations (seed ${SEED})`, async ({ page }) => {
    const errors: string[] = []
    const violations: string[] = []
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        const txt = msg.text()
        if (!txt.includes('favicon') && !txt.includes('ads') && !txt.includes('net::ERR')) errors.push(txt)
      }
    })
    page.on('pageerror', (err) => errors.push(`[CRASH] ${err.message}`))

    await page.goto(`/?seed=${SEED}&debug=1`)
    await page.evaluate(() => {
      ;['tipTactic','tipTurn','tipMove','tipCombat','tipDamage','tipLevelUp','tipSite','tipEndTurn'].forEach((k) =>
        localStorage.setItem(`gameTips_seen_${k}`, '1'))
      localStorage.setItem('tutorial_seen', '1')
      localStorage.setItem('ad_disabled', '1')
    })
    await page.getByRole('button', { name: /New Game/i }).click()
    await page.getByRole('button', { name: /Arythea|아리시아/ }).first().click({ force: true, timeout: 5000 }).catch(() => undefined)
    await page.waitForSelector('canvas', { timeout: 15_000 })

    let expectedDice: number | null = null
    let reachedScore = false
    let turnsEnded = 0
    let stuckCounter = 0
    let lastSig = ''

    const audit = async (step: number) => {
      const snap = await readState(page)
      if (!snap) return
      if (expectedDice == null && snap.diceCount > 0) expectedDice = snap.diceCount
      const v = checkInvariants(snap, expectedDice)
      if (v) {
        const msg = `[seed ${SEED}] step ${step} (phase=${snap.phase}, round=${snap.round}): ${v}`
        if (!violations.includes(msg)) violations.push(msg)
      }
    }

    for (let step = 0; step < 600; step++) {
      if (violations.length > 0) break
      if (await visible(page, page.getByText(/Total Score/i))) { reachedScore = true; break }

      const sig = (await page.evaluate(() => document.body.innerText.length)) + ''
      stuckCounter = sig === lastSig ? stuckCounter + 1 : 0
      lastSig = sig
      if (stuckCounter > 50) throw new Error(`[seed ${SEED}] stuck at step ${step}`)

      const roundContinue = page.locator('.backdrop-blur-sm').filter({ hasText: /Round Complete/i }).getByRole('button', { name: /Continue/i })
      if (await visible(page, roundContinue)) { await roundContinue.click({ force: true }).catch(() => undefined); await page.waitForTimeout(400); await audit(step); continue }

      const tacticOverlay = page.locator('.backdrop-blur-sm').filter({ hasText: /Select Tactic/i })
      if (await visible(page, tacticOverlay)) {
        await tacticOverlay.locator('button.group').last().click({ force: true }).catch(() => undefined)
        const skip = page.getByText('Skip', { exact: true })
        if (await visible(page, skip, 600)) await skip.click({ force: true }).catch(() => undefined)
        await page.waitForTimeout(300); await audit(step); continue
      }

      const levelUpDialog = page.locator('div[role="dialog"]').filter({ hasText: /Level Up!/i })
      if (await visible(page, levelUpDialog)) {
        const choices = levelUpDialog.locator('button')
        const count = await choices.count()
        for (let i = 0; i < count; i++) {
          const cls = (await choices.nth(i).getAttribute('class')) ?? ''
          if (cls.includes('rounded-xl')) await choices.nth(i).click({ force: true }).catch(() => undefined)
        }
        const cont = levelUpDialog.getByRole('button', { name: /Continue/i })
        if (await visible(page, cont) && await cont.isEnabled().catch(() => false)) await cont.click({ force: true }).catch(() => undefined)
        await page.waitForTimeout(300); await audit(step); continue
      }

      const rewardClaim = page.getByRole('button', { name: /Claim|Take Reward|Collect/i }).first()
      if (await visible(page, rewardClaim)) { await rewardClaim.click({ force: true }).catch(() => undefined); await page.waitForTimeout(300); await audit(step); continue }

      const decisionOverlay = page.locator('.backdrop-blur-sm').filter({ hasText: /Choose Effect|Choose Color/ })
      if (await visible(page, decisionOverlay)) {
        const option = decisionOverlay.locator('button.rounded-xl').first()
        if (await visible(page, option)) await option.click({ force: true }).catch(() => undefined)
        else await decisionOverlay.getByRole('button', { name: /Cancel/i }).click({ force: true }).catch(() => undefined)
        await page.waitForTimeout(250); await audit(step); continue
      }

      const selectionOverlay = page.locator('.backdrop-blur-sm').filter({ hasText: /Choose a card to play with it|Improvisation/i })
      if (await visible(page, selectionOverlay)) {
        const firstCard = selectionOverlay.locator('button').first()
        await firstCard.click({ force: true }).catch(() => undefined)
        const confirm = selectionOverlay.getByRole('button', { name: /Play|Discard|Confirm/i }).last()
        if (await visible(page, confirm) && await confirm.isEnabled().catch(() => false)) await confirm.click({ force: true }).catch(() => undefined)
        const effectChoice = page.locator('.backdrop-blur-sm').filter({ hasText: /Choose Effect/i }).locator('button.rounded-xl').first()
        if (await visible(page, effectChoice, 800)) await effectChoice.click({ force: true }).catch(() => undefined)
        await page.waitForTimeout(250); await audit(step); continue
      }

      const interactionDialog = page.getByRole('dialog', { name: /Interaction/i })
      if (await visible(page, interactionDialog)) {
        const sideways = interactionDialog.getByRole('button', { name: /Sideways \+1/i })
        let guard = 0
        while (await sideways.count() > 0 && guard < 60) { await sideways.first().click({ force: true }).catch(() => undefined); await page.waitForTimeout(100); guard++ }
        const recruit = interactionDialog.getByRole('button', { name: /Recruit Unit/i })
        const rc = await recruit.count()
        for (let i = 0; i < rc; i++) {
          if (await recruit.nth(i).isEnabled().catch(() => false)) { await recruit.nth(i).click({ force: true }).catch(() => undefined); break }
        }
        await interactionDialog.getByRole('button', { name: /^Done$/i }).click({ force: true }).catch(() => undefined)
        await page.waitForTimeout(300); await audit(step); continue
      }

      const combatRegion = page.locator('[aria-label="Combat"]')
      if (await visible(page, combatRegion)) {
        const next = page.getByRole('button', { name: /Confirm|Continue|End Combat|Next|Assign|Skip/i }).first()
        if (await visible(page, next) && await next.isEnabled().catch(() => false)) await next.click({ force: true }).catch(() => undefined)
        else { const plus = page.getByRole('button', { name: '+' }).first(); if (await visible(page, plus)) await plus.click({ force: true }).catch(() => undefined) }
        await page.waitForTimeout(300); await audit(step); continue
      }

      const interact = page.getByRole('button', { name: /^Interact$/i })
      if (await visible(page, interact)) { await interact.click({ force: true }).catch(() => undefined); await page.waitForTimeout(400); await audit(step); continue }

      const basicButton = page.getByRole('button', { name: /^Basic Effect$/i }).first()
      if (await visible(page, basicButton)) {
        if (await basicButton.isEnabled().catch(() => false) && step % 3 !== 2) await basicButton.click({ force: true }).catch(() => undefined)
        else {
          const side = page.getByRole('button', { name: /\+1 move/i })
          if (await visible(page, side)) await side.click({ force: true }).catch(() => undefined)
          else await page.keyboard.press('Escape')
        }
        await page.waitForTimeout(250); await audit(step); continue
      }

      const confirmMove = page.getByRole('button', { name: /Confirm Move/i })
      if (await visible(page, confirmMove)) { await confirmMove.click({ force: true }).catch(() => undefined); await page.waitForTimeout(300); await audit(step); continue }

      const opportunity = page.locator('[data-tutorial="opportunities"] button').first()
      if (await visible(page, opportunity) && step % 2 === 0) { await opportunity.click({ force: true }).catch(() => undefined); await page.waitForTimeout(300); await audit(step); continue }

      const hand = page.locator('[data-tutorial="card-hand"] button')
      if (await hand.count() > 0 && step % 4 !== 3) { await hand.first().click({ force: true }).catch(() => undefined); await page.waitForTimeout(200); await audit(step); continue }

      const endTurn = page.locator('[data-tutorial="end-turn"]')
      if (await visible(page, endTurn)) { await endTurn.click({ force: true }).catch(() => undefined); turnsEnded++; await page.waitForTimeout(400); await audit(step); continue }
      const endRound = page.locator('[data-tutorial="end-round"]')
      if (await visible(page, endRound)) { await endRound.click({ force: true }).catch(() => undefined); await page.waitForTimeout(600); await audit(step); continue }

      await page.waitForTimeout(300)
    }

    console.log(`[rule-audit seed=${SEED}] turnsEnded=${turnsEnded}, reachedScore=${reachedScore}, violations=${violations.length}, errors=${errors.length}`)
    if (violations.length) console.log('VIOLATIONS:\n' + violations.join('\n'))
    if (errors.length) console.log('ERRORS:\n' + errors.join('\n'))

    expect(violations, 'rule violations').toEqual([])
    expect(errors.filter((e) => e.includes('[CRASH]')), 'crashes').toEqual([])
    expect(errors, 'console errors').toEqual([])
    expect(reachedScore, 'reached the score screen').toBe(true)
  })
})
