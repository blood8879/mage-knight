import { describe, it, expect, beforeEach } from 'vitest'
import { ReputationManager } from '@/engine/ReputationManager'
import { CombatResolver } from '@/engine/CombatResolver'
import { SeededRandom } from '@/utils/random'
import type { EnemyToken, CombatState } from '@/engine/types'

function makeEnemy(overrides: Partial<EnemyToken> = {}): EnemyToken {
  return {
    id: 1,
    name: 'Test Enemy',
    color: 'green',
    category: 'marauding',
    armor: 4,
    attack: 3,
    attackType: 'normal',
    abilities: [],
    fameReward: 3,
    copies: 1,
    set: 'base',
    ...overrides,
  }
}

describe('Walkthrough: Special Locations (Phase 9)', () => {
  const repMgr = new ReputationManager()
  let resolver: CombatResolver

  beforeEach(() => {
    const random = new SeededRandom(42)
    resolver = new CombatResolver(random)
  })

  describe('village', () => {
    it('village allows recruitment of village-tier units', () => {
      const sites = repMgr.canRecruitAtSite('village', false)
      expect(sites).toContain('village')
    })
  })

  describe('keep', () => {
    it('keep enemies are fortified', () => {
      const combat = resolver.initiateCombat([makeEnemy()], true)
      expect(combat.isFortifiedSite).toBe(true)
      expect(combat.enemies[0].isFortified).toBe(true)
    })

    it('conquered keep allows keep-tier recruitment', () => {
      const sites = repMgr.canRecruitAtSite('keep', true)
      expect(sites).toContain('keep')
    })

    it('unconquered keep does not allow recruitment', () => {
      const sites = repMgr.canRecruitAtSite('keep', false)
      expect(sites).toBeNull()
    })
  })

  describe('mage tower', () => {
    it('mage tower enemies are fortified', () => {
      const combat = resolver.initiateCombat([makeEnemy()], true)
      expect(combat.isFortifiedSite).toBe(true)
    })

    it('conquered mage tower allows mage tower recruitment', () => {
      const sites = repMgr.canRecruitAtSite('mageTower', true)
      expect(sites).toContain('mage_tower')
    })

    it('unconquered mage tower does not allow recruitment', () => {
      expect(repMgr.canRecruitAtSite('mageTower', false)).toBeNull()
    })
  })

  describe('monastery', () => {
    it('monastery allows monastery-tier recruitment', () => {
      const sites = repMgr.canRecruitAtSite('monastery', false)
      expect(sites).toContain('monastery')
    })

    it('monastery healing costs 2 influence per wound', () => {
      const result = repMgr.canBuyHealing(4, 'monastery')
      expect(result.costPerHealing).toBe(2)
      expect(result.maxHealing).toBe(2)
    })
  })

  describe('city', () => {
    it('city enemies are fortified', () => {
      const combat = resolver.initiateCombat([makeEnemy()], true)
      expect(combat.isFortifiedSite).toBe(true)
    })

    it('white city gives enemies +1 armor', () => {
      const enemy = makeEnemy({ armor: 4 })
      const combat = resolver.initiateCombat([enemy], false, 'white')
      expect(combat.enemies[0].currentArmor).toBe(5)
    })

    it('red city gives physical attackers brutal ability', () => {
      const enemy = makeEnemy({ attackType: 'normal' })
      const combat = resolver.initiateCombat([enemy], false, 'red')
      expect(combat.enemies[0].appliedAbilities).toContain('brutal')
    })

    it('conquered city allows city-tier recruitment', () => {
      const sites = repMgr.canRecruitAtSite('city', true)
      expect(sites).toContain('city')
    })

    it('unconquered city does not allow recruitment', () => {
      expect(repMgr.canRecruitAtSite('city', false)).toBeNull()
    })
  })
})
