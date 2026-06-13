import type {
  ManaPoolState,
  ManaDie,
  ManaToken,
  ExtendedManaColor,
  ManaColor,
  DayNight,
} from './types'
import type { SeededRandom } from '@/utils/random'
import { INITIAL_MANA_POOL, INITIAL_CRYSTALS, MAX_CRYSTAL_PER_COLOR } from './GameState'

const MANA_COLORS: ExtendedManaColor[] = ['red', 'blue', 'green', 'white', 'gold', 'black']
const BASIC_COLORS: ManaColor[] = ['red', 'blue', 'green', 'white']

export class ManaPool {
  private random: SeededRandom

  constructor(random: SeededRandom) {
    this.random = random
  }

  rollDie(): ExtendedManaColor {
    return this.random.pick(MANA_COLORS)
  }

  initializeSource(diceCount: number): ManaPoolState {
    const dice = this.createAndValidateDice(diceCount)
    return {
      ...INITIAL_MANA_POOL,
      dice,
      playerMana: [],
      crystals: { ...INITIAL_CRYSTALS },
      sourceDieTakenThisTurn: false,
    }
  }

  rerollSource(state: ManaPoolState): ManaPoolState {
    const diceCount = state.dice.length
    const dice = this.createAndValidateDice(diceCount)
    return {
      ...state,
      dice,
      sourceDieTakenThisTurn: false,
      extraSourceDice: 0,
    }
  }

  takeDieFromSource(state: ManaPoolState, dieId: string, dayNight: DayNight): ManaPoolState {
    // EC-01-B-1: Only one die per turn from Source (unless an effect like
    // Mana Draw grants extra draws)
    const usingExtraDraw = state.sourceDieTakenThisTurn
    if (usingExtraDraw && (state.extraSourceDice ?? 0) <= 0) return state

    const dieIndex = state.dice.findIndex((d) => d.id === dieId)
    if (dieIndex === -1) return state

    const die = state.dice[dieIndex]
    if (!die.isInSource) return state

    // EC-01-B-2: Gold dice can only be taken during Day
    if (die.color === 'gold' && dayNight !== 'day') return state
    // EC-01-B-3: Black dice can only be taken during Night
    if (die.color === 'black' && dayNight !== 'night') return state

    const newDice = state.dice.map((d) =>
      d.id === dieId ? { ...d, isInSource: false } : d,
    )

    const newToken: ManaToken = {
      color: die.color,
      source: 'die',
    }

    return {
      ...state,
      dice: newDice,
      playerMana: [...state.playerMana, newToken],
      sourceDieTakenThisTurn: true,
      extraSourceDice: usingExtraDraw ? (state.extraSourceDice ?? 0) - 1 : state.extraSourceDice,
    }
  }

  returnDieToSource(state: ManaPoolState, dieId: string): ManaPoolState {
    const dieIndex = state.dice.findIndex((d) => d.id === dieId)
    if (dieIndex === -1) return state

    const die = state.dice[dieIndex]
    if (die.isInSource) return state

    const newColor = this.rollDie()
    const newDice = state.dice.map((d) =>
      d.id === dieId ? { ...d, color: newColor, isInSource: true } : d,
    )

    return {
      ...state,
      dice: newDice,
    }
  }

  returnAllDice(state: ManaPoolState): ManaPoolState {
    const newDice = state.dice.map((die) => {
      if (die.isInSource) return die
      // Mana Steal로 전술 카드에 저장된 주사위는 돌려보내지 않음
      if (die.takenByTactic) return die
      const newColor = this.rollDie()
      return { ...die, color: newColor, isInSource: true }
    })

    return {
      ...state,
      dice: newDice,
    }
  }

  addManaToken(
    state: ManaPoolState,
    color: ManaColor | 'gold' | 'black',
    source: ManaToken['source'],
  ): ManaPoolState {
    const newToken: ManaToken = { color, source }
    return {
      ...state,
      playerMana: [...state.playerMana, newToken],
    }
  }

  removeManaToken(state: ManaPoolState, index: number): ManaPoolState {
    if (index < 0 || index >= state.playerMana.length) return state
    const newPlayerMana = state.playerMana.filter((_, i) => i !== index)
    return {
      ...state,
      playerMana: newPlayerMana,
    }
  }

  clearPlayerMana(state: ManaPoolState): ManaPoolState {
    return {
      ...state,
      playerMana: [],
    }
  }

  canUseManaColor(state: ManaPoolState, color: ManaColor, dayNight: DayNight): boolean {
    for (const token of state.playerMana) {
      if (token.color === color) return true
      // EC-01-C: Gold mana substitutes for any basic color (Day only)
      if (token.color === 'gold' && dayNight === 'day') return true
      // EC-01-D: Black mana does NOT substitute for basic colors.
      // It is only used for specific powering effects (Action strong at night, etc.)
    }

    if (state.crystals[color] > 0) return true

    return false
  }

