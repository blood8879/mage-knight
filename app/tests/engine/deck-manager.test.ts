import { describe, it, expect, beforeEach } from 'vitest'
import { DeckManager } from '@/engine/DeckManager'
import { SeededRandom } from '@/utils/random'
import type { AnyCard, BasicActionCard, DeckState, WoundCard } from '@/engine/types'

function makeCard(id: number, name: string): BasicActionCard {
  return {
    id,
    name,
    type: 'basic_action',
    color: 'red',
    basicEffect: { text: 'test', actions: [] },
    strongEffect: { text: 'test strong', actions: [] },
    copies: 1,
    heroSpecific: null,
    replaces: null,
    set: 'base',
  }
}

function makeWound(id: string): WoundCard {
  return { type: 'wound', id }
}

function makeCards(count: number): BasicActionCard[] {
  return Array.from({ length: count }, (_, i) => makeCard(i, `Card_${i}`))
}

describe('DeckManager', () => {
  let dm: DeckManager
  let random: SeededRandom

  beforeEach(() => {
    random = new SeededRandom(42)
    dm = new DeckManager(random)
  })

  describe('initializeDeck', () => {
    it('creates a deck with shuffled draw pile and empty zones', () => {
      const cards = makeCards(5)
      const deck = dm.initializeDeck(cards)

      expect(deck.drawPile).toHaveLength(5)
      expect(deck.hand).toHaveLength(0)
      expect(deck.playArea).toHaveLength(0)
      expect(deck.discardPile).toHaveLength(0)
    })

    it('shuffles the cards (not identical order to input)', () => {
      const cards = makeCards(16)
      const deck = dm.initializeDeck(cards)

      const inputIds = cards.map((c) => c.id)
      const deckIds = deck.drawPile.map((c) => c.id)
      expect(deckIds).not.toEqual(inputIds)
      expect(deckIds.sort()).toEqual(inputIds.sort())
    })
  })

  describe('drawCards', () => {
    it('draws the specified number of cards from draw pile to hand', () => {
      const deck: DeckState = {
        drawPile: makeCards(5),
        hand: [],
        playArea: [],
        discardPile: [],
      }

      const result = dm.drawCards(deck, 3)

      expect(result.hand).toHaveLength(3)
      expect(result.drawPile).toHaveLength(2)
    })

    it('stops drawing when draw pile is empty (does not error)', () => {
      const deck: DeckState = {
        drawPile: makeCards(2),
        hand: [],
        playArea: [],
        discardPile: [],
      }

      const result = dm.drawCards(deck, 5)

      expect(result.hand).toHaveLength(2)
      expect(result.drawPile).toHaveLength(0)
    })

    it('draws nothing from an already empty draw pile', () => {
      const deck: DeckState = {
        drawPile: [],
        hand: [makeCard(0, 'Existing')],
        playArea: [],
        discardPile: [],
      }

      const result = dm.drawCards(deck, 3)

      expect(result.hand).toHaveLength(1)
      expect(result.drawPile).toHaveLength(0)
    })
  })

  describe('drawToHandLimit', () => {
    it('draws until hand reaches the hand limit', () => {
      const deck: DeckState = {
        drawPile: makeCards(10),
        hand: [makeCard(100, 'Existing')],
        playArea: [],
        discardPile: [],
      }

      const result = dm.drawToHandLimit(deck, 5)

      expect(result.hand).toHaveLength(5)
      expect(result.drawPile).toHaveLength(6)
    })

    it('does not draw if hand already meets limit', () => {
      const deck: DeckState = {
        drawPile: makeCards(5),
        hand: makeCards(5),
        playArea: [],
        discardPile: [],
      }

      const result = dm.drawToHandLimit(deck, 5)

      expect(result.hand).toHaveLength(5)
      expect(result.drawPile).toHaveLength(5)
    })
  })

  describe('playCard', () => {
    it('moves a card from hand to play area', () => {
      const cards = makeCards(3)
      const deck: DeckState = {
        drawPile: [],
        hand: [...cards],
        playArea: [],
        discardPile: [],
      }

      const result = dm.playCard(deck, 1)

      expect(result.hand).toHaveLength(2)
      expect(result.playArea).toHaveLength(1)
      expect(result.playArea[0].id).toBe(cards[1].id)
    })

    it('returns unchanged deck for invalid index', () => {
      const deck: DeckState = {
        drawPile: [],
        hand: makeCards(2),
        playArea: [],
        discardPile: [],
      }

      const result = dm.playCard(deck, 5)

      expect(result.hand).toHaveLength(2)
      expect(result.playArea).toHaveLength(0)
    })
  })

  describe('discardFromHand', () => {
    it('moves a card from hand to discard pile', () => {
      const cards = makeCards(3)
      const deck: DeckState = {
        drawPile: [],
        hand: [...cards],
        playArea: [],
        discardPile: [],
      }

      const result = dm.discardFromHand(deck, 0)

      expect(result.hand).toHaveLength(2)
      expect(result.discardPile).toHaveLength(1)
      expect(result.discardPile[0].id).toBe(cards[0].id)
    })
  })

  describe('discardPlayArea', () => {
    it('moves all play area cards to discard pile', () => {
      const deck: DeckState = {
        drawPile: [],
        hand: [],
        playArea: makeCards(4),
        discardPile: [makeCard(99, 'Already_Discarded')],
      }

      const result = dm.discardPlayArea(deck)

      expect(result.playArea).toHaveLength(0)
      expect(result.discardPile).toHaveLength(5)
    })
  })

  describe('addWound', () => {
    it('adds wound cards to hand with unique ids', () => {
      const deck: DeckState = {
        drawPile: [],
        hand: makeCards(2),
        playArea: [],
        discardPile: [],
      }

      const result = dm.addWound(deck, 3)

      expect(result.hand).toHaveLength(5)
      const wounds = result.hand.filter((c) => c.type === 'wound')
      expect(wounds).toHaveLength(3)

      const woundIds = wounds.map((w) => w.id)
      expect(new Set(woundIds).size).toBe(3)
    })

    it('generates incrementing wound ids across multiple calls', () => {
      const emptyDeck: DeckState = {
        drawPile: [],
        hand: [],
        playArea: [],
        discardPile: [],
      }

      const first = dm.addWound(emptyDeck, 2)
      const second = dm.addWound(emptyDeck, 1)

      const firstWounds = first.hand.filter((c) => c.type === 'wound') as WoundCard[]
      const secondWounds = second.hand.filter((c) => c.type === 'wound') as WoundCard[]

      expect(firstWounds[0].id).toBe('wound_0')
      expect(firstWounds[1].id).toBe('wound_1')
      expect(secondWounds[0].id).toBe('wound_2')
    })
  })

  describe('removeWound', () => {
    it('removes a specific wound from hand by id', () => {
      const wound = makeWound('wound_5')
      const deck: DeckState = {
        drawPile: [],
        hand: [makeCard(0, 'Card_0'), wound, makeCard(1, 'Card_1')],
        playArea: [],
        discardPile: [],
      }

      const result = dm.removeWound(deck, 'wound_5')

      expect(result.hand).toHaveLength(2)
      expect(result.hand.every((c) => c.type !== 'wound')).toBe(true)
    })

    it('returns unchanged deck if wound id not found', () => {
      const deck: DeckState = {
        drawPile: [],
        hand: [makeCard(0, 'Card_0')],
        playArea: [],
        discardPile: [],
      }

      const result = dm.removeWound(deck, 'wound_999')

      expect(result.hand).toHaveLength(1)
    })
  })

  describe('throwAwayCard', () => {
    it('removes a card from hand entirely by card id', () => {
      const cards = makeCards(3)
      const deck: DeckState = {
        drawPile: [],
        hand: [...cards],
        playArea: [],
        discardPile: [],
      }

      const result = dm.throwAwayCard(deck, String(cards[1].id))

      expect(result.hand).toHaveLength(2)
      expect(result.hand.find((c) => c.id === cards[1].id)).toBeUndefined()
      expect(result.discardPile).toHaveLength(0)
    })

    it('removes a wound card from hand entirely', () => {
      const wound = makeWound('wound_0')
      const deck: DeckState = {
        drawPile: [],
        hand: [makeCard(0, 'Card_0'), wound],
        playArea: [],
        discardPile: [],
      }

      const result = dm.throwAwayCard(deck, 'wound_0')

      expect(result.hand).toHaveLength(1)
      expect(result.hand[0].type).toBe('basic_action')
    })
  })

  describe('addCardToTopOfDeck', () => {
    it('places a card on top of the draw pile', () => {
      const existingCards = makeCards(3)
      const newCard = makeCard(99, 'NewAcquisition')
      const deck: DeckState = {
        drawPile: [...existingCards],
        hand: [],
        playArea: [],
        discardPile: [],
      }

      const result = dm.addCardToTopOfDeck(deck, newCard)

      expect(result.drawPile).toHaveLength(4)
      expect(result.drawPile[0].id).toBe(99)
    })
  })

  describe('addCardToDiscardPile', () => {
    it('adds a card to the discard pile', () => {
      const deck: DeckState = {
        drawPile: [],
        hand: [],
        playArea: [],
        discardPile: makeCards(2),
      }
      const card = makeCard(99, 'Discarded')

      const result = dm.addCardToDiscardPile(deck, card)

      expect(result.discardPile).toHaveLength(3)
      expect(result.discardPile[2].id).toBe(99)
    })
  })

  describe('reshuffleDiscard', () => {
    it('shuffles discard pile back into draw pile', () => {
      const deck: DeckState = {
        drawPile: makeCards(2),
        hand: [],
        playArea: [],
        discardPile: makeCards(5).map((c) => ({ ...c, id: c.id + 100 })),
      }

      const result = dm.reshuffleDiscard(deck)

      expect(result.discardPile).toHaveLength(0)
      expect(result.drawPile).toHaveLength(7)
    })

    it('preserves existing draw pile cards at the front', () => {
      const drawCards = [makeCard(1, 'Draw_1'), makeCard(2, 'Draw_2')]
      const deck: DeckState = {
        drawPile: [...drawCards],
        hand: [],
        playArea: [],
        discardPile: makeCards(3).map((c) => ({ ...c, id: c.id + 100 })),
      }

      const result = dm.reshuffleDiscard(deck)

      expect(result.drawPile[0].id).toBe(1)
      expect(result.drawPile[1].id).toBe(2)
    })
  })

  describe('getHandWoundCount', () => {
    it('counts wound cards in hand', () => {
      const deck: DeckState = {
        drawPile: [],
        hand: [
          makeCard(0, 'Card_0'),
          makeWound('wound_0'),
          makeCard(1, 'Card_1'),
          makeWound('wound_1'),
          makeWound('wound_2'),
        ],
        playArea: [],
        discardPile: [],
      }

      expect(dm.getHandWoundCount(deck)).toBe(3)
    })

    it('returns zero when no wounds in hand', () => {
      const deck: DeckState = {
        drawPile: [],
        hand: makeCards(3),
        playArea: [],
        discardPile: [],
      }

      expect(dm.getHandWoundCount(deck)).toBe(0)
    })
  })

  describe('isKnockedOut', () => {
    it('returns true when wound count equals hand limit', () => {
      const deck: DeckState = {
        drawPile: [],
        hand: [makeWound('w0'), makeWound('w1'), makeWound('w2')],
        playArea: [],
        discardPile: [],
      }

      expect(dm.isKnockedOut(deck, 3)).toBe(true)
    })

    it('returns true when wound count exceeds hand limit', () => {
      const deck: DeckState = {
        drawPile: [],
        hand: [makeWound('w0'), makeWound('w1'), makeWound('w2'), makeCard(0, 'Card')],
        playArea: [],
        discardPile: [],
      }

      expect(dm.isKnockedOut(deck, 3)).toBe(true)
    })

    it('returns false when wound count is below hand limit', () => {
      const deck: DeckState = {
        drawPile: [],
        hand: [makeWound('w0'), makeCard(0, 'Card'), makeCard(1, 'Card2')],
        playArea: [],
        discardPile: [],
      }

      expect(dm.isKnockedOut(deck, 3)).toBe(false)
    })
  })

  describe('canDeclareEndOfRound', () => {
    it('returns must=true when deck and hand are both empty', () => {
      const deck: DeckState = {
        drawPile: [],
        hand: [],
        playArea: [],
        discardPile: makeCards(5),
      }

      const result = dm.canDeclareEndOfRound(deck)

      expect(result.must).toBe(true)
      expect(result.may).toBe(false)
    })

    it('returns may=true when deck is empty but hand has cards', () => {
      const deck: DeckState = {
        drawPile: [],
        hand: makeCards(3),
        playArea: [],
        discardPile: [],
      }

      const result = dm.canDeclareEndOfRound(deck)

      expect(result.must).toBe(false)
      expect(result.may).toBe(true)
    })

    it('returns both false when draw pile has cards', () => {
      const deck: DeckState = {
        drawPile: makeCards(5),
        hand: makeCards(3),
        playArea: [],
        discardPile: [],
      }

      const result = dm.canDeclareEndOfRound(deck)

      expect(result.must).toBe(false)
      expect(result.may).toBe(false)
    })
  })

  describe('type guards', () => {
    it('isWound identifies wound cards', () => {
      const wound: AnyCard = makeWound('wound_0')
      const deed: AnyCard = makeCard(0, 'Card_0')

      expect(dm.isWound(wound)).toBe(true)
      expect(dm.isWound(deed)).toBe(false)
    })

    it('isNonWound identifies deed cards', () => {
      const wound: AnyCard = makeWound('wound_0')
      const deed: AnyCard = makeCard(0, 'Card_0')

      expect(dm.isNonWound(deed)).toBe(true)
      expect(dm.isNonWound(wound)).toBe(false)
    })
  })

  describe('countNonWoundCards', () => {
    it('counts non-wound cards in a hand', () => {
      const hand: AnyCard[] = [
        makeCard(0, 'A'),
        makeWound('w0'),
        makeCard(1, 'B'),
        makeWound('w1'),
        makeCard(2, 'C'),
      ]

      expect(dm.countNonWoundCards(hand)).toBe(3)
    })
  })

  describe('immutability', () => {
    it('does not mutate the original deck state on drawCards', () => {
      const deck: DeckState = {
        drawPile: makeCards(5),
        hand: [],
        playArea: [],
        discardPile: [],
      }
      const originalDrawPileLength = deck.drawPile.length
      const originalHandLength = deck.hand.length

      dm.drawCards(deck, 3)

      expect(deck.drawPile).toHaveLength(originalDrawPileLength)
      expect(deck.hand).toHaveLength(originalHandLength)
    })

    it('does not mutate the original deck state on playCard', () => {
      const deck: DeckState = {
        drawPile: [],
        hand: makeCards(3),
        playArea: [],
        discardPile: [],
      }
      const originalHandLength = deck.hand.length

      dm.playCard(deck, 0)

      expect(deck.hand).toHaveLength(originalHandLength)
      expect(deck.playArea).toHaveLength(0)
    })

    it('does not mutate the original deck state on addWound', () => {
      const deck: DeckState = {
        drawPile: [],
        hand: makeCards(2),
        playArea: [],
        discardPile: [],
      }
      const originalHandLength = deck.hand.length

      dm.addWound(deck, 2)

      expect(deck.hand).toHaveLength(originalHandLength)
    })

    it('does not mutate the original deck state on reshuffleDiscard', () => {
      const deck: DeckState = {
        drawPile: [],
        hand: [],
        playArea: [],
        discardPile: makeCards(5),
      }
      const originalDiscardLength = deck.discardPile.length
      const originalDrawPileLength = deck.drawPile.length

      dm.reshuffleDiscard(deck)

      expect(deck.discardPile).toHaveLength(originalDiscardLength)
      expect(deck.drawPile).toHaveLength(originalDrawPileLength)
    })
  })

  describe('shuffle', () => {
    it('shuffles the draw pile deterministically', () => {
      const cards = makeCards(10)
      const deck: DeckState = {
        drawPile: [...cards],
        hand: [],
        playArea: [],
        discardPile: [],
      }

      const r1 = new SeededRandom(99)
      const dm1 = new DeckManager(r1)
      const result1 = dm1.shuffle(deck)

      const r2 = new SeededRandom(99)
      const dm2 = new DeckManager(r2)
      const result2 = dm2.shuffle(deck)

      const ids1 = result1.drawPile.map((c) => c.id)
      const ids2 = result2.drawPile.map((c) => c.id)
      expect(ids1).toEqual(ids2)
    })
  })

  describe('isDeckEmpty', () => {
    it('returns true for empty draw pile', () => {
      const deck: DeckState = {
        drawPile: [],
        hand: makeCards(3),
        playArea: [],
        discardPile: [],
      }

      expect(dm.isDeckEmpty(deck)).toBe(true)
    })

    it('returns false for non-empty draw pile', () => {
      const deck: DeckState = {
        drawPile: makeCards(1),
        hand: [],
        playArea: [],
        discardPile: [],
      }

      expect(dm.isDeckEmpty(deck)).toBe(false)
    })
  })

  describe('edge cases: drawing when deck is empty (reshuffle scenario)', () => {
    it('reshuffles discard into draw pile then draws work', () => {
      const deck: DeckState = {
        drawPile: [],
        hand: [],
        playArea: [],
        discardPile: makeCards(5),
      }

      const reshuffled = dm.reshuffleDiscard(deck)
      expect(reshuffled.drawPile).toHaveLength(5)
      expect(reshuffled.discardPile).toHaveLength(0)

      const drawn = dm.drawCards(reshuffled, 3)
      expect(drawn.hand).toHaveLength(3)
      expect(drawn.drawPile).toHaveLength(2)
    })

    it('reshuffling empty discard into empty draw pile results in empty deck', () => {
      const deck: DeckState = {
        drawPile: [],
        hand: makeCards(3),
        playArea: [],
        discardPile: [],
      }

      const reshuffled = dm.reshuffleDiscard(deck)
      expect(reshuffled.drawPile).toHaveLength(0)
      expect(reshuffled.discardPile).toHaveLength(0)

      const drawn = dm.drawCards(reshuffled, 5)
      expect(drawn.hand).toHaveLength(3)
    })

    it('drawing zero cards returns unchanged hand', () => {
      const deck: DeckState = {
        drawPile: makeCards(5),
        hand: [makeCard(100, 'Existing')],
        playArea: [],
        discardPile: [],
      }

      const result = dm.drawCards(deck, 0)
      expect(result.hand).toHaveLength(1)
      expect(result.drawPile).toHaveLength(5)
    })
  })

  describe('edge cases: hand full of wounds', () => {
    it('hand with all wounds is knocked out at hand limit', () => {
      const deck: DeckState = {
        drawPile: [],
        hand: [makeWound('w0'), makeWound('w1'), makeWound('w2'), makeWound('w3'), makeWound('w4')],
        playArea: [],
        discardPile: [],
      }

      expect(dm.isKnockedOut(deck, 5)).toBe(true)
      expect(dm.getHandWoundCount(deck)).toBe(5)
      expect(dm.countNonWoundCards(deck.hand)).toBe(0)
    })

    it('adding wounds to full wound hand still increases count', () => {
      const deck: DeckState = {
        drawPile: [],
        hand: [makeWound('w0'), makeWound('w1'), makeWound('w2')],
        playArea: [],
        discardPile: [],
      }

      const result = dm.addWound(deck, 2)
      expect(result.hand).toHaveLength(5)
      expect(dm.getHandWoundCount(result)).toBe(5)
      expect(dm.isKnockedOut(result, 5)).toBe(true)
    })

    it('countNonWoundCards returns 0 for all-wound hand', () => {
      const hand: AnyCard[] = [
        makeWound('w0'),
        makeWound('w1'),
        makeWound('w2'),
      ]
      expect(dm.countNonWoundCards(hand)).toBe(0)
    })

    it('canDeclareEndOfRound with wound-only hand and empty deck', () => {
      const deck: DeckState = {
        drawPile: [],
        hand: [makeWound('w0'), makeWound('w1')],
        playArea: [],
        discardPile: [],
      }

      const result = dm.canDeclareEndOfRound(deck)
      expect(result.may).toBe(true)
    })
  })

  describe('edge cases: play area operations', () => {
    it('playing all cards from hand leaves empty hand', () => {
      let deck: DeckState = {
        drawPile: [],
        hand: makeCards(3),
        playArea: [],
        discardPile: [],
      }

      deck = dm.playCard(deck, 0)
      deck = dm.playCard(deck, 0)
      deck = dm.playCard(deck, 0)

      expect(deck.hand).toHaveLength(0)
      expect(deck.playArea).toHaveLength(3)
    })

    it('discarding play area when already empty is safe', () => {
      const deck: DeckState = {
        drawPile: [],
        hand: [],
        playArea: [],
        discardPile: makeCards(2),
      }

      const result = dm.discardPlayArea(deck)
      expect(result.playArea).toHaveLength(0)
      expect(result.discardPile).toHaveLength(2)
    })

    it('playing card with negative index returns unchanged deck', () => {
      const deck: DeckState = {
        drawPile: [],
        hand: makeCards(3),
        playArea: [],
        discardPile: [],
      }

      const result = dm.playCard(deck, -1)
      expect(result.hand).toHaveLength(3)
      expect(result.playArea).toHaveLength(0)
    })
  })

  describe('edge cases: discarding from hand', () => {
    it('discarding last card leaves empty hand', () => {
      const deck: DeckState = {
        drawPile: [],
        hand: [makeCard(0, 'OnlyCard')],
        playArea: [],
        discardPile: [],
      }

      const result = dm.discardFromHand(deck, 0)
      expect(result.hand).toHaveLength(0)
      expect(result.discardPile).toHaveLength(1)
    })
  })

  describe('edge cases: adding cards to deck', () => {
    it('addCardToTopOfDeck to empty draw pile', () => {
      const deck: DeckState = {
        drawPile: [],
        hand: [],
        playArea: [],
        discardPile: [],
      }
      const card = makeCard(42, 'TopCard')

      const result = dm.addCardToTopOfDeck(deck, card)
      expect(result.drawPile).toHaveLength(1)
      expect(result.drawPile[0].id).toBe(42)
    })

    it('addCardToDiscardPile to empty discard', () => {
      const deck: DeckState = {
        drawPile: [],
        hand: [],
        playArea: [],
        discardPile: [],
      }
      const card = makeCard(99, 'Discarded')

      const result = dm.addCardToDiscardPile(deck, card)
      expect(result.discardPile).toHaveLength(1)
      expect(result.discardPile[0].id).toBe(99)
    })
  })
})
