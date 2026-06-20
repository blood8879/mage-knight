import { describe, it, expect } from 'vitest'
import { ScenarioSetup } from '@/engine/ScenarioSetup'
import { SeededRandom } from '@/utils/random'
import { LEARN_STEPS, type LearnContext } from '@/data/learnGuide'

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
  round: 1, phase: 'player_turn_start', turnCount: 1, combatActive: false, interactionActive: false,
  hasInteractableSite: false, hasEnemyNearby: false, pendingLevelUp: false,
  pendingReward: false, finalTurnPending: false, movePoints: 0,
  positionKey: '0,0', exploredTiles: 3, fame: 0, conqueredCount: 0,
}

describe('Learn guide steps', () => {
  it('every step has en/ko/es title + body', () => {
    for (const s of LEARN_STEPS) {
      for (const lang of ['en', 'ko', 'es'] as const) {
        expect(s.text[lang]?.title, `${s.id}/${lang} title`).toBeTruthy()
        expect(s.text[lang]?.body, `${s.id}/${lang} body`).toBeTruthy()
      }
    }
  })

  it('is an ordered sequence starting with welcome and ending terminal', () => {
    expect(LEARN_STEPS[0].id).toBe('welcome')
    expect(LEARN_STEPS[LEARN_STEPS.length - 1].kind).toBe('terminal')
  })

  it('action steps have a done() check; info/terminal do not advance automatically', () => {
    for (const s of LEARN_STEPS) {
      if (s.kind === 'action') expect(typeof s.done, s.id).toBe('function')
    }
  })

  it('get_move completes once Move points are available', () => {
    const s = LEARN_STEPS.find((x) => x.id === 'get_move')!
    expect(s.done!({ ...baseCtx, movePoints: 0 }, baseCtx)).toBe(false)
    expect(s.done!({ ...baseCtx, movePoints: 2 }, baseCtx)).toBe(true)
  })

  it('move_figure completes when the hero position changes', () => {
    const s = LEARN_STEPS.find((x) => x.id === 'move_figure')!
    expect(s.done!({ ...baseCtx, positionKey: '0,0' }, { ...baseCtx, positionKey: '0,0' })).toBe(false)
    expect(s.done!({ ...baseCtx, positionKey: '1,0' }, { ...baseCtx, positionKey: '0,0' })).toBe(true)
  })

  it('explore completes when a new tile is revealed', () => {
    const s = LEARN_STEPS.find((x) => x.id === 'explore')!
    expect(s.done!({ ...baseCtx, exploredTiles: 3 }, { ...baseCtx, exploredTiles: 3 })).toBe(false)
    expect(s.done!({ ...baseCtx, exploredTiles: 4 }, { ...baseCtx, exploredTiles: 3 })).toBe(true)
  })

  it('goal completes when a City is discovered (final turn pending)', () => {
    const s = LEARN_STEPS.find((x) => x.id === 'goal')!
    expect(s.done!(baseCtx, baseCtx)).toBe(false)
    expect(s.done!({ ...baseCtx, finalTurnPending: true }, baseCtx)).toBe(true)
  })

  it('step ids are unique', () => {
    const ids = LEARN_STEPS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
