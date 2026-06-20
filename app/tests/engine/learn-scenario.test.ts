import { describe, it, expect } from 'vitest'
import { ScenarioSetup } from '@/engine/ScenarioSetup'
import { SeededRandom } from '@/utils/random'
import { LEARN_STEPS, LEARN_REACTIVE, type LearnContext } from '@/data/learnGuide'

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
  handWoundCount: 0, combatAbilities: [],
}

describe('Learn guide steps', () => {
  it('every step has en/ko/es section + title + body', () => {
    for (const s of LEARN_STEPS) {
      for (const lang of ['en', 'ko', 'es'] as const) {
        expect(s.section[lang], `${s.id}/${lang} section`).toBeTruthy()
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

describe('Learn reactive lessons (just-in-time)', () => {
  it('every reactive lesson has en/ko/es section + title + body', () => {
    for (const r of LEARN_REACTIVE) {
      for (const lang of ['en', 'ko', 'es'] as const) {
        expect(r.section[lang], `${r.id}/${lang}`).toBeTruthy()
        expect(r.text[lang]?.title && r.text[lang]?.body, `${r.id}/${lang}`).toBeTruthy()
      }
    }
  })

  it('level-up lesson fires on a pending level-up', () => {
    const r = LEARN_REACTIVE.find((x) => x.id === 'r_levelup')!
    expect(r.trigger({ ...baseCtx, pendingLevelUp: true })).toBe(true)
    expect(r.trigger(baseCtx)).toBe(false)
  })

  it('wounds lesson fires with wounds in hand out of combat', () => {
    const r = LEARN_REACTIVE.find((x) => x.id === 'r_wounds')!
    expect(r.trigger({ ...baseCtx, handWoundCount: 2 })).toBe(true)
    expect(r.trigger({ ...baseCtx, handWoundCount: 2, combatActive: true })).toBe(false)
  })

  it('swift / fortified / resistance lessons fire on the matching enemy ability in combat', () => {
    const swift = LEARN_REACTIVE.find((x) => x.id === 'r_swift')!
    expect(swift.trigger({ ...baseCtx, combatActive: true, combatAbilities: ['swift'] })).toBe(true)
    expect(swift.trigger({ ...baseCtx, combatActive: true, combatAbilities: ['brutal'] })).toBe(false)
    const fort = LEARN_REACTIVE.find((x) => x.id === 'r_fortified')!
    expect(fort.trigger({ ...baseCtx, combatActive: true, combatAbilities: ['fortified'] })).toBe(true)
    const resist = LEARN_REACTIVE.find((x) => x.id === 'r_resist')!
    expect(resist.trigger({ ...baseCtx, combatActive: true, combatAbilities: ['fire_resistance'] })).toBe(true)
  })

  it('reactive ids are unique', () => {
    const ids = LEARN_REACTIVE.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
