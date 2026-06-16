import { describe, it, expect, beforeEach } from 'vitest'
import { ScenarioSetup } from '@/engine/ScenarioSetup'
import type { ScenarioConfig } from '@/engine/ScenarioSetup'
import { SeededRandom } from '@/utils/random'
import type { AnyCard } from '@/engine/types'

describe('Walkthrough: Game Setup (Phase 0)', () => {
  let random: SeededRandom
  let setup: ScenarioSetup
  let config: ScenarioConfig

  beforeEach(() => {
    random = new SeededRandom(42)
    setup = new ScenarioSetup(random)
    config = setup.setupFirstReconnaissance()
  })

  describe('scenario configuration', () => {
    it('Solo Conquest has 6 rounds', () => {
      expect(config.totalRounds).toBe(6)
    })

    it('round pattern is 3 days and 3 nights', () => {
      expect(config.roundPattern).toEqual(['day', 'night', 'day', 'night', 'day', 'night'])
    })

    it('uses dummy player', () => {
      expect(config.useDummyPlayer).toBe(true)
    })

    it('has 2 player count', () => {
      expect(config.playerCount).toBe(2)
    })

    it('uses 4 mana dice', () => {
      expect(config.diceCount).toBe(4)
    })

    it('does not use elite units', () => {
      expect(config.useEliteUnits).toBe(false)
    })

    it('removes competitive spells (ids 17-20)', () => {
      expect(config.removedSpellIds).toContain(17)
      expect(config.removedSpellIds).toContain(18)
      expect(config.removedSpellIds).toContain(19)
      expect(config.removedSpellIds).toContain(20)
    })

    it('has correct special rules (Solo Conquest)', () => {
      expect(config.specialRules).toContain('no_pvp')
      // Solo Conquest does not use the First Reconnaissance training rules
      expect(config.specialRules).not.toContain('tile_fame')
      expect(config.specialRules).not.toContain('no_city_conquest')
    })
  })

  describe('player initial state', () => {
    const mockDeck: AnyCard[] = [
      { type: 'wound', id: 'w1' },
      { type: 'wound', id: 'w2' },
    ]

    it('player starts at level 1 with 0 fame', () => {
      const state = setup.getInitialPlayerState('Arythea', mockDeck, { q: 0, r: 0 })
      expect(state.level).toBe(1)
      expect(state.fame).toBe(0)
    })

    it('initial hand limit is 5, unit limit is 1, armor is 2', () => {
      const state = setup.getInitialPlayerState('Arythea', mockDeck, { q: 0, r: 0 })
      expect(state.handLimit).toBe(5)
      expect(state.unitLimit).toBe(1)
      expect(state.armor).toBe(2)
    })

    it('initial reputation is 0', () => {
      const state = setup.getInitialPlayerState('Arythea', mockDeck, { q: 0, r: 0 })
      expect(state.reputation).toBe(0)
    })
  })
})
