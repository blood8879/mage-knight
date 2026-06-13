import { test, expect, type Page } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Generates Google Play Store listing assets into store-listing/screenshots/.
 * Skipped in the normal suite — run with:
 *   STORE_SHOTS=1 npx playwright test store-screenshots
 */

const OUT = path.resolve(__dirname, '../../../store-listing/screenshots')
const shot = (name: string) => path.join(OUT, name)

test.describe('Store listing assets', () => {
  test.skip(!process.env.STORE_SHOTS, 'Set STORE_SHOTS=1 to generate store assets')
  test.use({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 })
  test.setTimeout(180_000)

  test('captures store screenshots', async ({ page }) => {
    await page.goto('/?seed=10')
    await page.evaluate(() => {
      const tipKeys = ['tipTactic','tipTurn','tipMove','tipCombat','tipDamage','tipLevelUp','tipSite','tipEndTurn']
      tipKeys.forEach(k => localStorage.setItem(`gameTips_seen_${k}`, '1'))
      localStorage.setItem('tutorial_seen', '1')
      localStorage.setItem('ad_disabled', '1')
    })
    await page.reload()

    // 1. Main menu
    await expect(
      page.getByRole('heading', { level: 1, name: 'Mage Knight Board Game' }),
    ).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(1000)
    await page.screenshot({ path: shot('01-main-menu.png') })

    // 2. Settings (language selection)
    await page.getByRole('button', { name: 'Settings' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible({ timeout: 5_000 })
    await page.waitForTimeout(500)
    await page.screenshot({ path: shot('06-settings.png') })
    await page.getByRole('button', { name: 'Back' }).click()

    // 3. Start a game → tactic selection overlay
    await page.getByRole('button', { name: /New Game/i }).click()
    await page.waitForSelector('canvas', { timeout: 15_000 })
    const overlay = page.locator('.backdrop-blur-sm').filter({ hasText: /Select Tactic/i })
    if (await overlay.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await page.waitForTimeout(500)
      await page.screenshot({ path: shot('05-tactic-selection.png') })
      await overlay.locator('button.group').first().click({ force: true })
      await page.waitForTimeout(500)
    }

    // 4. Game board with hand
    await expect(page.locator('[data-tutorial="card-hand"] button').first()).toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(1000)
    await page.screenshot({ path: shot('02-game-board.png') })

    // 5. Combat (seed=10: enemy adjacent from turn 1)
    const fight = page.getByRole('button', { name: /Fight/i }).first()
    await fightWhenVisible(page, fight)
    const combat = page.locator('[role="dialog"][aria-label="Combat"]').first()
    await expect(combat).toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(800)
    await page.screenshot({ path: shot('03-combat.png') })

    // 6. Card detail — play a card from the combat tray picker
    const trayCard = combat.getByRole('button', { name: /tap to play/i }).first()
    if (await trayCard.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await trayCard.click({ force: true })
      await page.waitForTimeout(500)
      await page.screenshot({ path: shot('04-card-play.png') })
    }
  })

  test('generates feature graphic 1024x500', async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 1024, height: 500 },
      deviceScaleFactor: 1,
    })
    const page = await ctx.newPage()
    await page.setContent(featureGraphicHtml())
    await page.waitForTimeout(300)
    await page.screenshot({ path: shot('feature-graphic-1024x500.png') })
    await ctx.close()
  })
})

async function fightWhenVisible(page: Page, fight: ReturnType<Page['locator']>) {
  for (let i = 0; i < 5; i++) {
    if (await fight.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await fight.click({ force: true })
      return
    }
    await page.waitForTimeout(500)
  }
}

function featureGraphicHtml(): string {
  const hexes = Array.from({ length: 60 }, (_, i) => {
    const col = i % 12
    const row = Math.floor(i / 12)
    const x = col * 100 + (row % 2) * 50 - 30
    const y = row * 88 - 20
    const hues = ['#1e3a5f', '#2d4a3e', '#4a3829', '#3d2f4f', '#26424f']
    return `<polygon points="50,0 100,29 100,87 50,116 0,87 0,29" transform="translate(${x},${y}) scale(0.6)" fill="${hues[i % 5]}" stroke="#0b1220" stroke-width="3" opacity="0.55"/>`
  }).join('')
  return `<!DOCTYPE html><html><head><style>
    * { margin: 0; padding: 0; }
    body { width: 1024px; height: 500px; overflow: hidden; background: #0b1220;
           font-family: Georgia, 'Times New Roman', serif; position: relative; }
    svg.bg { position: absolute; inset: 0; }
    .vignette { position: absolute; inset: 0;
                background: radial-gradient(ellipse at 30% 50%, transparent 30%, rgba(5,8,18,0.92) 100%); }
    .content { position: absolute; inset: 0; display: flex; flex-direction: column;
               justify-content: center; padding-left: 70px; }
    h1 { color: #f3e7c9; font-size: 64px; letter-spacing: 2px;
         text-shadow: 0 4px 18px rgba(0,0,0,0.9), 0 0 40px rgba(212,175,55,0.25); }
    h1 .knight { color: #d4af37; }
    p { color: #b8c4d8; font-size: 26px; margin-top: 14px; font-style: italic; }
    .badge { margin-top: 22px; display: flex; gap: 12px; }
    .badge span { background: rgba(212,175,55,0.14); border: 1px solid rgba(212,175,55,0.45);
                  color: #e7d9a8; font-size: 17px; padding: 6px 16px; border-radius: 20px;
                  font-family: -apple-system, sans-serif; font-style: normal; }
    .orb { position: absolute; right: 130px; top: 50%; transform: translateY(-50%);
           width: 230px; height: 230px; border-radius: 50%;
           background: radial-gradient(circle at 35% 30%, #7ab8ff 0%, #2b5ca8 35%, #14264d 75%, #0a1430 100%);
           box-shadow: 0 0 80px rgba(80,140,255,0.5), inset 0 0 60px rgba(0,0,0,0.6);
           display: flex; align-items: center; justify-content: center; }
    .orb span { font-size: 110px; filter: drop-shadow(0 6px 12px rgba(0,0,0,0.8)); }
  </style></head><body>
    <svg class="bg" width="1024" height="500">${hexes}</svg>
    <div class="vignette"></div>
    <div class="orb"><span>⚔️</span></div>
    <div class="content">
      <h1>Mage <span class="knight">Knight</span></h1>
      <p>Explore. Conquer. Become a legend — solo.</p>
      <div class="badge"><span>Offline</span><span>Solo Board Game</span><span>EN · 한국어 · ES</span></div>
    </div>
  </body></html>`
}
