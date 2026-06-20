import { test, expect, type Page, type ConsoleMessage } from '@playwright/test'

/**
 * Learn-by-Playing GUIDE-FOLLOW audit. Unlike the engine audit (which hides the
 * guide), this keeps the guide visible and plays the whole game while following
 * it — exactly how a first-timer hit problems by hand. It verifies:
 *  • the guide is NEVER a hard trap — every shown step offers a forward control
 *    (Next / Skip / Got it / Close), so the player can always proceed;
 *  • the guide actually progresses through its lessons (no infinite stall);
 *  • rulebook invariants hold on __MK_STATE__ throughout;
 *  • the game reaches the score screen with no console errors/crashes.
 */

const FAME_LEVEL_THRESHOLDS = [0, 3, 8, 15, 24, 35, 48, 63, 80, 99]

type Snapshot = {
  phase: string; round: number; totalRounds: number; fame: number; reputation: number
  level: number; unitLimit: number; unitCount: number
  crystals: { red: number; blue: number; green: number; white: number }
  diceCount: number; movePointsAvailable: number; movePointsSpent: number
}

async function readState(page: Page): Promise<Snapshot | null> {
  return await page.evaluate(() => {
    const s = (window as unknown as Record<string, unknown>).__MK_STATE__ as Record<string, unknown> | undefined
    if (!s) return null
    const p = s.player as Record<string, unknown>
    const mana = p.mana as Record<string, unknown>
    const turn = p.turn as Record<string, unknown>
    return {
      phase: s.phase as string, round: s.round as number, totalRounds: s.totalRounds as number,
      fame: p.fame as number, reputation: p.reputation as number, level: p.level as number,
      unitLimit: p.unitLimit as number, unitCount: (p.units as unknown[]).length,
      crystals: mana.crystals as Snapshot['crystals'], diceCount: (mana.dice as unknown[]).length,
      movePointsAvailable: turn.movePointsAvailable as number, movePointsSpent: turn.movePointsSpent as number,
    }
  }).catch(() => null)
}

function checkInvariants(s: Snapshot, expectedDice: number | null): string | null {
  const bad = (n: unknown) => typeof n !== 'number' || Number.isNaN(n)
  if (bad(s.reputation) || s.reputation < -7 || s.reputation > 7) return `reputation out of [-7,7]: ${s.reputation}`
  for (const c of ['red', 'blue', 'green', 'white'] as const) { const v = s.crystals[c]; if (bad(v) || v < 0 || v > 3) return `crystal ${c} out of [0,3]: ${v}` }
  if (expectedDice != null && s.diceCount !== expectedDice) return `Source dice changed: ${s.diceCount} (expected ${expectedDice})`
  if (s.movePointsSpent > s.movePointsAvailable) return `movePointsSpent ${s.movePointsSpent} > available ${s.movePointsAvailable}`
  if (bad(s.unitCount) || s.unitCount > s.unitLimit) return `units ${s.unitCount} exceed limit ${s.unitLimit}`
  if (bad(s.level) || s.level < 1 || s.level > 10) return `level out of [1,10]: ${s.level}`
  if (s.fame < FAME_LEVEL_THRESHOLDS[s.level - 1]) return `fame ${s.fame} below threshold for level ${s.level}`
  if (s.totalRounds !== 3) return `learn scenario should be 3 rounds, got ${s.totalRounds}`
  return null
}

async function visible(page: Page, locator: ReturnType<Page['locator']>, timeout = 200): Promise<boolean> {
  return await locator.isVisible({ timeout }).catch(() => false)
}

