import { describe, it, expect, beforeEach } from 'vitest'
import { TurnManager } from '@/engine/TurnManager'
import { DeckManager } from '@/engine/DeckManager'
import { ManaPool } from '@/engine/ManaPool'
import { SeededRandom } from '@/utils/random'
import { INITIAL_TURN_STATE } from '@/engine/GameState'
import type { TurnState, AnyCard } from '@/engine/types'

describe('Walkthrough: Turn End (Phase 7)', () => {
  let tm: TurnManager
  let dm: DeckManager
  let pool: ManaPool
  let random: SeededRandom

  beforeEach(() => {
    random = new SeededRandom(42)
    tm = new TurnManager(random)
    dm = new DeckManager(random)
    pool = new ManaPool(random)
  })

  describe('end of turn cleanup', () => {
    it('played cards move to discard pile', () => {
      const mockCards: AnyCard[] = [
        { type: 'wound', id: 'w1' },
        { type: 'wound', id: 'w2' },
        { type: 'wound', id: 'w3' },
      ]
      let deck = dm.initializeDeck(mockCards)
      deck = dm.drawCards(deck, 3)
      deck = dm.playCard(deck, 0)
      expect(deck.playArea).toHaveLength(1)
      deck = dm.discardPlayArea(deck)
      expect(deck.playArea).toHaveLength(0)
      expect(deck.discardPile).toHaveLength(1)
    })

    it('mana tokens are cleared at end of turn', () => {
      let state = pool.initializeSource(4)
      const dieId = state.dice[0].id
      state = pool.takeDieFromSource(state, dieId)
      expect(state.playerMana.length).toBeGreaterThan(0)
      state = pool.resetTurnState(state)
      expect(state.playerMana).toHaveLength(0)
    })

    it('source die taken flag resets', () => {
      let state = pool.initializeSource(4)
      const dieId = state.dice[0].id
      state = pool.takeDieFromSource(state, dieId)
      expect(state.sourceDieTakenThisTurn).toBe(true)
      state = pool.resetTurnState(state)
      expect(state.sourceDieTakenThisTurn).toBe(false)
    })
  })

  describe('end of round declaration', () => {
    it('must declare end of round when deck AND hand are empty', () => {
      const result = tm.canDeclareEndOfRound(true, true)
      expect(result.must).toBe(true)
      expect(result.may).toBe(false)
    })

    it('may declare end of round when deck is empty but hand has cards', () => {
      const result = tm.canDeclareEndOfRound(true, false)
      expect(result.must).toBe(false)
      expect(result.may).toBe(true)
    })

    it('cannot declare end of round when deck is not empty', () => {
      const result = tm.canDeclareEndOfRound(false, false)
      expect(result.must).toBe(false)
      expect(result.may).toBe(false)
    })

    it('DeckManager.canDeclareEndOfRound matches TurnManager logic', () => {
      const emptyDeck = { drawPile: [] as AnyCard[], hand: [] as AnyCard[], playArea: [] as AnyCard[], discardPile: [] as AnyCard[] }
      const result = dm.canDeclareEndOfRound(emptyDeck)
      expect(result.must).toBe(true)
      expect(result.may).toBe(false)
    })
  })
})
