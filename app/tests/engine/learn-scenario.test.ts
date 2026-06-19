import { describe, it, expect } from 'vitest'
import { ScenarioSetup } from '@/engine/ScenarioSetup'
import { SeededRandom } from '@/utils/random'
import { LEARN_TOPICS, type LearnContext } from '@/data/learnGuide'

/**
 * "Learn by Playing" uses the rulebook's First Reconnaissance scenario. These
 * assert the scenario config matches the rulebook (3 rounds Day–Night–Day, the
 * tile-reveal Fame rule, and end-on-city-discovery) and that the teaching guide
 * is well-formed.
 */
describe('First Reconnaissance (Learn) scenario config', () => {
  const cfg = new ScenarioSetup(new SeededRandom(1)).setupLearnScenario()

  it('runs three rounds Day → Night → Day', () => {
    expect(cfg.totalRounds).toBe(3)
    expect(cfg.roundPattern).toEqual(['day', 'night', 'day'])
  })

  it('places one City among the core tiles', () => {
    expect(cfg.mapConfig.coreCityCount).toBe(1)
  })

  it('carries the First Reconnaissance special rules', () => {
    expect(cfg.specialRules).toContain('fame_on_tile_reveal')
    expect(cfg.specialRules).toContain('end_on_city_discovery')
  })

  it('differs from the standard Solo Conquest game (6 rounds, no tile-reveal Fame)', () => {
    const solo = new ScenarioSetup(new SeededRandom(1)).setupFirstReconnaissance()
    expect(solo.totalRounds).toBe(6)
    expect(solo.specialRules).not.toContain('fame_on_tile_reveal')
  })
})

const baseCtx: LearnContext = {
  round: 1, phase: 'player_turn_start', combatActive: false, interactionActive: false,
  hasInteractableSite: false, hasEnemyNearby: false, pendingLevelUp: false,
  pendingReward: false, finalTurnPending: false, movePoints: 0,
}

describe('Learn guide topics', () => {
  it('every topic has en/ko/es title + body', () => {
    for (const t of LEARN_TOPICS) {
      for (const lang of ['en', 'ko', 'es'] as const) {
        expect(t.text[lang]?.title, `${t.id}/${lang} title`).toBeTruthy()
        expect(t.text[lang]?.body, `${t.id}/${lang} body`).toBeTruthy()
      }
    }
  })

  it('welcome fires for any context', () => {
    expect(LEARN_TOPICS.find((t) => t.id === 'welcome')!.trigger(baseCtx)).toBe(true)
  })

  it('combat_phases fires only in active combat', () => {
    const topic = LEARN_TOPICS.find((t) => t.id === 'combat_phases')!
    expect(topic.trigger(baseCtx)).toBe(false)
    expect(topic.trigger({ ...baseCtx, combatActive: true })).toBe(true)
  })

  it('rampaging fires when an enemy is nearby out of combat', () => {
    const topic = LEARN_TOPICS.find((t) => t.id === 'rampaging')!
    expect(topic.trigger({ ...baseCtx, hasEnemyNearby: true })).toBe(true)
    expect(topic.trigger({ ...baseCtx, hasEnemyNearby: true, combatActive: true })).toBe(false)
  })

  it('city_goal fires when the final turn is pending (city discovered)', () => {
    const topic = LEARN_TOPICS.find((t) => t.id === 'city_goal')!
    expect(topic.trigger({ ...baseCtx, finalTurnPending: true })).toBe(true)
    expect(topic.trigger(baseCtx)).toBe(false)
  })

  it('level_up fires on a pending level-up', () => {
    const topic = LEARN_TOPICS.find((t) => t.id === 'level_up')!
    expect(topic.trigger({ ...baseCtx, pendingLevelUp: true })).toBe(true)
  })

  it('topic ids are unique', () => {
    const ids = LEARN_TOPICS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
