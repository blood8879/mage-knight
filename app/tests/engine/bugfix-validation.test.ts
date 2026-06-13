// ═══════════════════════════════════════════
// Bug Fix Validation Tests — 2026-03-17
// Tests for 6 spec-compliance bugs found and fixed
// ═══════════════════════════════════════════

import { describe, test, expect } from 'vitest'
import { SeededRandom } from '@/utils/random'
import { ManaPool } from '@/engine/ManaPool'
import { CombatResolver } from '@/engine/CombatResolver'
import { TurnManager } from '@/engine/TurnManager'
import { UnitManager } from '@/engine/UnitManager'
import { SkillManager } from '@/engine/SkillManager'
import { ScoringCalculator } from '@/engine/ScoringCalculator'
import type { EnemyToken, TacticCard, UnitInstance, HeroSkill } from '@/engine/types'

function makeRandom(seed = 42) {
  return new SeededRandom(seed)
}

// ═══════════════════════════════════════════
// BUG 1: Tactic Selection Order (UNIT-04-B)
// Spec: Dummy picks first, then player from remaining
// ═══════════════════════════════════════════
describe('BUG-1: Tactic Selection Order', () => {
  const tactics: TacticCard[] = [
    { id: 1, name: 'Tactic A', type: 'day', number: 1, effect: '', isUsed: false },
    { id: 2, name: 'Tactic B', type: 'day', number: 2, effect: '', isUsed: false },
    { id: 3, name: 'Tactic C', type: 'day', number: 3, effect: '', isUsed: false },
  ]

  test('Dummy selects first, then player picks from remaining', () => {
    const tm = new TurnManager(makeRandom())

    // Dummy picks from all 3 tactics
    const dummyResult = tm.selectTacticForDummy(tactics)
    expect(tactics.map(t => t.id)).toContain(dummyResult.selected.id)
    expect(dummyResult.remaining.length).toBe(2)
    expect(dummyResult.remaining.find(t => t.id === dummyResult.selected.id)).toBeUndefined()

    // Player picks from remaining (after dummy removed one)
    const playerId = dummyResult.remaining[0].id
    const playerResult = tm.selectTacticForPlayer(dummyResult.remaining, playerId)
    expect(playerResult.selected.id).toBe(playerId)
    expect(playerResult.remaining.length).toBe(1)
  })

  test('Player cannot select the tactic dummy already took', () => {
    const tm = new TurnManager(makeRandom())
    const dummyResult = tm.selectTacticForDummy(tactics)
    const dummyId = dummyResult.selected.id

    // Remaining should not contain dummy's tactic
    expect(dummyResult.remaining.every(t => t.id !== dummyId)).toBe(true)

    // Attempting to select dummy's tactic from remaining should throw
    expect(() => tm.selectTacticForPlayer(dummyResult.remaining, dummyId)).toThrow()
  })
})

// ═══════════════════════════════════════════
// BUG 2: Units Ready at Round Start Only (UNIT-08-A)
// Spec: Units become Ready only at round start, NOT every turn
// ═══════════════════════════════════════════
describe('BUG-2: Units Ready Timing', () => {
  const um = new UnitManager()

  const makeUnit = (status: 'ready' | 'spent' | 'wounded', woundCount = 0): UnitInstance => ({
    unit: {
      id: 1, name: 'Test Unit', type: 'regular', tier: 'regular' as const,
      level: 1, cost: 3, armor: 3, recruitSites: ['village'],
      abilities: [], resistance: null, copies: 1, set: 'base' as const,
    },
    status,
    woundCount,
  })

  test('readyAllUnits converts spent to ready', () => {
    const units = [makeUnit('spent'), makeUnit('spent')]
    const result = um.readyAllUnits(units)
    expect(result.every(u => u.status === 'ready')).toBe(true)
  })

  test('readyAllUnits keeps wounded units wound count but sets status ready', () => {
    const units = [makeUnit('wounded', 1)]
    const result = um.readyAllUnits(units)
    expect(result[0].status).toBe('ready')
    expect(result[0].woundCount).toBe(1)
  })

  test('wounded-ready units still cannot be activated', () => {
    const units = [makeUnit('wounded', 1)]
    const readied = um.readyAllUnits(units)
    // status is ready but woundCount > 0 → not activatable
    expect(um.isUnitActivatable(readied[0])).toBe(false)
  })

  test('spent units should NOT automatically ready between turns (verified by design)', () => {
    // This test documents that readyAllUnits should only be called at round start
    // The endTurn handler now uses state.player.units directly (no readyAllUnits)
    const units = [makeUnit('spent')]
    // Without calling readyAllUnits, units stay spent
    expect(units[0].status).toBe('spent')
    expect(um.isUnitActivatable(units[0])).toBe(false)
  })
})