  /**
   * Check if black mana is available for powering effects (Night only).
   * Black mana never substitutes for basic colors — it's only for explicit power costs.
   */
  hasBlackMana(state: ManaPoolState, dayNight: DayNight): boolean {
    if (dayNight !== 'night') return false
    return state.playerMana.some((t) => t.color === 'black')
  }

  /**
   * Spend a black mana token (for Action strong effect at Night, etc.)
   */
  spendBlackMana(state: ManaPoolState): ManaPoolState | null {
    const idx = state.playerMana.findIndex((t) => t.color === 'black')
    if (idx === -1) return null
    return this.removeManaToken(state, idx)
  }

  spendManaOfColor(state: ManaPoolState, color: ManaColor, dayNight: DayNight): ManaPoolState | null {
    const exactIdx = state.playerMana.findIndex((t) => t.color === color)
    if (exactIdx !== -1) return this.removeManaToken(state, exactIdx)

    if (dayNight === 'day') {
      const goldIdx = state.playerMana.findIndex((t) => t.color === 'gold')
      if (goldIdx !== -1) return this.removeManaToken(state, goldIdx)
    }

    if (state.crystals[color] > 0) return this.removeCrystal(state, color)

    return null
  }

  addCrystal(state: ManaPoolState, color: ManaColor): ManaPoolState {
    if (state.crystals[color] >= MAX_CRYSTAL_PER_COLOR) {
      // EC-01-E-1: Crystal full → give pure mana token instead
      return this.addManaToken(state, color, 'effect')
    }
    return {
      ...state,
      crystals: {
        ...state.crystals,
        [color]: state.crystals[color] + 1,
      },
    }
  }

  removeCrystal(state: ManaPoolState, color: ManaColor): ManaPoolState {
    if (state.crystals[color] <= 0) return state
    return {
      ...state,
      crystals: {
        ...state.crystals,
        [color]: state.crystals[color] - 1,
      },
    }
  }

  canAddCrystal(state: ManaPoolState, color: ManaColor): boolean {
    return state.crystals[color] < MAX_CRYSTAL_PER_COLOR
  }

  useCrystalAsMana(state: ManaPoolState, color: ManaColor): ManaPoolState {
    if (state.crystals[color] <= 0) return state
    const afterRemove = this.removeCrystal(state, color)
    return this.addManaToken(afterRemove, color, 'crystal')
  }

  getTotalCrystals(state: ManaPoolState): number {
    return BASIC_COLORS.reduce((total, color) => total + state.crystals[color], 0)
  }

  isGoldUsable(dayNight: DayNight): boolean {
    return dayNight === 'day'
  }

  isBlackUsable(dayNight: DayNight): boolean {
    return dayNight === 'night'
  }

  getAvailableManaColors(state: ManaPoolState, dayNight: DayNight): ExtendedManaColor[] {
    const available = new Set<ExtendedManaColor>()

    for (const token of state.playerMana) {
      if (token.color === 'gold') {
        if (this.isGoldUsable(dayNight)) available.add('gold')
      } else if (token.color === 'black') {
        if (this.isBlackUsable(dayNight)) available.add('black')
      } else {
        available.add(token.color)
      }
    }

    for (const color of BASIC_COLORS) {
      if (state.crystals[color] > 0) {
        available.add(color)
      }
    }

    return Array.from(available)
  }

  resetTurnState(state: ManaPoolState): ManaPoolState {
    const afterReturn = this.returnAllDice(state)
    return {
      ...afterReturn,
      playerMana: [],
      sourceDieTakenThisTurn: false,
      extraSourceDice: 0,
    }
  }

  private createAndValidateDice(diceCount: number): ManaDie[] {
    const minBasic = Math.ceil(diceCount / 2)
    let dice = this.rollAllDice(diceCount)

    let attempts = 0
    while (this.countBasicDice(dice) < minBasic && attempts < 10) {
      attempts++
      dice = dice.map((die) => {
        if (die.color === 'gold' || die.color === 'black') {
          return { ...die, color: this.rollDie() }
        }
        return die
      })
    }

    // EC-01-A-1: After 10 attempts, force-convert remaining gold/black to basic colors
    if (this.countBasicDice(dice) < minBasic) {
      dice = dice.map((die) => {
        if (die.color === 'gold' || die.color === 'black') {
          return { ...die, color: this.random.pick(BASIC_COLORS) }
        }
        return die
      })
    }

    return dice
  }

  private rollAllDice(diceCount: number): ManaDie[] {
    return Array.from({ length: diceCount }, (_, i) => ({
      id: `die_${i}`,
      color: this.rollDie(),
      isInSource: true,
    }))
  }

  private countBasicDice(dice: ManaDie[]): number {
    return dice.filter((d) => BASIC_COLORS.includes(d.color as ManaColor)).length
  }
}
