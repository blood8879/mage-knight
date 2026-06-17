import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { CombatResolver } from '@/engine/CombatResolver'
import { SeededRandom } from '@/utils/random'
import { useCombatCards } from '@/hooks/useCombatCards'
import { getBasicActions, getSpells } from '@/data/loader'
import type { EnemyToken, AnyCard, CombatPhase } from '@/engine/types'

function spell(name: string): AnyCard {
  const c = getSpells().find((x) => x.name.startsWith(name))
  if (!c) throw new Error(name)
  return c
}

// Drive combat the way the UI does: cards → plays → AttackDeclaration → resolve.

function basic(name: string): AnyCard {
  const c = getBasicActions().commonCards.find((x) => x.name === name)
  if (!c) throw new Error(name)
  return c
}
function enemy(o: Partial<EnemyToken> = {}): EnemyToken {
  return { id: 1, name: 'E', color: 'green', category: 'marauding', armor: 4, attack: 3, attackType: 'normal', abilities: [], fameReward: 3, copies: 1, set: 'base', ...o }
}

function setup(phase: CombatPhase, hand: AnyCard[], enemyTok: EnemyToken, fortified = false) {
  const r = new CombatResolver(new SeededRandom(42))
  const combat = r.initiateCombat([enemyTok], fortified)
  const { result } = renderHook(() => useCombatCards(phase, hand, [], combat.enemies, [], 'day'))
  return { r, combat, hook: result }
}

describe('Combat card → declaration → resolution (real flow)', () => {
  it('Rage strong (Attack 4) defeats an Armor-4 enemy in melee', () => {
    const { r, combat, hook } = setup('attack', [basic('Rage')], enemy({ armor: 4 }))
    act(() => hook.current.setActiveTarget(combat.enemies[0].instanceId))
    act(() => hook.current.playCardForPhase(0, 'strong', { type: 'attack', value: 4 }))
    const decls = hook.current.buildAttackDeclarations()
    expect(decls).toHaveLength(1)
    expect(decls[0].attackValue).toBe(4)
    expect(decls[0].attackElement).toBe('physical')
    const out = r.resolveMeleeAttack({ ...combat, phase: 'attack' }, decls)
    expect(out.enemies[0].isDefeated).toBe(true)
  })

  it('Rage basic (Attack 2, choice) contributes 2 to the attack total', () => {
    const { combat, hook } = setup('attack', [basic('Rage')], enemy({ armor: 2 }))
    act(() => hook.current.setActiveTarget(combat.enemies[0].instanceId))
    act(() => hook.current.playCardForPhase(0, 'basic', { type: 'attack', value: 2, choice: true }))
    const decls = hook.current.buildAttackDeclarations()
    expect(decls[0].attackValue).toBe(2)
  })

  it('Swiftness strong (Ranged Attack 3) works in the ranged/siege phase', () => {
    const { r, combat, hook } = setup('ranged_siege', [basic('Swiftness')], enemy({ armor: 3 }))
    act(() => hook.current.setActiveTarget(combat.enemies[0].instanceId))
    act(() => hook.current.playCardForPhase(0, 'strong', { type: 'ranged_attack', value: 3 }))
    const decls = hook.current.buildAttackDeclarations()
    expect(decls[0].attackValue).toBe(3)
    const out = r.resolveRangedSiegeAttack(combat, decls)
    expect(out.enemies[0].isDefeated).toBe(true)
  })

  it('Determination strong (Block 5) builds a block of 5', () => {
    const { r, combat, hook } = setup('block', [basic('Determination')], enemy({ attack: 5 }))
    act(() => hook.current.setActiveTarget(combat.enemies[0].instanceId))
    act(() => hook.current.assignBlockToEnemy(combat.enemies[0].instanceId))
    act(() => hook.current.playCardForPhase(0, 'strong', { type: 'block', value: 5 }))
    const decls = hook.current.buildBlockDeclarations()
    expect(decls[0].blockValue).toBe(5)
    const out = r.resolveBlock(combat, decls)
    expect(out.enemies[0].isBlocked).toBe(true)
  })

  it('Flame Wave (strong): Fire Attack 5 +2 per enemy you face (2 enemies → 9)', () => {
    const r = new CombatResolver(new SeededRandom(42))
    const combat = r.initiateCombat([enemy({ armor: 9 }), enemy({ id: 2, armor: 3 })], false)
    const { result } = renderHook(() => useCombatCards('attack', [spell('Flame Wall')], [], combat.enemies, [], 'day'))
    act(() => result.current.setActiveTarget(combat.enemies[0].instanceId))
    act(() => result.current.playCardForPhase(0, 'strong', { type: 'fire_attack', value: 5 }))
    const decls = result.current.buildAttackDeclarations()
    expect(decls[0].attackValue).toBe(9) // 5 + 2×2
  })

  it('Cold Toughness (strong): Ice Block 5 +1 per ability/colour/resistance of the blocked enemy', () => {
    const ct = getBasicActions().heroSpecificCards.find((c) => c.name.startsWith('Cold Toughness'))
    if (!ct) return // hero card not present
    const r = new CombatResolver(new SeededRandom(42))
    // enemy with fire+ice resistance (2), swift (1 special), fire attack (coloured) → +4
    const combat = r.initiateCombat([enemy({ attack: 9, attackType: 'fire', abilities: ['fire_resistance', 'ice_resistance', 'swift'] })], false)
    const { result } = renderHook(() => useCombatCards('block', [ct], [], combat.enemies, [], 'day'))
    act(() => result.current.setActiveTarget(combat.enemies[0].instanceId))
    act(() => result.current.assignBlockToEnemy(combat.enemies[0].instanceId))
    act(() => result.current.playCardForPhase(0, 'strong', { type: 'ice_block', value: 5 }))
    const decls = result.current.buildBlockDeclarations()
    expect(decls[0].blockValue).toBe(9) // 5 + (2 resist + 1 swift + 1 coloured)
  })

  it('an element melee attack keeps its element (Ice Attack contributes as ice)', () => {
    const { combat, hook } = setup('attack', [basic('Rage')], enemy({ armor: 5 }))
    act(() => hook.current.setActiveTarget(combat.enemies[0].instanceId))
    act(() => hook.current.playCardForPhase(0, 'strong', { type: 'ice_attack', value: 5 }))
    const decls = hook.current.buildAttackDeclarations()
    expect(decls[0].attackElement).toBe('ice')
    expect(decls[0].attackValue).toBe(5)
  })
})
