import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCombatCards } from '@/hooks/useCombatCards'
import { CombatResolver } from '@/engine/CombatResolver'
import { SeededRandom } from '@/utils/random'
import { getAdvancedActions } from '@/data/loader'
import type { AnyCard, EnemyToken } from '@/engine/types'

/**
 * Diplomacy (AA, id 19) — rulebook text:
 *  basic:  Influence 2. You may use Influence as Block this turn.
 *  strong: Influence 4. Choose Ice or Fire. You may use Influence as Block
 *          for the chosen element this turn.
 *
 * Influence is the primary effect (interaction). The combat clause lets the
 * card contribute its Influence value as Block in the block phase — basic =
 * Block 2 (physical), strong = elemental Block 4 (Ice or Fire chosen).
 */

function dip(): AnyCard {
  const c = getAdvancedActions().find((x) => x.name === 'Diplomacy')
  if (!c) throw new Error('Diplomacy missing')
  return c
}
function enemy(o: Partial<EnemyToken> = {}): EnemyToken {
  return { id: 1, name: 'E', color: 'green', category: 'marauding', armor: 4, attack: 2, attackType: 'normal', abilities: [], fameReward: 3, copies: 1, set: 'base', ...o }
}

describe('Diplomacy: Influence used as Block', () => {
  it('basic → Block 2 (physical), blocks an attack-2 enemy', () => {
    const r = new CombatResolver(new SeededRandom(42))
    const combat = r.initiateCombat([enemy({ attack: 2 })], false)
    const { result } = renderHook(() => useCombatCards('block', [dip()], [], combat.enemies, [], 'day'))
    act(() => result.current.setActiveTarget(combat.enemies[0].instanceId))
    act(() => result.current.assignBlockToEnemy(combat.enemies[0].instanceId))
    act(() => result.current.playCardForPhase(0, 'basic', { type: 'block', value: 2 }))
    const decls = result.current.buildBlockDeclarations()
    expect(decls[0].blockValue).toBe(2)
    expect(decls[0].blockElement).toBe('physical')
    expect(r.resolveBlock(combat, decls).enemies[0].isBlocked).toBe(true)
  })

  it('strong → Fire Block 4 carries the fire element', () => {
    const r = new CombatResolver(new SeededRandom(42))
    const combat = r.initiateCombat([enemy({ attack: 4 })], false)
    const { result } = renderHook(() => useCombatCards('block', [dip()], [], combat.enemies, [], 'day'))
    act(() => result.current.setActiveTarget(combat.enemies[0].instanceId))
    act(() => result.current.assignBlockToEnemy(combat.enemies[0].instanceId))
    act(() => result.current.playCardForPhase(0, 'strong', { type: 'fire_block', value: 4 }))
    const decls = result.current.buildBlockDeclarations()
    expect(decls[0].blockValue).toBe(4)
    expect(decls[0].blockElement).toBe('fire')
  })

  it('strong → Ice Block 4 carries the ice element', () => {
    const r = new CombatResolver(new SeededRandom(42))
    const combat = r.initiateCombat([enemy({ attack: 4 })], false)
    const { result } = renderHook(() => useCombatCards('block', [dip()], [], combat.enemies, [], 'day'))
    act(() => result.current.setActiveTarget(combat.enemies[0].instanceId))
    act(() => result.current.assignBlockToEnemy(combat.enemies[0].instanceId))
    act(() => result.current.playCardForPhase(0, 'strong', { type: 'ice_block', value: 4 }))
    const decls = result.current.buildBlockDeclarations()
    expect(decls[0].blockValue).toBe(4)
    expect(decls[0].blockElement).toBe('ice')
  })
})
