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

  executeDummyTurn(state: DummyPlayerState): DummyPlayerState {
    if (state.deedDeck.length === 0) {
      return { ...state, hasEndedRound: true }
    }

    let deck = [...state.deedDeck]
    let discard = [...state.discardPile]
    let crystals = { ...state.crystals }
    let flipped = state.cardsFlippedThisRound

    const cardsToFlip = Math.min(3, deck.length)
    for (let i = 0; i < cardsToFlip; i++) {
      const card = deck.shift()!
      discard.push(card)
      flipped++
    }

    let hasEndedRound = deck.length === 0

    if (!hasEndedRound && discard.length > 0) {
      let lastColor = this.getCardColor(discard[discard.length - 1])
      while (lastColor && this.hasCrystal(crystals, lastColor) && deck.length > 0) {
        crystals = this.removeCrystal(crystals, lastColor)
        const card = deck.shift()!
        discard.push(card)
        flipped++
        if (deck.length === 0) {
          hasEndedRound = true
          break
        }
        lastColor = this.getCardColor(discard[discard.length - 1])
      }
    }

    return {
      ...state,
      deedDeck: deck,
      discardPile: discard,
      crystals,
      hasEndedRound,
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
