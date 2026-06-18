import type {
  TacticCard,
  DeckState,
  ManaPoolState,
  ManaColor,
  ManaDie,
  AnyCard,
} from './types'
import type { SeededRandom } from '@/utils/random'

const BASIC_COLORS: ManaColor[] = ['red', 'blue', 'green', 'white']

export interface TacticSelectResult {
  deck?: DeckState
  mana?: ManaPoolState
  tactic?: TacticCard
  log?: string
}

export interface TacticTurnEndResult {
  effectiveHandLimit: number
}

export interface TacticActivationResult {
  deck?: DeckState
  mana?: ManaPoolState
  tactic?: TacticCard
  grantExtraTurn?: boolean
  log?: string
}

export class TacticEffectManager {
  private random: SeededRandom

  constructor(random: SeededRandom) {
    this.random = random
  }

  // ════════════════════════════════════════════
  //  ON-SELECT EFFECTS
  // ════════════════════════════════════════════

  applyOnSelectEffect(
    tactic: TacticCard,
    deck: DeckState,
    mana: ManaPoolState,
    options?: {
      rethinkDiscardIndices?: number[]
      manaStealDieId?: string
      preparationCardIndex?: number
    },
  ): TacticSelectResult {
    switch (tactic.id) {
      case 1:
      case 7:
        return { log: `${tactic.name}: 턴 순서만 결정 (추가 효과 없음)` }

      case 2:
        return this.applyRethink(tactic, deck, options?.rethinkDiscardIndices ?? [])

      case 3:
        return this.applyManaSteal(tactic, mana, options?.manaStealDieId)

      case 4:
        return { log: `${tactic.name}: 매 턴 종료 시 핸드 2장 이상이면 핸드 리밋 +1` }

      case 5:
        return this.applyGreatStart(tactic, deck)

      case 6:
        return { log: `${tactic.name}: 이번 라운드 중 1회, 추가 턴 선언 가능` }

      case 8:
        return { log: `${tactic.name}: 덱이 비면 디스카드에서 3장 복구 가능 (1회)` }

      case 9:
        return { log: `${tactic.name}: 매 턴 소스 다이스 최대 2개 리롤 가능` }

      case 10:
        return { log: `${tactic.name}: 턴 시작 전 핸드 최대 5장 교체 가능 (1회)` }

      case 11:
        return this.applyPreparation(tactic, deck, options?.preparationCardIndex)

      case 12:
        return { log: `${tactic.name}: 매 턴 시작 전 카드 저장/회수 선택 가능` }

      default:
        return {}
    }
  }

  private applyRethink(
    tactic: TacticCard,
    deck: DeckState,
    discardIndices: number[],
  ): TacticSelectResult {
    if (discardIndices.length === 0) {
      return { log: `${tactic.name}: 버릴 카드 없음` }
    }

    const indicesToDiscard = discardIndices.slice(0, 3)
    const cardsToDiscard = indicesToDiscard
      .filter((i) => i >= 0 && i < deck.hand.length)
      .sort((a, b) => b - a)

    let newHand = [...deck.hand]
    const discarded: AnyCard[] = []
    for (const idx of cardsToDiscard) {
      discarded.push(newHand[idx])
      newHand = newHand.filter((_, i) => i !== idx)
    }

    const allDiscard = [...deck.discardPile, ...discarded]
    const newDrawPile = [...deck.drawPile, ...this.random.shuffle(allDiscard)]

    const drawCount = Math.min(discarded.length, newDrawPile.length)
    const drawn = newDrawPile.slice(0, drawCount)
    const remainingDraw = newDrawPile.slice(drawCount)

    const newDeck: DeckState = {
      ...deck,
      hand: [...newHand, ...drawn],
      drawPile: remainingDraw,
      discardPile: [],
    }

    return {
      deck: newDeck,
      log: `${tactic.name}: ${discarded.length}장 버리고 ${drawCount}장 드로우, 디스카드 덱에 셔플`,
    }
  }

