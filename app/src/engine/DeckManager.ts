import type { AnyCard, DeedCard, DeckState, WoundCard } from './types'
import type { SeededRandom } from '@/utils/random'

export class DeckManager {
  private random: SeededRandom
  private woundCounter = 0

  constructor(random: SeededRandom) {
    this.random = random
  }

  /** Restore the wound id counter after loading a save so new wound ids stay unique */
  setWoundCounter(value: number): void {
    this.woundCounter = Math.max(this.woundCounter, value)
  }

  initializeDeck(cards: AnyCard[]): DeckState {
    return {
      drawPile: this.random.shuffle(cards),
      hand: [],
      playArea: [],
      discardPile: [],
    }
  }

  shuffle(deck: DeckState): DeckState {
    return {
      ...deck,
      drawPile: this.random.shuffle(deck.drawPile),
    }
  }

  drawCards(deck: DeckState, count: number): DeckState {
    const available = Math.min(count, deck.drawPile.length)
    return {
      ...deck,
      hand: [...deck.hand, ...deck.drawPile.slice(0, available)],
      drawPile: deck.drawPile.slice(available),
    }
  }

  drawToHandLimit(deck: DeckState, handLimit: number): DeckState {
    const needed = Math.max(0, handLimit - deck.hand.length)
    return this.drawCards(deck, needed)
  }

  playCard(deck: DeckState, cardIndex: number): DeckState {
    if (cardIndex < 0 || cardIndex >= deck.hand.length) return { ...deck }
    const card = deck.hand[cardIndex]
    return {
      ...deck,
      hand: deck.hand.filter((_, i) => i !== cardIndex),
      playArea: [...deck.playArea, card],
    }
  }

  /**
   * Discard a card from hand to discard pile.
   * EC-02-D-2: Wound cards CANNOT be voluntarily discarded.
   * Use discardFromHandForced() for Resting or explicit game effects.
   */
  discardFromHand(deck: DeckState, cardIndex: number): DeckState {
    if (cardIndex < 0 || cardIndex >= deck.hand.length) return { ...deck }
    const card = deck.hand[cardIndex]
    // EC-02-D-2: Wound cards cannot be voluntarily discarded
    if (card.type === 'wound') return { ...deck }
    return {
      ...deck,
      hand: deck.hand.filter((_, i) => i !== cardIndex),
      discardPile: [...deck.discardPile, card],
    }
  }

  /**
   * Force-discard a card (including Wounds) — used by Resting and game effects.
   * Standard Rest: discard wounds + 1 non-wound
   * Slow Recovery: discard 1 wound
   */
  discardFromHandForced(deck: DeckState, cardIndex: number): DeckState {
    if (cardIndex < 0 || cardIndex >= deck.hand.length) return { ...deck }
    const card = deck.hand[cardIndex]
    return {
      ...deck,
      hand: deck.hand.filter((_, i) => i !== cardIndex),
      discardPile: [...deck.discardPile, card],
    }
  }

  discardPlayArea(deck: DeckState): DeckState {
    return {
      ...deck,
      playArea: [],
      discardPile: [...deck.discardPile, ...deck.playArea],
    }
  }

  addWound(deck: DeckState, count: number): DeckState {
    const wounds: WoundCard[] = []
    for (let i = 0; i < count; i++) {
      wounds.push({ type: 'wound', id: `wound_${this.woundCounter++}` })
    }
    return {
      ...deck,
      hand: [...deck.hand, ...wounds],
    }
  }

  removeWound(deck: DeckState, woundId: string): DeckState {
    const index = deck.hand.findIndex(
      (card) => card.type === 'wound' && card.id === woundId,
    )
    if (index === -1) return { ...deck }
    return {
      ...deck,
      hand: deck.hand.filter((_, i) => i !== index),
    }
  }

  addCardToTopOfDeck(deck: DeckState, card: AnyCard): DeckState {
    return {
      ...deck,
      drawPile: [card, ...deck.drawPile],
    }
  }

  addCardToDiscardPile(deck: DeckState, card: AnyCard): DeckState {
    return {
      ...deck,
      discardPile: [...deck.discardPile, card],
    }
  }

  throwAwayCard(deck: DeckState, cardId: string): DeckState {
    const index = deck.hand.findIndex((card) => String(card.id) === cardId)
    if (index === -1) return { ...deck }
    return {
      ...deck,
      hand: deck.hand.filter((_, i) => i !== index),
    }
  }

  reshuffleDiscard(deck: DeckState): DeckState {
    return {
      ...deck,
      drawPile: [...deck.drawPile, ...this.random.shuffle(deck.discardPile)],
      discardPile: [],
    }
  }

  getHandWoundCount(deck: DeckState): number {
    return deck.hand.filter((card) => card.type === 'wound').length
  }

  isKnockedOut(deck: DeckState, handLimit: number): boolean {
    return this.getHandWoundCount(deck) >= handLimit
  }

  isDeckEmpty(deck: DeckState): boolean {
    return deck.drawPile.length === 0
  }

  canDeclareEndOfRound(deck: DeckState): { must: boolean; may: boolean } {
    const deckEmpty = this.isDeckEmpty(deck)
    const handEmpty = deck.hand.length === 0
    return {
      must: deckEmpty && handEmpty,
      may: deckEmpty && !handEmpty,
    }
  }

  isWound(card: AnyCard): card is WoundCard {
    return card.type === 'wound'
  }

  isNonWound(card: AnyCard): card is DeedCard {
    return card.type !== 'wound'
  }

  countNonWoundCards(hand: AnyCard[]): number {
    return hand.filter((card) => card.type !== 'wound').length
  }
}
