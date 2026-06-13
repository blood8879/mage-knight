import { describe, it, expect, beforeEach } from 'vitest'
import { TurnManager } from '@/engine/TurnManager'
import type { RoundState, PhaseContext } from '@/engine/TurnManager'
import { SeededRandom } from '@/utils/random'
import { INITIAL_TURN_STATE } from '@/engine/GameState'
import type { TacticCard, TurnState, GamePhase } from '@/engine/types'

function makeTactic(id: number, number: number, type: 'day' | 'night' = 'day'): TacticCard {
  return {
    id,
    name: `Tactic_${id}`,
    type,
    number,
    effect: `Effect for tactic ${id}`,
    isUsed: false,
  }
}

function makeDayTactics(): TacticCard[] {
  return [
    makeTactic(1, 1, 'day'),
    makeTactic(2, 2, 'day'),
    makeTactic(3, 3, 'day'),
    makeTactic(4, 4, 'day'),
    makeTactic(5, 5, 'day'),
    makeTactic(6, 6, 'day'),
  ]
}

function freshTurnState(): TurnState {
  return { ...INITIAL_TURN_STATE }
}

describe('TurnManager', () => {
  let tm: TurnManager
  let random: SeededRandom

  beforeEach(() => {
    random = new SeededRandom(42)
    tm = new TurnManager(random)
  })

  describe('startRound', () => {
    it('initializes a round with correct day/night and available tactics', () => {
      const tactics = makeDayTactics()
      const round = tm.startRound(1, 'day', tactics)

      expect(round.roundNumber).toBe(1)
      expect(round.dayNight).toBe('day')
      expect(round.availableTactics).toHaveLength(6)
      expect(round.playerTactic).toBeNull()
      expect(round.dummyTactic).toBeNull()
      expect(round.isEnded).toBe(false)
    })

    it('initializes a night round correctly', () => {
      const tactics = [makeTactic(7, 1, 'night'), makeTactic(8, 2, 'night')]
      const round = tm.startRound(2, 'night', tactics)

      expect(round.roundNumber).toBe(2)
      expect(round.dayNight).toBe('night')
      expect(round.availableTactics).toHaveLength(2)
    })
  })

  describe('endRound', () => {
    it('marks round as ended', () => {
      const round: RoundState = {
        roundNumber: 1,
        dayNight: 'day',
        availableTactics: makeDayTactics(),
        playerTactic: makeTactic(2, 2),
        dummyTactic: makeTactic(1, 1),
        turnOrder: 'dummy_first',
        isEnded: false,
      }

      const ended = tm.endRound(round)

      expect(ended.isEnded).toBe(true)
    })

    it('removes used tactics from available list', () => {
      const tactics = makeDayTactics()
      const round: RoundState = {
        roundNumber: 1,
        dayNight: 'day',
        availableTactics: tactics,
        playerTactic: tactics[1],
        dummyTactic: tactics[0],
        turnOrder: 'dummy_first',
        isEnded: false,
      }

      const ended = tm.endRound(round)

      expect(ended.availableTactics).toHaveLength(4)
      expect(ended.availableTactics.find((t) => t.id === 1)).toBeUndefined()
      expect(ended.availableTactics.find((t) => t.id === 2)).toBeUndefined()
    })
  })

  describe('isRoundOver', () => {
    it('returns true when both player and dummy have ended round', () => {
      expect(tm.isRoundOver(true, true)).toBe(true)
    })

    it('returns false when only player has ended round', () => {
      expect(tm.isRoundOver(true, false)).toBe(false)
    })

    it('returns false when only dummy has ended round', () => {
      expect(tm.isRoundOver(false, true)).toBe(false)
    })

    it('returns false when neither has ended round', () => {
      expect(tm.isRoundOver(false, false)).toBe(false)
    })
  })

  describe('getRoundPattern', () => {
    it('returns [day, night, day] for First Recon (3 rounds)', () => {
      const pattern = tm.getRoundPattern(3)

      expect(pattern).toEqual(['day', 'night', 'day'])
    })

    it('generates alternating day/night for even number of rounds', () => {
      const pattern = tm.getRoundPattern(4)

      expect(pattern).toEqual(['day', 'night', 'day', 'night'])
    })

    it('generates alternating day/night for 6 rounds', () => {
      const pattern = tm.getRoundPattern(6)

      expect(pattern).toEqual(['day', 'night', 'day', 'night', 'day', 'night'])
    })

    it('returns single day for 1 round', () => {
      const pattern = tm.getRoundPattern(1)

      expect(pattern).toEqual(['day'])
    })
  })

  describe('selectTacticForDummy', () => {
    it('selects a valid tactic from the available list', () => {
      const tactics = makeDayTactics()
      const { selected, remaining } = tm.selectTacticForDummy(tactics)

      expect(tactics).toContainEqual(selected)
      expect(remaining).toHaveLength(5)
      expect(remaining.find((t) => t.id === selected.id)).toBeUndefined()
    })

    it('selected tactic is not in remaining list', () => {
      const tactics = [makeTactic(5, 5), makeTactic(3, 3), makeTactic(4, 4)]
      const { selected, remaining } = tm.selectTacticForDummy(tactics)

      expect(remaining).toHaveLength(2)
      expect(remaining.find((t) => t.id === selected.id)).toBeUndefined()
    })

    it('does not mutate the input array', () => {
      const tactics = makeDayTactics()
      const originalLength = tactics.length

      tm.selectTacticForDummy(tactics)

      expect(tactics).toHaveLength(originalLength)
    })
  })

  describe('selectTacticForPlayer', () => {
    it('selects the tactic with the given id', () => {
      const tactics = makeDayTactics()
      const { selected, remaining } = tm.selectTacticForPlayer(tactics, 4)

      expect(selected.id).toBe(4)
      expect(selected.number).toBe(4)
      expect(remaining).toHaveLength(5)
      expect(remaining.find((t) => t.id === 4)).toBeUndefined()
    })

    it('throws when tactic id is not found', () => {
      const tactics = makeDayTactics()

      expect(() => tm.selectTacticForPlayer(tactics, 99)).toThrow(
        'Tactic with id 99 not found in available tactics',
      )
    })
  })

  describe('determineTurnOrder', () => {
    it('returns player_first when player has lower tactic number', () => {
      const playerTactic = makeTactic(1, 1)
      const dummyTactic = makeTactic(3, 3)

      expect(tm.determineTurnOrder(playerTactic, dummyTactic)).toBe('player_first')
    })

    it('returns dummy_first when dummy has lower tactic number', () => {
      const playerTactic = makeTactic(4, 4)
      const dummyTactic = makeTactic(2, 2)

      expect(tm.determineTurnOrder(playerTactic, dummyTactic)).toBe('dummy_first')
    })

    it('returns dummy_first when tactic numbers are equal', () => {
      const playerTactic = makeTactic(1, 3)
      const dummyTactic = makeTactic(2, 3)

      expect(tm.determineTurnOrder(playerTactic, dummyTactic)).toBe('dummy_first')
    })
  })

  describe('startTurn', () => {
    it('resets turn-level flags and sets turnNumber', () => {
      const turnState: TurnState = {
        ...INITIAL_TURN_STATE,
        turnNumber: 2,
        hasMovedThisTurn: true,
        hasActedThisTurn: true,
        cardsPlayedThisTurn: ['card_1', 'card_2'],
        unitsActivatedThisTurn: ['unit_1'],
        sidewaysCardsPlayed: 1,
        movePointsAvailable: 4,
        movePointsSpent: 3,
        forcedCombat: true,
        endOfRoundDeclared: true,
      }

      const result = tm.startTurn(turnState, 3)

      expect(result.turnNumber).toBe(3)
      expect(result.turnType).toBe('regular')
      expect(result.hasMovedThisTurn).toBe(false)
      expect(result.hasActedThisTurn).toBe(false)
      expect(result.cardsPlayedThisTurn).toEqual([])
      expect(result.unitsActivatedThisTurn).toEqual([])
      expect(result.sidewaysCardsPlayed).toBe(0)
      expect(result.movePointsAvailable).toBe(0)
      expect(result.movePointsSpent).toBe(0)
      expect(result.forcedCombat).toBe(false)
      expect(result.endOfRoundDeclared).toBe(false)
    })
  })

  describe('endTurn', () => {
    it('returns a new turn state with endOfRoundDeclared reset', () => {
      const turnState: TurnState = {
        ...INITIAL_TURN_STATE,
        turnNumber: 1,
        hasMovedThisTurn: true,
        endOfRoundDeclared: true,
      }

      const result = tm.endTurn(turnState)

      expect(result.endOfRoundDeclared).toBe(false)
      expect(result.hasMovedThisTurn).toBe(true)
    })
  })

  describe('canDeclareEndOfRound', () => {
    it('returns must=true when deck and hand are both empty', () => {
      const result = tm.canDeclareEndOfRound(true, true)

      expect(result.must).toBe(true)
      expect(result.may).toBe(false)
    })

    it('returns may=true when deck is empty but hand has cards', () => {
      const result = tm.canDeclareEndOfRound(true, false)

      expect(result.must).toBe(false)
      expect(result.may).toBe(true)
    })

    it('returns both false when deck is not empty', () => {
      const result = tm.canDeclareEndOfRound(false, false)

      expect(result.must).toBe(false)
      expect(result.may).toBe(false)
    })

    it('returns both false when deck is not empty even if hand is empty', () => {
      const result = tm.canDeclareEndOfRound(false, true)

      expect(result.must).toBe(false)
      expect(result.may).toBe(false)
    })
  })

  describe('setTurnType', () => {
    it('sets turn type to regular', () => {
      const turnState = freshTurnState()
      const result = tm.setTurnType(turnState, 'regular')

      expect(result.turnType).toBe('regular')
    })

    it('sets turn type to resting', () => {
      const turnState = freshTurnState()
      const result = tm.setTurnType(turnState, 'resting')

      expect(result.turnType).toBe('resting')
    })

    it('does not mutate the original turn state', () => {
      const turnState = freshTurnState()
      tm.setTurnType(turnState, 'resting')

      expect(turnState.turnType).toBe('regular')
    })
  })

  describe('canRest', () => {
    it('returns standard when player has non-wound cards', () => {
      expect(tm.canRest(true, false)).toBe('standard')
    })

    it('returns slow_recovery when player has only wounds', () => {
      expect(tm.canRest(false, true)).toBe('slow_recovery')
    })

    it('returns null when no rest is possible', () => {
      expect(tm.canRest(false, false)).toBeNull()
    })

    it('returns standard when player has both non-wound and wound cards', () => {
      expect(tm.canRest(true, false)).toBe('standard')
    })
  })

  describe('advancePhase — normal flow', () => {
    it('progresses setup → round_start → tactic_selection → player_turn_start', () => {
      const ctx: PhaseContext = {}

      expect(tm.advancePhase('setup', ctx)).toBe('round_start')
      expect(tm.advancePhase('round_start', ctx)).toBe('tactic_selection')
      expect(tm.advancePhase('tactic_selection', ctx)).toBe('player_turn_start')
    })

    it('progresses player_turn_start → movement → action_declaration → interaction → end_of_turn', () => {
      const ctx: PhaseContext = {}

      expect(tm.advancePhase('player_turn_start', ctx)).toBe('movement')
      expect(tm.advancePhase('movement', ctx)).toBe('action_declaration')
      expect(tm.advancePhase('action_declaration', ctx)).toBe('interaction')
      expect(tm.advancePhase('interaction', ctx)).toBe('end_of_turn')
    })

    it('returns player_turn_start from end_of_turn when round is not ending', () => {
      const ctx: PhaseContext = { roundEnding: false }

      expect(tm.advancePhase('end_of_turn', ctx)).toBe('player_turn_start')
    })
  })

  describe('advancePhase — combat branch', () => {
    it('enters combat flow from action_declaration when enteredCombat is true', () => {
      const ctx: PhaseContext = { enteredCombat: true }

      expect(tm.advancePhase('action_declaration', ctx)).toBe('combat_ranged_siege')
    })

    it('progresses through full combat sequence', () => {
      const ctx: PhaseContext = {}

      expect(tm.advancePhase('combat_ranged_siege', ctx)).toBe('combat_block')
      expect(tm.advancePhase('combat_block', ctx)).toBe('combat_assign_damage')
      expect(tm.advancePhase('combat_assign_damage', ctx)).toBe('combat_attack')
      expect(tm.advancePhase('combat_attack', ctx)).toBe('combat_end')
      expect(tm.advancePhase('combat_end', ctx)).toBe('end_of_turn')
    })

    it('goes to level_up after combat if leveledUp is true', () => {
      const ctx: PhaseContext = { leveledUp: true }

      expect(tm.advancePhase('combat_end', ctx)).toBe('level_up')
      expect(tm.advancePhase('level_up', {})).toBe('end_of_turn')
    })
  })

  describe('advancePhase — resting branch', () => {
    it('skips movement and action when resting', () => {
      const ctx: PhaseContext = { isResting: true }

      expect(tm.advancePhase('player_turn_start', ctx)).toBe('end_of_turn')
    })
  })

  describe('advancePhase — round ending and game over', () => {
    it('goes to end_of_round from end_of_turn when roundEnding', () => {
      const ctx: PhaseContext = { roundEnding: true }

      expect(tm.advancePhase('end_of_turn', ctx)).toBe('end_of_round')
    })

    it('goes to round_start from end_of_round when game continues', () => {
      const ctx: PhaseContext = { gameEnding: false }

      expect(tm.advancePhase('end_of_round', ctx)).toBe('round_start')
    })

    it('goes to game_over from any phase when gameEnding is true', () => {
      const ctx: PhaseContext = { gameEnding: true }

      expect(tm.advancePhase('end_of_round', ctx)).toBe('game_over')
      expect(tm.advancePhase('end_of_turn', ctx)).toBe('game_over')
      expect(tm.advancePhase('movement', ctx)).toBe('game_over')
    })

    it('stays at game_over once reached', () => {
      expect(tm.advancePhase('game_over', {})).toBe('game_over')
    })
  })

  describe('getCombatPhaseSequence', () => {
    it('returns the correct combat phase order', () => {
      const sequence = tm.getCombatPhaseSequence()

      expect(sequence).toEqual([
        'ranged_siege',
        'block',
        'assign_damage',
        'attack',
        'combat_end',
      ])
    })
  })

  describe('processEndOfRound', () => {
    it('returns next round info when game continues', () => {
      const result = tm.processEndOfRound({
        currentRound: 1,
        totalRounds: 3,
        roundPattern: ['day', 'night', 'day'],
      })

      expect(result.nextRound).toBe(2)
      expect(result.nextDayNight).toBe('night')
      expect(result.isGameOver).toBe(false)
    })

    it('returns game over when current round equals total rounds', () => {
      const result = tm.processEndOfRound({
        currentRound: 3,
        totalRounds: 3,
        roundPattern: ['day', 'night', 'day'],
      })

      expect(result.isGameOver).toBe(true)
      expect(result.nextRound).toBe(4)
    })

    it('computes correct day/night for round 2 of 3', () => {
      const result = tm.processEndOfRound({
        currentRound: 2,
        totalRounds: 3,
        roundPattern: ['day', 'night', 'day'],
      })

      expect(result.nextDayNight).toBe('day')
      expect(result.isGameOver).toBe(false)
    })
  })

  describe('First Recon specific', () => {
    it('has exactly 3 rounds with pattern [day, night, day]', () => {
      const pattern = tm.getRoundPattern(3)

      expect(pattern).toHaveLength(3)
      expect(pattern).toEqual(['day', 'night', 'day'])
    })

    it('tactics are removed after each round (used exactly once)', () => {
      const allTactics = makeDayTactics()

      const round1 = tm.startRound(1, 'day', allTactics)
      const { selected: dummyT, remaining: afterDummy } = tm.selectTacticForDummy(
        round1.availableTactics,
      )
      const { selected: playerT, remaining: afterPlayer } = tm.selectTacticForPlayer(
        afterDummy,
        afterDummy[0].id,
      )

      const updatedRound: RoundState = {
        ...round1,
        availableTactics: afterPlayer,
        dummyTactic: dummyT,
        playerTactic: playerT,
      }
      const endedRound = tm.endRound(updatedRound)

      expect(endedRound.availableTactics).toHaveLength(4)
      expect(endedRound.availableTactics.find((t) => t.id === dummyT.id)).toBeUndefined()
      expect(endedRound.availableTactics.find((t) => t.id === playerT.id)).toBeUndefined()
    })
  })

  describe('immutability', () => {
    it('startRound does not mutate the input tactics array', () => {
      const tactics = makeDayTactics()
      const originalLength = tactics.length

      const round = tm.startRound(1, 'day', tactics)
      round.availableTactics.push(makeTactic(99, 99))

      expect(tactics).toHaveLength(originalLength)
    })

    it('startTurn does not mutate the original turn state', () => {
      const turnState: TurnState = {
        ...INITIAL_TURN_STATE,
        turnNumber: 1,
        hasMovedThisTurn: true,
        cardsPlayedThisTurn: ['card_1'],
      }

      const result = tm.startTurn(turnState, 2)

      expect(turnState.turnNumber).toBe(1)
      expect(turnState.hasMovedThisTurn).toBe(true)
      expect(turnState.cardsPlayedThisTurn).toEqual(['card_1'])
      expect(result.turnNumber).toBe(2)
      expect(result.hasMovedThisTurn).toBe(false)
      expect(result.cardsPlayedThisTurn).toEqual([])
    })

    it('endRound does not mutate the original round state', () => {
      const tactics = makeDayTactics()
      const round: RoundState = {
        roundNumber: 1,
        dayNight: 'day',
        availableTactics: tactics,
        playerTactic: tactics[0],
        dummyTactic: tactics[1],
        turnOrder: 'dummy_first',
        isEnded: false,
      }

      const ended = tm.endRound(round)

      expect(round.isEnded).toBe(false)
      expect(round.availableTactics).toHaveLength(6)
      expect(ended.isEnded).toBe(true)
    })

    it('endTurn does not mutate the original turn state', () => {
      const turnState: TurnState = {
        ...INITIAL_TURN_STATE,
        endOfRoundDeclared: true,
      }

      tm.endTurn(turnState)

      expect(turnState.endOfRoundDeclared).toBe(true)
    })
  })
})
