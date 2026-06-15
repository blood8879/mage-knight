import type {
  AnyCard,
  CrystalInventory,
  DummyPlayerState,
  ManaColor,
  TacticCard,
} from './types'
import type { SeededRandom } from '@/utils/random'
import { INITIAL_CRYSTALS } from './GameState'

const GOLDYX_STARTING_CRYSTALS: CrystalInventory = {
  red: 0,
  blue: 1,
  green: 2,
  white: 0,
}

export class DummyPlayer {
  private random: SeededRandom

  constructor(random: SeededRandom) {
    this.random = random
  }

  initializeDummy(heroName: string, basicActionCards: AnyCard[]): DummyPlayerState {
    const deck = this.random.shuffle(basicActionCards)
    const crystals = heroName === 'Goldyx'
      ? { ...GOLDYX_STARTING_CRYSTALS }
      : { ...INITIAL_CRYSTALS }
    return {
      heroName,
      deedDeck: deck,
      discardPile: [],
      crystals,
      tacticCard: null,
      hasEndedRound: false,
      cardsFlippedThisRound: 0,
    }
  }

  /**
   * Rulebook (Scenario Book — "Cooperative and Solo Scenarios", Dummy player's
   * turn):
   *  - Deck empty at the START of the turn → announce End of the Round.
   *  - Otherwise flip three cards, then check the color of the topmost (last
   *    flipped) card and flip a number of ADDITIONAL cards equal to the dummy's
   *    crystals of that color. Crystals are NOT spent, the color is checked only
   *    ONCE, and the colors of the additional cards do not matter.
   *  - If there are not enough cards, flip as many as you can; End of the Round
   *    is announced on the dummy's NEXT turn (when the deck is empty), not this
   *    one.
   */
  executeDummyTurn(state: DummyPlayerState): DummyPlayerState {
    if (state.deedDeck.length === 0) {
      return { ...state, hasEndedRound: true }
    }

    const deck = [...state.deedDeck]
    const discard = [...state.discardPile]
    let flipped = state.cardsFlippedThisRound

    // 1) Flip up to three cards into the discard pile.
    const initialFlips = Math.min(3, deck.length)
    for (let i = 0; i < initialFlips; i++) {
      discard.push(deck.shift()!)
      flipped++
    }

    // 2) Flip additional cards equal to crystals of the topmost card's color.
    //    Crystals persist (they are a per-round speed counter, not a cost).
    if (deck.length > 0) {
      const color = this.getCardColor(discard[discard.length - 1])
      const extra = color ? Math.min(state.crystals[color], deck.length) : 0
      for (let i = 0; i < extra; i++) {
        discard.push(deck.shift()!)
        flipped++
      }
    }

    // Running out of cards does not end the round this turn — End of the Round
    // is announced on the next turn, when the deck is empty at turn start.
    return {
      ...state,
      deedDeck: deck,
      discardPile: discard,
      hasEndedRound: false,
      cardsFlippedThisRound: flipped,
    }
  }

  getLastFlippedCardColor(state: DummyPlayerState): ManaColor | null {
    if (state.discardPile.length === 0) return null
    return this.getCardColor(state.discardPile[state.discardPile.length - 1])
  }

  shouldContinueFlipping(state: DummyPlayerState, lastColor: ManaColor): boolean {
    return this.hasCrystal(state.crystals, lastColor) && state.deedDeck.length > 0
  }

  consumeCrystal(state: DummyPlayerState, color: ManaColor): DummyPlayerState {
    if (state.crystals[color] <= 0) return { ...state }
    return {
      ...state,
      crystals: this.removeCrystal(state.crystals, color),
    }
  }

  processRoundStartForDummy(
    state: DummyPlayerState,
    removedAACard: AnyCard | null,
    removedSpellColor: ManaColor | null,
  ): DummyPlayerState {
    let allCards = [...state.deedDeck, ...state.discardPile]
    if (removedAACard) {
      allCards = [...allCards, removedAACard]
    }
    const crystals = { ...state.crystals }
    if (removedSpellColor) {
      crystals[removedSpellColor] = crystals[removedSpellColor] + 1
    }
    return {
      ...state,
      deedDeck: this.random.shuffle(allCards),
      discardPile: [],
      crystals,
      cardsFlippedThisRound: 0,
      hasEndedRound: false,
    }
  }

  getDummyRemainingCards(state: DummyPlayerState): number {
    return state.deedDeck.length
  }

  selectDummyTactic(available: TacticCard[]): { selected: TacticCard; remaining: TacticCard[] } {
    // EC-04-B-1: Dummy Player selects a RANDOM tactic, not lowest number
    const selected = this.random.pick(available)
    const remaining = available.filter((t) => t.id !== selected.id)
    return { selected, remaining }
  }

  private getCardColor(card: AnyCard): ManaColor | null {
    if (card.type === 'wound') return null
    const color = card.color
    if (typeof color === 'string') return color as ManaColor
    if (Array.isArray(color) && color.length > 0) return color[0]
    return null
  }

  private hasCrystal(crystals: CrystalInventory, color: ManaColor): boolean {
    return crystals[color] > 0
  }

  private removeCrystal(crystals: CrystalInventory, color: ManaColor): CrystalInventory {
    return {
      ...crystals,
      [color]: crystals[color] - 1,
    }
  }
}
