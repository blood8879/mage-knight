/**
 * UNIT-02-F: Card Effect Accumulation Tests
 * Tests that same-type effects accumulate correctly and different types don't mix.
 */
import { describe, it, expect } from 'vitest'
import { CardEffectResolver, selectEffectActions, parseColorSpec } from '@/engine/CardEffectResolver'
import type { CardEffect } from '@/engine/types'

describe('parseColorSpec', () => {
  it('parses fixed, or-specs and any-specs', () => {
    expect(parseColorSpec('red')).toEqual(['red'])
    expect(parseColorSpec('red_or_black')).toEqual(['red', 'black'])
    expect(parseColorSpec('blue_white_or_red')).toEqual(['blue', 'white', 'red'])
    expect(parseColorSpec('any_basic')).toEqual(['red', 'blue', 'green', 'white'])
    expect(parseColorSpec('any_including_special')).toHaveLength(6)
  })
})

describe('selectEffectActions', () => {
  const tranquility: CardEffect = {
    text: 'Heal 1, or draw a card.',
    actions: [
      { type: 'heal', value: 1, choice: true },
      { type: 'draw_card', value: 1, choice: true },
    ],
  }

  it('keeps only the chosen picker action', () => {
    const picked = selectEffectActions(tranquility, 1)
    expect(picked.actions).toHaveLength(1)
    expect(picked.actions[0].type).toBe('draw_card')
  })

  it('drops all picker-choice actions when no pick given (never double-applies)', () => {
    const picked = selectEffectActions(tranquility)
    expect(picked.actions).toHaveLength(0)
  })

  it('leaves combat-type choices and non-choice actions untouched', () => {
    const intimidate: CardEffect = {
      text: 'Attack 3 or Influence 4. Reputation -1.',
      actions: [
        { type: 'attack', value: 3, choice: true },
        { type: 'influence', value: 4, choice: true },
        { type: 'reputation', value: -1 },
      ],
    }
    const picked = selectEffectActions(intimidate)
    expect(picked.actions).toHaveLength(3)
  })
})

function makeEffect(actions: Array<{ type: string; value?: number; element?: string }>): CardEffect {
  return { text: 'test', actions: actions.map((a) => ({ ...a })) }
}

