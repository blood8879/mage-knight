import { describe, it, expect } from 'vitest'
import { CombatResolver } from '@/engine/CombatResolver'
import { SeededRandom } from '@/utils/random'
import { createHarness } from './card-play-harness'
import type { EnemyToken, UnitInstance, AnyUnit, DamageAssignment, GameState } from '@/engine/types'

function enemyTok(o: Partial<EnemyToken> = {}): EnemyToken {
  return { id: 1, name: 'E', color: 'green', category: 'marauding', armor: 4, attack: 4, attackType: 'normal', abilities: [], fameReward: 3, copies: 1, set: 'base', ...o }
}
function unit(name = 'Peasants', armor = 3): UnitInstance {
  const u = { id: 1, name, type: 'unit', tier: 'regular', level: 1, cost: 4, armor, recruitSites: ['village'], abilities: [], resistance: null, copies: 1, set: 'base' } as unknown as AnyUnit
  return { unit: u, status: 'ready', woundCount: 0 }
}

/** Build a post-block combat state ready for endCombat with the given assignments. */
function withCombat(h: ReturnType<typeof createHarness>, tok: EnemyToken, assignments: DamageAssignment[], units: UnitInstance[] = []) {
  const r = new CombatResolver(new SeededRandom(42))
  const combat = r.initiateCombat([tok], false)
  h.setState((s: GameState) => ({
    ...s,
    phase: 'assign_damage',
    player: { ...s.player, units, deck: { ...s.player.deck, hand: [], discardPile: [] } },
    combat: {
      ...combat,
      isActive: true,
      phase: 'assign_damage',
      enemies: combat.enemies.map((e) => ({ ...e, isBlocked: false })),
      damageAssignments: assignments,
    },
  }))
  return combat
}

const woundsInHand = (h: ReturnType<typeof createHarness>) =>
  h.state().player.deck.hand.filter((c) => c.type === 'wound').length

describe('Combat damage assignment (rulebook p.8)', () => {
  it('Hero: wounds = ceil(damage / Armor)', () => {
    // armor 2 (Tovak base), 6 damage → 3 wounds
    const h = createHarness('Tovak')
    const armor = h.state().player.armor
    const dmg = armor * 3
    const c = withCombat(h, enemyTok({ attack: dmg }), [
      { enemyInstanceId: 'x', totalDamage: dmg, assignments: [{ targetType: 'hero', damageAbsorbed: dmg, woundsInflicted: 3 }] },
    ])
    void c
    h.run((e) => e.endCombat())
    expect(woundsInHand(h)).toBe(3)
  })

  it('Unit: takes a single Wound (status wounded)', () => {
    const h = createHarness('Tovak')
    withCombat(h, enemyTok({ attack: 4 }), [
      { enemyInstanceId: 'x', totalDamage: 4, assignments: [{ targetType: 'unit', unitInstanceIndex: 0, damageAbsorbed: 4, woundsInflicted: 1 }] },
    ], [unit()])
    h.run((e) => e.endCombat())
    expect(h.state().player.units[0].status).toBe('wounded')
    expect(h.state().player.units[0].woundCount).toBe(1)
  })

  it('Paralyze + Unit: the Unit is DESTROYED (removed), not wounded', () => {
    const h = createHarness('Tovak')
    const combat = withCombat(h, enemyTok({ attack: 4, abilities: ['paralyze'] }), [], [unit()])
    // assignment must reference the real enemy instanceId for the paralyze lookup
    const eid = combat.enemies[0].instanceId
    h.setState((s) => ({
      ...s,
      combat: { ...s.combat, enemies: s.combat.enemies.map((e) => ({ ...e, appliedAbilities: ['paralyze'] })), damageAssignments: [
        { enemyInstanceId: eid, totalDamage: 4, assignments: [{ targetType: 'unit', unitInstanceIndex: 0, damageAbsorbed: 4, woundsInflicted: 1 }] },
      ] },
    }))
    h.run((e) => e.endCombat())
    expect(h.state().player.units.length).toBe(0) // destroyed
  })

  it('Paralyze + Hero: all non-Wound cards are discarded from hand', () => {
    const h = createHarness('Tovak')
    const combat = withCombat(h, enemyTok({ attack: 4, abilities: ['paralyze'] }), [])
    const eid = combat.enemies[0].instanceId
    h.setState((s) => ({
      ...s,
      player: { ...s.player, deck: { ...s.player.deck, hand: [
        { id: 99, name: 'X', type: 'basic_action', color: 'red', basicEffect: { text: '', actions: [] }, strongEffect: { text: '', actions: [] }, copies: 1, heroSpecific: null, replaces: null, set: 'base' } as never,
      ] } },
      combat: { ...s.combat, enemies: s.combat.enemies.map((e) => ({ ...e, appliedAbilities: ['paralyze'] })), damageAssignments: [
        { enemyInstanceId: eid, totalDamage: 4, assignments: [{ targetType: 'hero', damageAbsorbed: 4, woundsInflicted: 2 }] },
      ] },
    }))
    h.run((e) => e.endCombat())
    // the non-wound card was discarded; hand holds only the 2 wounds taken
    expect(h.state().player.deck.hand.every((c) => c.type === 'wound')).toBe(true)
  })
})
