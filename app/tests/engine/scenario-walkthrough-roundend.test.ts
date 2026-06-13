import { describe, it, expect, beforeEach } from 'vitest'
import { TurnManager } from '@/engine/TurnManager'
import { DeckManager } from '@/engine/DeckManager'
import { ManaPool } from '@/engine/ManaPool'
import { UnitManager } from '@/engine/UnitManager'
import { SeededRandom } from '@/utils/random'
import type { AnyCard, UnitInstance, RegularUnit } from '@/engine/types'

function makeUnit(): RegularUnit {
  return {
    id: 1, name: 'Peasants', type: 'infantry', tier: 'regular', level: 1,
    cost: 3, armor: 1, recruitSites: ['village'], abilities: [],
    resistance: null, copies: 1, set: 'base',
  }
}

describe('Walkthrough: Round End (Phase 11)', () => {
  let tm: TurnManager
  let dm: DeckManager
  let pool: ManaPool
  let unitMgr: UnitManager
  let random: SeededRandom

  beforeEach(() => {
    random = new SeededRandom(42)
    tm = new TurnManager(random)
    dm = new DeckManager(random)
    pool = new ManaPool(random)
    unitMgr = new UnitManager()
  })

  describe('round transition', () => {
    it('processEndOfRound returns next round info correctly', () => {
      const result = tm.processEndOfRound({ currentRound: 1, totalRounds: 3, roundPattern: ['day', 'night', 'day'] })
      expect(result.nextRound).toBe(2)
      expect(result.nextDayNight).toBe('night')
      expect(result.isGameOver).toBe(false)
    })

    it('game ends after final round', () => {
      const result = tm.processEndOfRound({ currentRound: 3, totalRounds: 3, roundPattern: ['day', 'night', 'day'] })
      expect(result.isGameOver).toBe(true)
    })
  })

  describe('round-end cleanup', () => {
    it('discard pile reshuffles into draw pile', () => {
      const cards: AnyCard[] = [{ type: 'wound', id: 'w1' }, { type: 'wound', id: 'w2' }]
      let deck = dm.initializeDeck(cards)
      deck = dm.drawCards(deck, 2)
      deck = dm.discardFromHandForced(deck, 0)
      expect(deck.discardPile).toHaveLength(1)
      deck = dm.reshuffleDiscard(deck)
      expect(deck.discardPile).toHaveLength(0)
      expect(deck.drawPile.length).toBeGreaterThan(0)
    })

    it('mana source is re-rolled at round start', () => {
      let state = pool.initializeSource(4)
      const oldColors = state.dice.map(d => d.color)
      state = pool.rerollSource(state)
      expect(state.dice).toHaveLength(4)
      expect(state.dice.every(d => d.isInSource)).toBe(true)
      // Colors may differ (re-rolled) — just verify structure
    })

    it('spent units become ready at end of round', () => {
      const units: UnitInstance[] = [
        { unit: makeUnit(), status: 'spent', woundCount: 0 },
        { unit: makeUnit(), status: 'ready', woundCount: 0 },
      ]
      const result = unitMgr.readyAllUnits(units)
      expect(result[0].status).toBe('ready')
      expect(result[1].status).toBe('ready')
    })

    it('wounded units become ready but keep woundCount after readyAllUnits', () => {
      const units: UnitInstance[] = [
        { unit: makeUnit(), status: 'wounded', woundCount: 1 },
      ]
      const result = unitMgr.readyAllUnits(units)
      expect(result[0].status).toBe('ready')
      expect(result[0].woundCount).toBe(1)
    })

    it('phase advances from end_of_round to round_start when game continues', () => {
      expect(tm.advancePhase('end_of_round', { gameEnding: false })).toBe('round_start')
    })
  })
})