// ═══════════════════════════════════════════
// BUG 3: Skills Reset (UNIT-09-B)
// Spec: once_per_round resets at round start, once_per_turn resets at turn start
// ═══════════════════════════════════════════
describe('BUG-3: Skills Reset', () => {
  const sm = new SkillManager()

  const makeSkill = (type: HeroSkill['type'], used = true): HeroSkill => ({
    id: 1, name: 'Test Skill', type, effect: 'test',
    actions: [],
    isFlipped: type === 'once_per_round' ? used : false,
    isUsedThisTurn: type === 'once_per_turn' ? used : false,
  })

  test('resetSkillsForRound resets once_per_round skills', () => {
    const skills = [makeSkill('once_per_round', true)]
    expect(skills[0].isFlipped).toBe(true)

    const result = sm.resetSkillsForRound(skills)
    expect(result[0].isFlipped).toBe(false)
  })

  test('resetSkillsForRound does not affect once_per_turn skills', () => {
    const skills = [makeSkill('once_per_turn', true)]
    const result = sm.resetSkillsForRound(skills)
    expect(result[0].isUsedThisTurn).toBe(true) // unchanged
  })

  test('resetSkillsForTurn resets once_per_turn skills', () => {
    const skills = [makeSkill('once_per_turn', true)]
    expect(skills[0].isUsedThisTurn).toBe(true)

    const result = sm.resetSkillsForTurn(skills)
    expect(result[0].isUsedThisTurn).toBe(false)
  })

  test('resetSkillsForTurn does not affect once_per_round skills', () => {
    const skills = [makeSkill('once_per_round', true)]
    const result = sm.resetSkillsForTurn(skills)
    expect(result[0].isFlipped).toBe(true) // unchanged
  })

  test('skill activation respects usage limits', () => {
    const skill = makeSkill('once_per_round', false)
    expect(sm.canActivateSkill(skill)).toBe(true)

    const [activated] = sm.activateSkill([skill], 0, { isNewTurn: false })
    expect(activated.isFlipped).toBe(true)
    expect(sm.canActivateSkill(activated)).toBe(false)
  })
})

// ═══════════════════════════════════════════
// BUG 4: City Assault Reputation -1 (EC-07-F-5)
// Spec: City assault → Reputation -1 at combat start
// ═══════════════════════════════════════════
describe('BUG-4: City Assault Reputation', () => {
  const enemy: EnemyToken = {
    id: 100, name: 'Guardian', color: 'white', category: 'city',
    armor: 5, attack: 5, attackType: 'normal', abilities: [],
    fameReward: 5, copies: 1, set: 'base',
  }

  test('city assault sets reputationChange to -1', () => {
    const cr = new CombatResolver(makeRandom())
    const combat = cr.initiateCombat([enemy], true, 'white')
    expect(combat.reputationChange).toBe(-1)
  })

  test('non-city combat has reputationChange 0', () => {
    const cr = new CombatResolver(makeRandom())
    const combat = cr.initiateCombat([enemy], false)
    expect(combat.reputationChange).toBe(0)
  })

  test('keep/tower assault (no cityColor) has reputationChange 0', () => {
    const cr = new CombatResolver(makeRandom())
    const combat = cr.initiateCombat([enemy], true)
    expect(combat.reputationChange).toBe(0)
  })

  test('each city color applies -1 reputation', () => {
    const cr = new CombatResolver(makeRandom())
    for (const color of ['white', 'blue', 'red', 'green'] as const) {
      const combat = cr.initiateCombat([enemy], true, color)
      expect(combat.reputationChange).toBe(-1)
    }
  })
})

// ═══════════════════════════════════════════
// BUG 5: Dice Pool Retry Limit (EC-01-A-1)
// Spec: Max 10 retries, then force-convert gold/black to basic
// ═══════════════════════════════════════════
describe('BUG-5: Dice Pool Retry Limit', () => {
  test('dice pool always has at least ceil(n/2) basic colors', () => {
    // Test with multiple seeds to cover edge cases
    for (let seed = 0; seed < 50; seed++) {
      const mp = new ManaPool(new SeededRandom(seed))
      const state = mp.initializeSource(3)
      const basicCount = state.dice.filter(d =>
        ['red', 'blue', 'green', 'white'].includes(d.color),
      ).length
      expect(basicCount).toBeGreaterThanOrEqual(Math.ceil(3 / 2)) // >= 2
    }
  })

  test('force-convert ensures validity even with pathological seeds', () => {
    // With 3 dice, minBasic = 2. After forced conversion, gold/black → basic.
    for (let seed = 0; seed < 100; seed++) {
      const mp = new ManaPool(new SeededRandom(seed))
      const state = mp.initializeSource(3)
      const basicCount = state.dice.filter(d =>
        ['red', 'blue', 'green', 'white'].includes(d.color),
      ).length
      // Must always pass after force-convert
      expect(basicCount).toBeGreaterThanOrEqual(2)
    }
  })

  test('rerollSource also produces valid dice', () => {
    for (let seed = 0; seed < 50; seed++) {
      const mp = new ManaPool(new SeededRandom(seed))
      const initial = mp.initializeSource(3)
      const rerolled = mp.rerollSource(initial)
      const basicCount = rerolled.dice.filter(d =>
        ['red', 'blue', 'green', 'white'].includes(d.color),
      ).length
      expect(basicCount).toBeGreaterThanOrEqual(2)
    }
  })
})