test.describe('Learn-by-Playing guide-follow audit', () => {
  test.setTimeout(600_000)

  test('a first-timer can follow the guide to the end with no rule break or trap', async ({ page }) => {
    const errors: string[] = []
    const violations: string[] = []
    page.on('console', (msg: ConsoleMessage) => { if (msg.type() === 'error') { const t = msg.text(); if (!t.includes('favicon') && !t.includes('ads') && !t.includes('net::ERR')) errors.push(t) } })
    page.on('pageerror', (err) => errors.push(`[CRASH] ${err.message}`))

    await page.route('**/sw.js', (r) => r.abort())
    await page.goto('/?debug=1')
    await page.evaluate(() => {
      ;['tipTactic','tipTurn','tipMove','tipCombat','tipDamage','tipLevelUp','tipSite','tipEndTurn'].forEach((k) => localStorage.setItem(`gameTips_seen_${k}`, '1'))
      localStorage.setItem('tutorial_seen', '1'); localStorage.setItem('ad_disabled', '1')
    })
    await page.getByRole('button', { name: /Learn by Playing|게임하며 배우기|Aprender Jugando/i }).click()
    await page.getByRole('button', { name: /Arythea|Tovak|Goldyx|Norowas/ }).first().click({ force: true, timeout: 5000 }).catch(() => undefined)
    await page.waitForSelector('canvas', { timeout: 15_000 })

    let expectedDice: number | null = null
    let reachedScore = false
    let stuckCounter = 0
    let lastSig = ''
    const prev = { fame: 0, level: 1, round: 1 }
    const guideStepsSeen = new Set<string>()
    let guidePresentNoFwd = 0 // consecutive iterations the guide is shown WITHOUT a forward control

    const guidePanel = page.locator('[data-testid="learn-guide"]')
    const guideForward = page.locator('[data-testid="learn-forward"]')

    const audit = async (step: number) => {
      const snap = await readState(page); if (!snap) return
      if (expectedDice == null && snap.diceCount > 0) expectedDice = snap.diceCount
      const rec = (v: string | null) => { if (v) { const m = `step ${step} (phase=${snap.phase}, round=${snap.round}): ${v}`; if (!violations.includes(m)) violations.push(m) } }
      rec(checkInvariants(snap, expectedDice))
      if (snap.fame < prev.fame) rec(`fame decreased ${prev.fame} → ${snap.fame}`)
      if (snap.level < prev.level) rec(`level decreased ${prev.level} → ${snap.level}`)
      prev.fame = Math.max(prev.fame, snap.fame); prev.level = Math.max(prev.level, snap.level)
    }

    for (let step = 0; step < 1500; step++) {
      if (violations.length > 0) break
      if (await visible(page, page.getByText(/Total Score/i))) { reachedScore = true; break }

      const sig = (await page.evaluate(() => document.body.innerText.length).catch(() => -1)) + ''
      stuckCounter = sig === lastSig ? stuckCounter + 1 : 0
      lastSig = sig
      if (stuckCounter > 60) {
        const snap = await readState(page)
        const btns = await page.locator('button:visible').allInnerTexts().catch(() => [])
        console.log(`[guide-follow] STUCK step ${step}. phase=${snap?.phase} round=${snap?.round}; buttons=${JSON.stringify(btns.slice(0, 30))}`)
        throw new Error(`[guide-follow] stuck at step ${step}`)
      }

      // ── Observe the guide, then follow it (click ITS OWN forward control). ──
      // The guide must never be a hard trap: while shown it must always offer a
      // forward control. Record a violation if it sits with none for too long.
      const guideShown = await visible(page, guidePanel, 0)
      if (guideShown) {
        const id = await guidePanel.first().getAttribute('data-learn-step').catch(() => null)
        if (id) guideStepsSeen.add(id)
      }
      const hasFwd = await visible(page, guideForward, 0)
      if (guideShown && !hasFwd) {
        guidePresentNoFwd++
        if (guidePresentNoFwd > 8) violations.push(`guide trap: a guide step was shown with no forward control for ${guidePresentNoFwd} iterations`)
      } else {
        guidePresentNoFwd = 0
      }
      // Every other iteration, advance the guide like a reading player would —
      // clicking the guide's OWN button (not some other Skip/Next on screen).
      if (hasFwd && step % 2 === 0) { await guideForward.first().click({ force: true }).catch(() => undefined); await page.waitForTimeout(120) }

      // ── Play the game (robust autonomous loop). ──
      const roundContinue = page.getByRole('button', { name: /^Continue$|^계속$/i }).first()
      if (await visible(page, roundContinue)) { await roundContinue.click({ force: true }).catch(() => undefined); await page.waitForTimeout(400); await audit(step); continue }

      const tacticOverlay = page.locator('.backdrop-blur-sm').filter({ hasText: /Select Tactic/i })
      if (await visible(page, tacticOverlay)) {
        const cards = tacticOverlay.locator('button.group'); const n = await cards.count(); let picked = false
        for (let c = 0; c < n; c++) { const txt = (await cards.nth(c).innerText().catch(() => '')) || ''; if (/Rethink|Mana Steal|Meditation|Preparation|Sparing/i.test(txt)) continue; await cards.nth(c).click({ force: true }).catch(() => undefined); picked = true; break }
        if (!picked) await cards.last().click({ force: true }).catch(() => undefined)
        const skip = page.getByText('Skip', { exact: true }); if (await visible(page, skip, 500)) await skip.click({ force: true }).catch(() => undefined)
        await page.waitForTimeout(300); await audit(step); continue
      }

      const levelUpDialog = page.locator('div[role="dialog"]').filter({ hasText: /Level Up!/i })
      if (await visible(page, levelUpDialog)) {
        const choices = levelUpDialog.locator('button'); const count = await choices.count()
        for (let i = 0; i < count; i++) { const cls = (await choices.nth(i).getAttribute('class')) ?? ''; if (cls.includes('rounded-xl')) await choices.nth(i).click({ force: true }).catch(() => undefined) }
        const cont = levelUpDialog.getByRole('button', { name: /Continue/i }); if (await visible(page, cont) && await cont.isEnabled().catch(() => false)) await cont.click({ force: true }).catch(() => undefined)
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
        await selectionOverlay.locator('button').first().click({ force: true }).catch(() => undefined)
        const confirm = selectionOverlay.getByRole('button', { name: /Play|Discard|Confirm/i }).last(); if (await visible(page, confirm) && await confirm.isEnabled().catch(() => false)) await confirm.click({ force: true }).catch(() => undefined)
        const effectChoice = page.locator('.backdrop-blur-sm').filter({ hasText: /Choose Effect/i }).locator('button.rounded-xl').first(); if (await visible(page, effectChoice, 700)) await effectChoice.click({ force: true }).catch(() => undefined)
        await page.waitForTimeout(250); await audit(step); continue
      }

      const interactionDialog = page.getByRole('dialog', { name: /Interaction/i })
      if (await visible(page, interactionDialog)) {
        const sideways = interactionDialog.getByRole('button', { name: /Sideways \+1/i }); let guard = 0
        while (await sideways.count() > 0 && guard < 60) { await sideways.first().click({ force: true }).catch(() => undefined); await page.waitForTimeout(100); guard++ }
        const recruit = interactionDialog.getByRole('button', { name: /Recruit Unit/i }); const rc = await recruit.count()
        for (let i = 0; i < rc; i++) { if (await recruit.nth(i).isEnabled().catch(() => false)) { await recruit.nth(i).click({ force: true }).catch(() => undefined); break } }
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

      const interact = page.getByRole('button', { name: /^Interact$|^상호작용$/i })
      if (await visible(page, interact)) { await interact.click({ force: true }).catch(() => undefined); await page.waitForTimeout(400); await audit(step); continue }

      const basicButton = page.getByRole('button', { name: /^Basic Effect$/i }).first()
      if (await visible(page, basicButton)) {
        if (await basicButton.isEnabled().catch(() => false) && step % 3 !== 2) await basicButton.click({ force: true }).catch(() => undefined)
        else { const side = page.getByRole('button', { name: /\+1 move/i }); if (await visible(page, side)) await side.click({ force: true }).catch(() => undefined); else await page.keyboard.press('Escape') }
        await page.waitForTimeout(250); await audit(step); continue
      }

      const confirmMove = page.getByRole('button', { name: /Confirm Move/i })
      if (await visible(page, confirmMove)) { await confirmMove.click({ force: true }).catch(() => undefined); await page.waitForTimeout(300); await audit(step); continue }

      const opportunity = page.locator('[data-tutorial="opportunities"] button').first()
      if (await visible(page, opportunity) && step % 2 === 0) { await opportunity.click({ force: true }).catch(() => undefined); await page.waitForTimeout(300); await audit(step); continue }

      const hand = page.locator('[data-tutorial="card-hand"] button')
      if (await hand.count() > 0 && step % 4 !== 3) { await hand.first().click({ force: true }).catch(() => undefined); await page.waitForTimeout(200); await audit(step); continue }

      const endTurn = page.locator('[data-tutorial="end-turn"]')
      if (await visible(page, endTurn)) { await endTurn.click({ force: true }).catch(() => undefined); await page.waitForTimeout(400); await audit(step); continue }
      const endRound = page.locator('[data-tutorial="end-round"]')
      if (await visible(page, endRound)) { await endRound.click({ force: true }).catch(() => undefined); await page.waitForTimeout(600); await audit(step); continue }

      await page.waitForTimeout(300)
    }

    console.log(`[guide-follow] reachedScore=${reachedScore}, guideStepsSeen=${guideStepsSeen.size}, violations=${violations.length}, errors=${errors.length}`)
    console.log(`[guide-follow] steps: ${JSON.stringify([...guideStepsSeen])}`)
    if (violations.length) console.log('VIOLATIONS:\n' + violations.join('\n'))
    if (errors.length) console.log('ERRORS:\n' + errors.join('\n'))

    expect(violations, 'rule violations / guide traps').toEqual([])
    expect(errors.filter((e) => e.includes('[CRASH]')), 'crashes').toEqual([])
    expect(errors, 'console errors').toEqual([])
    expect(reachedScore, 'reached the score screen').toBe(true)
    expect(guideStepsSeen.size, 'guide progressed through its lessons (did not stall)').toBeGreaterThanOrEqual(8)
  })
})