  private applyManaSteal(
    tactic: TacticCard,
    mana: ManaPoolState,
    dieId?: string,
  ): TacticSelectResult {
    const basicDiceInSource = mana.dice.filter(
      (d) => d.isInSource && BASIC_COLORS.includes(d.color as ManaColor),
    )

    if (basicDiceInSource.length === 0) {
      return { log: `${tactic.name}: 소스에 기본색 다이스 없음` }
    }

    const targetDie = dieId
      ? basicDiceInSource.find((d) => d.id === dieId) ?? basicDiceInSource[0]
      : basicDiceInSource[0]

    const newDice = mana.dice.map((d) =>
      d.id === targetDie.id ? { ...d, isInSource: false, takenByTactic: true } : d,
    )

    const updatedTactic: TacticCard = {
      ...tactic,
      storedDie: targetDie,
    }

    return {
      mana: { ...mana, dice: newDice },
      tactic: updatedTactic,
      log: `${tactic.name}: ${targetDie.color} 마나 다이스를 카드에 저장`,
    }
  }

  private applyGreatStart(tactic: TacticCard, deck: DeckState): TacticSelectResult {
    const drawCount = Math.min(2, deck.drawPile.length)
    const drawn = deck.drawPile.slice(0, drawCount)
    const newDeck: DeckState = {
      ...deck,
      hand: [...deck.hand, ...drawn],
      drawPile: deck.drawPile.slice(drawCount),
    }

    return {
      deck: newDeck,
      log: `${tactic.name}: 즉시 ${drawCount}장 드로우`,
    }
  }

  private applyPreparation(
    tactic: TacticCard,
    deck: DeckState,
    cardIndex?: number,
  ): TacticSelectResult {
    if (deck.drawPile.length === 0) {
      return { log: `${tactic.name}: 덱에 카드 없음` }
    }

    const idx = cardIndex != null && cardIndex >= 0 && cardIndex < deck.drawPile.length
      ? cardIndex
      : 0

    const card = deck.drawPile[idx]
    const remainingDraw = deck.drawPile.filter((_, i) => i !== idx)

    const newDeck: DeckState = {
      ...deck,
      hand: [...deck.hand, card],
      drawPile: this.random.shuffle(remainingDraw),
    }

    return {
      deck: newDeck,
      log: `${tactic.name}: 덱에서 카드 1장 검색하여 핸드에 추가, 덱 셔플`,
    }
  }

  // ════════════════════════════════════════════
  //  PER-TURN PASSIVE EFFECTS
  // ════════════════════════════════════════════

  // #4 Planning: hand limit +1 if 2+ non-wound cards in hand before draw
  getEffectiveHandLimit(
    tactic: TacticCard | null,
    baseHandLimit: number,
    handBeforeDraw: AnyCard[],
  ): number {
    if (!tactic || tactic.id !== 4) return baseHandLimit

    const nonWoundCount = handBeforeDraw.filter((c) => c.type !== 'wound').length
    if (nonWoundCount >= 2) {
      return baseHandLimit + 1
    }
    return baseHandLimit
  }

  // #9 Mana Search: reroll up to 2 source dice, gold/black first
  applyManaSearch(
    mana: ManaPoolState,
    dieIdsToReroll?: string[],
  ): { mana: ManaPoolState; log: string } {
    const diceInSource = mana.dice.filter((d) => d.isInSource)
    if (diceInSource.length === 0) {
      return { mana, log: 'Mana Search: 소스에 다이스 없음' }
    }

    let toReroll: ManaDie[]
    if (dieIdsToReroll && dieIdsToReroll.length > 0) {
      toReroll = dieIdsToReroll
        .map((id) => diceInSource.find((d) => d.id === id))
        .filter((d): d is ManaDie => d != null)
        .slice(0, 2)
    } else {
      const goldDice = diceInSource.filter((d) => d.color === 'gold' || d.color === 'black')
      const otherDice = diceInSource.filter((d) => d.color !== 'gold' && d.color !== 'black')
      toReroll = [...goldDice, ...otherDice].slice(0, 2)
    }

    if (toReroll.length === 0) {
      return { mana, log: 'Mana Search: 리롤할 다이스 없음' }
    }

    const rerollIds = new Set(toReroll.map((d) => d.id))
    const MANA_COLORS = ['red', 'blue', 'green', 'white', 'gold', 'black'] as const
    const newDice = mana.dice.map((d) => {
      if (rerollIds.has(d.id)) {
        return { ...d, color: this.random.pick([...MANA_COLORS]) }
      }
      return d
    })

    return {
      mana: { ...mana, dice: newDice },
      log: `Mana Search: ${toReroll.length}개 다이스 리롤`,
    }
  }