// ═══════════════════════════════════════════
// BUG 6: Solo Conquest Scoring (UNIT-12-C)
// Spec: Uses specific scoring with cities, early finish, dummy cards, etc.
// ═══════════════════════════════════════════
describe('BUG-6: Solo Conquest Scoring', () => {
  const sc = new ScoringCalculator()

  test('calculateSoloConquestScore includes city points (10/city)', () => {
    const score = sc.calculateSoloConquestScore({
      playerName: 'Arythea',
      fame: 50,
      citiesConquered: 2,
      totalCities: 2,
      allCitiesConquered: true,
      roundsRemaining: 0,
      dummyRemainingCards: 0,
      didNotDeclareEndOfRound: false,
    })
    // 50 fame + 20 cities + 15 all cities = 85
    expect(score.totalScore).toBe(85)
  })

  test('calculateSoloConquestScore includes early finish bonus (30/round)', () => {
    const score = sc.calculateSoloConquestScore({
      playerName: 'Arythea',
      fame: 30,
      citiesConquered: 2,
      totalCities: 2,
      allCitiesConquered: true,
      roundsRemaining: 2,
      dummyRemainingCards: 0,
      didNotDeclareEndOfRound: false,
    })
    // 30 fame + 20 cities + 15 all cities + 60 early = 125
    expect(score.totalScore).toBe(125)
  })

  test('calculateSoloConquestScore includes dummy remaining cards (1/card)', () => {
    const score = sc.calculateSoloConquestScore({
      playerName: 'Arythea',
      fame: 40,
      citiesConquered: 0,
      totalCities: 2,
      allCitiesConquered: false,
      roundsRemaining: 0,
      dummyRemainingCards: 5,
      didNotDeclareEndOfRound: false,
    })
    // 40 fame + 5 dummy cards = 45
    expect(score.totalScore).toBe(45)
  })

  test('calculateSoloConquestScore includes endurance bonus (+5)', () => {
    const score = sc.calculateSoloConquestScore({
      playerName: 'Arythea',
      fame: 60,
      citiesConquered: 1,
      totalCities: 2,
      allCitiesConquered: false,
      roundsRemaining: 0,
      dummyRemainingCards: 0,
      didNotDeclareEndOfRound: true,
    })
    // 60 fame + 10 city + 5 endurance = 75
    expect(score.totalScore).toBe(75)
  })

  test('calculateSoloConquestScore full scenario', () => {
    const score = sc.calculateSoloConquestScore({
      playerName: 'Arythea',
      fame: 70,
      citiesConquered: 2,
      totalCities: 2,
      allCitiesConquered: true,
      roundsRemaining: 1,
      dummyRemainingCards: 8,
      didNotDeclareEndOfRound: true,
    })
    // 70 fame + 20 cities + 15 all cities + 30 early + 8 dummy + 5 endurance = 148
    expect(score.totalScore).toBe(148)
  })

  test('generic calculateFinalScore should NOT be used for solo conquest', () => {
    // Verify that generic scoring gives different (wrong) results
    const genericScore = sc.calculateFinalScore({
      playerName: 'Arythea',
      fame: 70,
      conqueredSites: [],
      advancedActionsInDeck: 0,
      spellsInDeck: 0,
      unitsOwned: 0,
      greatestKnowledge: true,
      greatestLeader: true,
      greatestConqueror: true,
      dummyRemainingCards: 8,
      totalRounds: 6,
      roundsPlayed: 5,
      didNotDeclareEndOfRound: true,
    })
    // Generic: 70 fame + 6 achievements = 76 (missing city points, early finish, etc.)
    expect(genericScore.totalScore).toBe(76)
    // Solo conquest should give much more
    expect(genericScore.totalScore).toBeLessThan(148)
  })
})
