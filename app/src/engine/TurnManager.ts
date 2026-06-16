import type {
  DayNight,
  GamePhase,
  TacticCard,
  TurnState,
  TurnType,
  RestType,
  CombatPhase,
} from './types'
import type { SeededRandom } from '@/utils/random'

export interface RoundState {
  roundNumber: number
  dayNight: DayNight
  availableTactics: TacticCard[]
  playerTactic: TacticCard | null
  dummyTactic: TacticCard | null
  turnOrder: 'player_first' | 'dummy_first'
  isEnded: boolean
}

export interface PhaseContext {
  isResting?: boolean
  enteredCombat?: boolean
  combatEnded?: boolean
  leveledUp?: boolean
  roundEnding?: boolean
  gameEnding?: boolean
}

export interface EndOfRoundConfig {
  currentRound: number
  totalRounds: number
  roundPattern: DayNight[]
}

export interface EndOfRoundResult {
  nextRound: number
  nextDayNight: DayNight
  isGameOver: boolean
}

export class TurnManager {
  random: SeededRandom

  constructor(random: SeededRandom) {
    this.random = random
  }


  startRound(roundNumber: number, dayNight: DayNight, availableTactics: TacticCard[]): RoundState {
    return {
      roundNumber,
      dayNight,
      availableTactics: [...availableTactics],
      playerTactic: null,
      dummyTactic: null,
      turnOrder: 'dummy_first',
      isEnded: false,
    }
  }

  endRound(roundState: RoundState): RoundState {
    const usedTactics = [roundState.playerTactic, roundState.dummyTactic].filter(
      (t): t is TacticCard => t !== null,
    )
    return {
      ...roundState,
      isEnded: true,
      availableTactics: roundState.availableTactics.filter(
        (t) => !usedTactics.some((used) => used.id === t.id),
      ),
    }
  }

  isRoundOver(playerEndedRound: boolean, dummyEndedRound: boolean): boolean {
    return playerEndedRound && dummyEndedRound
  }

  getRoundPattern(totalRounds: number): DayNight[] {
    if (totalRounds === 3) {
      return ['day', 'night', 'day']
    }
    const pattern: DayNight[] = []
    for (let i = 0; i < totalRounds; i++) {
      pattern.push(i % 2 === 0 ? 'day' : 'night')
    }
    return pattern
  }

  selectTacticForDummy(
    available: TacticCard[],
  ): { selected: TacticCard; remaining: TacticCard[] } {
    // EC-04-B-1: Dummy Player selects a RANDOM tactic, not lowest number
    const selected = this.random.pick(available)
    const remaining = available.filter((t) => t.id !== selected.id)
    return { selected, remaining }
  }

  selectTacticForPlayer(
    available: TacticCard[],
    tacticId: number,
  ): { selected: TacticCard; remaining: TacticCard[] } {
    const selected = available.find((t) => t.id === tacticId)
    if (!selected) {
      throw new Error(`Tactic with id ${tacticId} not found in available tactics`)
    }
    const remaining = available.filter((t) => t.id !== tacticId)
    return { selected, remaining }
  }

  determineTurnOrder(
    playerTactic: TacticCard,
    dummyTactic: TacticCard,
  ): 'player_first' | 'dummy_first' {
    return playerTactic.number < dummyTactic.number ? 'player_first' : 'dummy_first'
  }

  startTurn(turnState: TurnState, turnNumber: number): TurnState {
    return {
      ...turnState,
      turnNumber,
      turnType: 'regular',
      hasMovedThisTurn: false,
      hasActedThisTurn: false,
      cardsPlayedThisTurn: [],
      unitsActivatedThisTurn: [],
      sidewaysCardsPlayed: 0,
      movePointsAvailable: 0,
      movePointsSpent: 0,
      forcedCombat: false,
      endOfRoundDeclared: false,
      healingAvailable: 0,
      terrainModifiers: [],
      hasPlunderedThisTurn: false,
    }
  }

  endTurn(turnState: TurnState): TurnState {
    return {
      ...turnState,
      endOfRoundDeclared: false,
    }
  }

  canDeclareEndOfRound(
    deckEmpty: boolean,
    handEmpty: boolean,
  ): { must: boolean; may: boolean } {
    if (!deckEmpty) {
      return { must: false, may: false }
    }
    return {
      must: deckEmpty && handEmpty,
      may: deckEmpty && !handEmpty,
    }
  }

  setTurnType(turnState: TurnState, type: TurnType): TurnState {
    return {
      ...turnState,
      turnType: type,
    }
  }

  canRest(hasNonWoundCards: boolean, hasOnlyWounds: boolean): RestType | null {
    if (hasNonWoundCards) return 'standard'
    if (hasOnlyWounds) return 'slow_recovery'
    return null
  }

  advancePhase(currentPhase: GamePhase, context: PhaseContext): GamePhase {
    if (context.gameEnding) return 'game_over'

    switch (currentPhase) {
      case 'setup':
        return 'round_start'
      case 'round_start':
        return 'tactic_selection'
      case 'tactic_selection':
        return 'player_turn_start'
      case 'player_turn_start':
        if (context.isResting) return 'end_of_turn'
        return 'movement'
      case 'movement':
        return 'action_declaration'
      case 'action_declaration':
        if (context.enteredCombat) return 'combat_ranged_siege'
        return 'interaction'
      case 'interaction':
        return 'end_of_turn'
      case 'combat_ranged_siege':
        return 'combat_block'
      case 'combat_block':
        return 'combat_assign_damage'
      case 'combat_assign_damage':
        return 'combat_attack'
      case 'combat_attack':
        return 'combat_end'
      case 'combat_end':
        if (context.leveledUp) return 'level_up'
        return 'end_of_turn'
      case 'level_up':
        return 'end_of_turn'
      case 'end_of_turn':
        if (context.roundEnding) return 'end_of_round'
        return 'player_turn_start'
      case 'end_of_round':
        if (context.gameEnding) return 'game_over'
        return 'round_start'
      case 'game_over':
        return 'game_over'
      default:
        return currentPhase
    }
  }

  getCombatPhaseSequence(): CombatPhase[] {
    return ['ranged_siege', 'block', 'assign_damage', 'attack', 'combat_end']
  }

  processEndOfRound(config: EndOfRoundConfig): EndOfRoundResult {
    const { currentRound, totalRounds, roundPattern } = config
    const isGameOver = currentRound >= totalRounds
    const nextRound = currentRound + 1
    const nextDayNight: DayNight = isGameOver
      ? roundPattern[roundPattern.length - 1]
      : roundPattern[nextRound - 1]

    return {
      nextRound,
      nextDayNight,
      isGameOver,
    }
  }
}