  // ════════════════════════════════════════════
  //  ONE-TIME ACTIVATABLE EFFECTS
  // ════════════════════════════════════════════

  activateRightMoment(tactic: TacticCard): TacticActivationResult {
    if (tactic.id !== 6 || tactic.isUsed) {
      return { log: 'The Right Moment: 이미 사용됨 또는 잘못된 카드' }
    }

    return {
      tactic: { ...tactic, isUsed: true },
      grantExtraTurn: true,
      log: 'The Right Moment: 추가 턴 선언! 이번 턴 후 바로 한 턴 더',
    }
  }

  activateLongNight(tactic: TacticCard, deck: DeckState): TacticActivationResult {
    if (tactic.id !== 8 || tactic.isUsed) {
      return { log: 'Long Night: 이미 사용됨 또는 잘못된 카드' }
    }

    if (deck.drawPile.length > 0) {
      return { log: 'Long Night: 덱이 비어있지 않아 사용 불가' }
    }

    if (deck.discardPile.length === 0) {
      return {
        tactic: { ...tactic, isUsed: true },
        log: 'Long Night: 디스카드 파일도 비어있음',
      }
    }

    const shuffled = this.random.shuffle([...deck.discardPile])
    const toReturn = shuffled.slice(0, 3)
    const remaining = shuffled.slice(3)

    const newDeck: DeckState = {
      ...deck,
      drawPile: toReturn,
      discardPile: remaining,
    }

    return {
      deck: newDeck,
      tactic: { ...tactic, isUsed: true },
      log: `Long Night: 디스카드에서 ${toReturn.length}장을 덱으로 복구`,
    }
  }

  activateMidnightMeditation(
    tactic: TacticCard,
    deck: DeckState,
    cardIndicesToReturn?: number[],
  ): TacticActivationResult {
    if (tactic.id !== 10 || tactic.isUsed) {
      return { log: 'Midnight Meditation: 이미 사용됨 또는 잘못된 카드' }
    }

    const indices = (cardIndicesToReturn ?? [])
      .filter((i) => i >= 0 && i < deck.hand.length)
      .slice(0, 5)

    if (indices.length === 0) {
      return { log: 'Midnight Meditation: 반환할 카드 없음' }
    }

    const cardsToReturn = indices.map((i) => deck.hand[i])
    const indexSet = new Set(indices)
    const newHand = deck.hand.filter((_, i) => !indexSet.has(i))

    const newDrawPile = this.random.shuffle([...deck.drawPile, ...cardsToReturn])

    const drawCount = Math.min(cardsToReturn.length, newDrawPile.length)
    const drawn = newDrawPile.slice(0, drawCount)
    const remainingDraw = newDrawPile.slice(drawCount)

    const newDeck: DeckState = {
      ...deck,
      hand: [...newHand, ...drawn],
      drawPile: remainingDraw,
    }

    return {
      deck: newDeck,
      tactic: { ...tactic, isUsed: true },
      log: `Midnight Meditation: ${cardsToReturn.length}장 반환, ${drawCount}장 드로우`,
    }
  }

  // ════════════════════════════════════════════
  //  SPARING POWER (#12)
  // ════════════════════════════════════════════

  activateSparingPowerStore(tactic: TacticCard, deck: DeckState): TacticActivationResult {
    if (tactic.id !== 12 || tactic.isUsed) {
      return { log: 'Sparing Power: 이미 사용됨 또는 잘못된 카드' }
    }

    if (deck.drawPile.length === 0) {
      return { log: 'Sparing Power: 덱에 카드 없음' }
    }

    const topCard = deck.drawPile[0]
    const storedCards = [...(tactic.storedCards ?? []), topCard]

    return {
      deck: {
        ...deck,
        drawPile: deck.drawPile.slice(1),
      },
      tactic: {
        ...tactic,
        storedCards,
      },
      log: `Sparing Power: 덱 상단 카드 1장 저장 (총 ${storedCards.length}장 저장 중)`,
    }
  }

