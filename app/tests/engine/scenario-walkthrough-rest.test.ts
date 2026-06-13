import { describe, it, expect, beforeEach } from 'vitest'
import { TurnManager } from '@/engine/TurnManager'
import { DeckManager } from '@/engine/DeckManager'
import { SeededRandom } from '@/utils/random'
import type { AnyCard } from '@/engine/types'
import type { PhaseContext } from '@/engine/TurnManager'

describe('Walkthrough: Rest & Heal (Phase 8)', () => {
  let tm: TurnManager
  let dm: DeckManager

  beforeEach(() => {
    const random = new SeededRandom(42)
    tm = new TurnManager(random)
    dm = new DeckManager(random)
  })

  describe('rest type determination', () => {
    it('standard rest available when player has non-wound cards in hand', () => {
      expect(tm.canRest(true, false)).toBe('standard')
    })

    it('slow recovery when hand has only wound cards', () => {
      expect(tm.canRest(false, true)).toBe('slow_recovery')
    })

    it('no rest possible when hand is empty (no non-wound, no wounds)', () => {
      expect(tm.canRest(false, false)).toBeNull()
    })
  })

  describe('resting turn flow', () => {
    it('resting turn skips movement and action phases', () => {
      const ctx: PhaseContext = { isResting: true }
      expect(tm.advancePhase('player_turn_start', ctx)).toBe('end_of_turn')
    })

    it('standard rest: discard non-wound card to heal wounds', () => {
      // Simulate: hand has 3 wound cards
      // After discarding 1 wound, wound should be removable
      const mockCards: AnyCard[] = [
        { type: 'wound', id: 'w1' },
        { type: 'wound', id: 'w2' },
        { type: 'wound', id: 'w3' },
      ]
      let deck = dm.initializeDeck(mockCards)
      deck = dm.drawCards(deck, 3)
      // Can force-discard wounds from hand (for Resting)
      deck = dm.discardFromHandForced(deck, 0)
      expect(deck.hand).toHaveLength(2)
      expect(deck.discardPile).toHaveLength(1)
      // Can remove a wound from hand
      const woundInHand = deck.hand.find(c => c.type === 'wound')
      if (woundInHand) {
        deck = dm.removeWound(deck, woundInHand.id)
        expect(deck.hand).toHaveLength(1)
      }
    })
  })
})