describe('CardEffectResolver', () => {
  const resolver = new CardEffectResolver()

  describe('resolveEffect — single card', () => {
    it('resolves move action', () => {
      const effect = makeEffect([{ type: 'move', value: 2 }])
      const r = resolver.resolveEffect(effect, 'day')
      expect(r.movePointsDelta).toBe(2)
    })

    it('resolves attack action with element', () => {
      const effect = makeEffect([{ type: 'attack', value: 3, element: 'fire' }])
      const r = resolver.resolveEffect(effect, 'day')
      expect(r.attackValue).toBe(3)
      expect(r.attackElement).toBe('fire')
    })

    it('resolves block action', () => {
      const effect = makeEffect([{ type: 'block', value: 4, element: 'ice' }])
      const r = resolver.resolveEffect(effect, 'day')
      expect(r.blockValue).toBe(4)
      expect(r.blockElement).toBe('ice')
    })

    it('resolves influence action', () => {
      const effect = makeEffect([{ type: 'influence', value: 2 }])
      const r = resolver.resolveEffect(effect, 'day')
      expect(r.influenceValue).toBe(2)
    })

    it('resolves healing action', () => {
      const effect = makeEffect([{ type: 'healing', value: 3 }])
      const r = resolver.resolveEffect(effect, 'day')
      expect(r.healingValue).toBe(3)
    })

    it('resolves ranged_attack and siege_attack', () => {
      const effect = makeEffect([
        { type: 'ranged_attack', value: 2 },
        { type: 'siege_attack', value: 3 },
      ])
      const r = resolver.resolveEffect(effect, 'day')
      // EC-02-F-5: Ranged + Siege accumulate in same phase
      expect(r.attackValue).toBe(5)
    })

    it('collects unknown actions as unresolved', () => {
      const effect = makeEffect([
        { type: 'move', value: 1 },
        { type: 'special_draw', value: 2 },
      ])
      const r = resolver.resolveEffect(effect, 'day')
      expect(r.movePointsDelta).toBe(1)
      expect(r.unresolved).toHaveLength(1)
      expect(r.unresolved[0].type).toBe('special_draw')
    })

    it('defaults to physical element', () => {
      const effect = makeEffect([{ type: 'attack', value: 5 }])
      const r = resolver.resolveEffect(effect, 'day')
      expect(r.attackElement).toBe('physical')
    })

    it('resolves fixed-color gain_crystal (Crushing Bolt basic)', () => {
      const effect: CardEffect = { text: 'test', actions: [{ type: 'gain_crystal', color: 'green' }] }
      const r = resolver.resolveEffect(effect, 'day')
      expect(r.crystalsGained).toEqual(['green'])
      expect(r.unresolved).toHaveLength(0)
    })

    it('resolves multiple fixed-color gain_crystal (Explosive Bolt basic)', () => {
      const effect: CardEffect = {
        text: 'test',
        actions: [
          { type: 'gain_crystal', color: 'white' },
          { type: 'gain_crystal', color: 'red' },
        ],
      }
      const r = resolver.resolveEffect(effect, 'day')
      expect(r.crystalsGained).toEqual(['white', 'red'])
    })

    it('routes any_basic gain_crystal to openCrystalActions (needs color pick)', () => {
      const effect: CardEffect = {
        text: 'test',
        actions: [{ type: 'gain_crystal', color: 'any_basic' }],
      }
      const r = resolver.resolveEffect(effect, 'day')
      expect(r.crystalsGained).toHaveLength(0)
      expect(r.openCrystalActions).toHaveLength(1)
      expect(r.unresolved).toHaveLength(0)
    })

    it('resolves elemental attack/block aliases with element set', () => {
      const r = resolver.resolveEffect(
        makeEffect([
          { type: 'ice_block', value: 3 },
          { type: 'fire_attack', value: 2 },
        ]),
        'day',
      )
      expect(r.blockValue).toBe(3)
      expect(r.blockElement).toBe('ice')
      expect(r.attackValue).toBe(2)
      expect(r.attackElement).toBe('fire')
    })

    it('resolves reputation, take_wound and heal alias', () => {
      const r = resolver.resolveEffect(
        makeEffect([
          { type: 'reputation', value: -1 },
          { type: 'take_wound' },
          { type: 'heal', value: 2 },
        ]),
        'day',
      )
      expect(r.reputationDelta).toBe(-1)
      expect(r.woundsTaken).toBe(1)
      expect(r.healingValue).toBe(2)
    })
  })

  describe('accumulateResolutions — EC-02-F: multiple cards', () => {
    it('EC-02-F-1: Move effects accumulate', () => {
      const r1 = resolver.resolveEffect(makeEffect([{ type: 'move', value: 2 }]), 'day')
      const sideways = resolver.resolveSideways('move')
      const accumulated = resolver.accumulateResolutions([r1, sideways])
      expect(accumulated.movePointsDelta).toBe(3) // 2 + 1
    })

    it('EC-02-F-2: Attack values accumulate within one declaration', () => {
      const r1 = resolver.resolveEffect(makeEffect([{ type: 'attack', value: 3 }]), 'day')
      const r2 = resolver.resolveEffect(makeEffect([{ type: 'attack', value: 2 }]), 'day')
      const accumulated = resolver.accumulateResolutions([r1, r2])
      expect(accumulated.attackValue).toBe(5)
    })

    it('EC-02-F-5: Ranged + Siege accumulate for non-fortified targets', () => {
      const ranged = resolver.resolveEffect(makeEffect([{ type: 'ranged_attack', value: 3 }]), 'day')
      const siege = resolver.resolveEffect(makeEffect([{ type: 'siege_attack', value: 2 }]), 'day')
      const accumulated = resolver.accumulateResolutions([ranged, siege])
      expect(accumulated.attackValue).toBe(5)
    })

    it('influence accumulates from multiple sources', () => {
      const r1 = resolver.resolveEffect(makeEffect([{ type: 'influence', value: 3 }]), 'day')
      const r2 = resolver.resolveEffect(makeEffect([{ type: 'influence', value: 2 }]), 'day')
      const sideways = resolver.resolveSideways('influence')
      const accumulated = resolver.accumulateResolutions([r1, r2, sideways])
      expect(accumulated.influenceValue).toBe(6) // 3 + 2 + 1
    })

    it('block values accumulate for one enemy', () => {
      const r1 = resolver.resolveEffect(makeEffect([{ type: 'block', value: 2 }]), 'day')
      const r2 = resolver.resolveEffect(makeEffect([{ type: 'block', value: 3 }]), 'day')
      const accumulated = resolver.accumulateResolutions([r1, r2])
      expect(accumulated.blockValue).toBe(5)
    })

    it('healing values accumulate', () => {
      const r1 = resolver.resolveEffect(makeEffect([{ type: 'healing', value: 2 }]), 'day')
      const r2 = resolver.resolveEffect(makeEffect([{ type: 'healing', value: 1 }]), 'day')
      const accumulated = resolver.accumulateResolutions([r1, r2])
      expect(accumulated.healingValue).toBe(3)
    })

    it('element: last non-physical element wins', () => {
      const phys = resolver.resolveEffect(makeEffect([{ type: 'attack', value: 2 }]), 'day')
      const fire = resolver.resolveEffect(makeEffect([{ type: 'attack', value: 3, element: 'fire' }]), 'day')
      const accumulated = resolver.accumulateResolutions([phys, fire])
      expect(accumulated.attackValue).toBe(5)
      expect(accumulated.attackElement).toBe('fire')
    })

    it('unresolved actions are collected from all sources', () => {
      const r1 = resolver.resolveEffect(makeEffect([{ type: 'special', value: 1 }]), 'day')
      const r2 = resolver.resolveEffect(makeEffect([{ type: 'unknown_future_type', value: 2 }]), 'day')
      const accumulated = resolver.accumulateResolutions([r1, r2])
      expect(accumulated.unresolved).toHaveLength(2)
    })

    it('draw_card resolves to cardsToDraw and accumulates', () => {
      const r1 = resolver.resolveEffect(makeEffect([{ type: 'draw_card', value: 2 }]), 'day')
      const r2 = resolver.resolveEffect(makeEffect([{ type: 'draw_card', value: 1 }]), 'day')
      const accumulated = resolver.accumulateResolutions([r1, r2])
      expect(accumulated.cardsToDraw).toBe(3)
      expect(accumulated.unresolved).toHaveLength(0)
    })
  })

  describe('resolveSideways — EC-02-E', () => {
    it('move sideways = Move 1', () => {
      const r = resolver.resolveSideways('move')
      expect(r.movePointsDelta).toBe(1)
      expect(r.attackValue).toBe(0)
    })

    it('influence sideways = Influence 1', () => {
      const r = resolver.resolveSideways('influence')
      expect(r.influenceValue).toBe(1)
    })

    it('attack sideways = Physical Attack 1', () => {
      const r = resolver.resolveSideways('attack')
      expect(r.attackValue).toBe(1)
      expect(r.attackElement).toBe('physical')
    })

    it('block sideways = Physical Block 1', () => {
      const r = resolver.resolveSideways('block')
      expect(r.blockValue).toBe(1)
      expect(r.blockElement).toBe('physical')
    })
  })

  describe('applyToTurnState', () => {
    it('adds move points to turn state', () => {
      const turn = {
        turnNumber: 1, turnType: 'regular' as const,
        hasMovedThisTurn: false, hasActedThisTurn: false,
        cardsPlayedThisTurn: [], unitsActivatedThisTurn: [],
        sidewaysCardsPlayed: 0, movePointsAvailable: 3,
        movePointsSpent: 0, forcedCombat: false, endOfRoundDeclared: false,
      }
      const resolution = resolver.resolveEffect(makeEffect([{ type: 'move', value: 2 }]), 'day')
      const result = resolver.applyToTurnState(turn, resolution)
      expect(result.movePointsAvailable).toBe(5)
    })

    it('returns same state when no move points', () => {
      const turn = {
        turnNumber: 1, turnType: 'regular' as const,
        hasMovedThisTurn: false, hasActedThisTurn: false,
        cardsPlayedThisTurn: [], unitsActivatedThisTurn: [],
        sidewaysCardsPlayed: 0, movePointsAvailable: 3,
        movePointsSpent: 0, forcedCombat: false, endOfRoundDeclared: false,
      }
      const resolution = resolver.resolveEffect(makeEffect([{ type: 'attack', value: 5 }]), 'day')
      const result = resolver.applyToTurnState(turn, resolution)
      expect(result).toBe(turn) // same reference = no change
    })
  })
})