  activateSparingPowerRetrieve(tactic: TacticCard, deck: DeckState): TacticActivationResult {
    if (tactic.id !== 12 || tactic.isUsed) {
      return { log: 'Sparing Power: 이미 사용됨 또는 잘못된 카드' }
    }

    const storedCards = tactic.storedCards ?? []
    if (storedCards.length === 0) {
      return { log: 'Sparing Power: 저장된 카드 없음' }
    }

    return {
      deck: {
        ...deck,
        hand: [...deck.hand, ...storedCards],
      },
      tactic: {
        ...tactic,
        isUsed: true,
        storedCards: [],
      },
      log: `Sparing Power: 저장된 ${storedCards.length}장을 핸드에 추가`,
    }
  }

  // ════════════════════════════════════════════
  //  MANA STEAL — USE STORED DIE
  // ════════════════════════════════════════════

  useManaStealDie(tactic: TacticCard, mana: ManaPoolState): TacticActivationResult {
    if (tactic.id !== 3 || !tactic.storedDie) {
      return { log: 'Mana Steal: 저장된 다이스 없음' }
    }

    const storedDie = tactic.storedDie
    const newToken = {
      color: storedDie.color,
      source: 'die' as const,
    }

    const newDice = mana.dice.map((d) =>
      d.id === storedDie.id ? { ...d, takenByTactic: false } : d,
    )

    return {
      mana: {
        ...mana,
        dice: newDice,
        playerMana: [...mana.playerMana, newToken],
      },
      tactic: {
        ...tactic,
        storedDie: undefined,
      },
      log: `Mana Steal: ${storedDie.color} 마나 사용`,
    }
  }

  // ════════════════════════════════════════════
  //  HELPERS
  // ════════════════════════════════════════════

  canActivate(tactic: TacticCard | null): {
    rightMoment: boolean
    longNight: boolean
    midnightMeditation: boolean
    sparingPowerStore: boolean
    sparingPowerRetrieve: boolean
    manaStealUse: boolean
    manaSearch: boolean
  } {
    if (!tactic) {
      return {
        rightMoment: false,
        longNight: false,
        midnightMeditation: false,
        sparingPowerStore: false,
        sparingPowerRetrieve: false,
        manaStealUse: false,
        manaSearch: false,
      }
    }

    return {
      rightMoment: tactic.id === 6 && !tactic.isUsed,
      longNight: tactic.id === 8 && !tactic.isUsed,
      midnightMeditation: tactic.id === 10 && !tactic.isUsed,
      sparingPowerStore: tactic.id === 12 && !tactic.isUsed,
      sparingPowerRetrieve: tactic.id === 12 && !tactic.isUsed && (tactic.storedCards?.length ?? 0) > 0,
      manaStealUse: tactic.id === 3 && !!tactic.storedDie,
      manaSearch: tactic.id === 9,
    }
  }

  needsOnSelectInteraction(tacticId: number): boolean {
    return [2, 3, 11].includes(tacticId)
  }
}

export function canActivateTactic(
  tactic: TacticCard | null,
  manaSearchUsedThisTurn = false,
): {
  rightMoment: boolean
  longNight: boolean
  midnightMeditation: boolean
  sparingPowerStore: boolean
  sparingPowerRetrieve: boolean
  manaStealUse: boolean
  manaSearch: boolean
} {
  if (!tactic) {
    return {
      rightMoment: false,
      longNight: false,
      midnightMeditation: false,
      sparingPowerStore: false,
      sparingPowerRetrieve: false,
      manaStealUse: false,
      manaSearch: false,
    }
  }

  return {
    rightMoment: tactic.id === 6 && !tactic.isUsed,
    longNight: tactic.id === 8 && !tactic.isUsed,
    midnightMeditation: tactic.id === 10 && !tactic.isUsed,
    sparingPowerStore: tactic.id === 12 && !tactic.isUsed,
    sparingPowerRetrieve: tactic.id === 12 && !tactic.isUsed && (tactic.storedCards?.length ?? 0) > 0,
    manaStealUse: tactic.id === 3 && !!tactic.storedDie,
    // Mana Search is once per turn (rulebook)
    manaSearch: tactic.id === 9 && !manaSearchUsedThisTurn,
  }
}
