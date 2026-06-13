import { describe, it, expect } from 'vitest'
import { ScoringCalculator } from '@/engine/ScoringCalculator'
import type { ScoringContext } from '@/engine/ScoringCalculator'
import { TurnManager } from '@/engine/TurnManager'
import { SeededRandom } from '@/utils/random'
import type { PhaseContext } from '@/engine/TurnManager'

function makeScoring(overrides: Partial<ScoringContext> = {}): ScoringContext {
  return {
    playerName: 'Player 1',
    fame: 20,
    conqueredSites: [],
    advancedActionsInDeck: 2,
    spellsInDeck: 1,
    unitsOwned: 2,
    greatestKnowledge: false,
    greatestLeader: false,
    greatestConqueror: false,
    dummyRemainingCards: 5,
    totalRounds: 3,
    roundsPlayed: 3,
    didNotDeclareEndOfRound: false,
    ...overrides,
  }
}

describe('Walkthrough: Endgame & Scoring (Phase 12)', () => {
  const calc = new ScoringCalculator()

  describe('game over trigger', () => {
    it('game phase transitions to game_over after final round', () => {
      const tm = new TurnManager(new SeededRandom(42))
      const ctx: PhaseContext = { gameEnding: true }
      expect(tm.advancePhase('end_of_round', ctx)).toBe('game_over')
    })

    it('game_over phase stays at game_over', () => {
      const tm = new TurnManager(new SeededRandom(42))
      expect(tm.advancePhase('game_over', {})).toBe('game_over')
    })
  })

  describe('scoring', () => {
    it('base score equals fame', () => {
      const score = calc.calculateFinalScore(makeScoring({ fame: 25 }))
      expect(score.baseFame).toBe(25)
    })

    it('greatest knowledge adds 2 points', () => {
      const score = calc.calculateFinalScore(makeScoring({ fame: 20, greatestKnowledge: true }))
      expect(score.achievements.find(a => a.category === 'Greatest Knowledge')).toBeDefined()
      expect(score.totalScore).toBe(22)
    })

    it('greatest leader adds 2 points', () => {
      const score = calc.calculateFinalScore(makeScoring({ fame: 20, greatestLeader: true }))
      expect(score.totalScore).toBe(22)
    })

    it('greatest conqueror adds 2 points', () => {
      const score = calc.calculateFinalScore(makeScoring({ fame: 20, greatestConqueror: true }))
      expect(score.totalScore).toBe(22)
    })

    it('all three titles stack to +6', () => {
      const score = calc.calculateFinalScore(makeScoring({
        fame: 20, greatestKnowledge: true, greatestLeader: true, greatestConqueror: true,
      }))
      expect(score.totalScore).toBe(26)
      expect(score.achievements).toHaveLength(3)
    })
  })

  describe('score rating', () => {
    it('score 0-19 is Rookie', () => {
      expect(calc.getScoreRating(15)).toBe('Rookie')
    })

    it('score 100-119 is Champion', () => {
      expect(calc.getScoreRating(110)).toBe('Champion')
    })

    it('score 120+ is Legend', () => {
      expect(calc.getScoreRating(150)).toBe('Legend')
    })
  })
})
