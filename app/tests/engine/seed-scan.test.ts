import { describe, it } from 'vitest'
import { SeededRandom } from '@/utils/random'
import { ScenarioSetup } from '@/engine/ScenarioSetup'
import { MapGenerator } from '@/engine/MapGenerator'
import { getEnemies, getSites, getBasicActions } from '@/data/loader'

// Dev utility: scan seeds for an easy first enemy near the start position.
// Not a real test — used to pick deterministic seeds for E2E specs.
describe.skip('seed scan (dev utility)', () => {
  it('finds seeds with a weak adjacent enemy', () => {
    const sites = getSites()
    for (let seed = 1; seed <= 60; seed++) {
      const random = new SeededRandom(seed)
      const setup = new ScenarioSetup(random)
      const config = setup.setupFirstReconnaissance()
      const basicActions = getBasicActions()
      setup.setupPlayerDeck('Arythea', basicActions.commonCards.concat(basicActions.heroSpecificCards))
      const pools = setup.setupEnemyPools(getEnemies())
      const mapGen = new MapGenerator(random)
      const map = mapGen.generateMap(config.mapConfig)

      const interesting: string[] = []
      for (const [key, hex] of map.hexGrid.entries()) {
        if (!hex.isRevealed || !hex.site || !hex.siteData) continue
        const info = sites.find((s) => s.type === hex.site)
        if (!info?.enemyColor || ['null', 'special', 'multiple'].includes(info.enemyColor)) continue
        const color = info.enemyColor as keyof typeof pools
        const pool = pools[color] as Array<{ name: string; armor: number; attack: number; abilities: string[] }>
        if (!Array.isArray(pool) || pool.length === 0) continue
        const enemy = pool[0]
        const [q, r] = key.split(',').map(Number)
        const dist = (Math.abs(q) + Math.abs(q + r) + Math.abs(r)) / 2
        interesting.push(
          `${hex.site}@(${q},${r}) d=${dist} → ${enemy.name} arm=${enemy.armor} atk=${enemy.attack} [${enemy.abilities.join('/')}]`,
        )
      }
      if (interesting.length) console.log(`seed=${seed}\n  ${interesting.join('\n  ')}`)
    }
  })
})
