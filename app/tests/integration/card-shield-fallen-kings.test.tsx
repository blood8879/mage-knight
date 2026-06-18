import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCombatCards } from '@/hooks/useCombatCards'
import { CombatResolver } from '@/engine/CombatResolver'
import { SeededRandom } from '@/utils/random'
import { getArtifacts } from '@/data/loader'
import type { AnyCard, EnemyToken } from '@/engine/types'

/**
 * Shield of the Fallen Kings (Artifact, id 21) — rulebook text:
 *  basic:  Block 6, or two Block 4 against different attacks.
 *  strong: Cold Fire Block 8, or up to three Cold Fire Block 4 against
 *          different attacks.
 *
 * The single-target Block (6 / Cold Fire 8) already works via the normal block
 * action. This covers the SPLIT clause: one card produces a Block against each
 * of several DIFFERENT enemies (playMultiBlock).
 */

function shield(): AnyCard {
  const c = getArtifacts().find((x) => x.name === 'Shield of the Fallen Kings')
  if (!c) throw new Error('Shield of the Fallen Kings missing')
  return c
}
function enemy(id: number, o: Partial<EnemyToken> = {}): EnemyToken {
  return { id, name: `E${id}`, color: 'green', category: 'marauding', armor: 4, attack: 4, attackType: 'normal', abilities: [], fameReward: 3, copies: 1, set: 'base', ...o }
}

describe('Shield of the Fallen Kings: split block across different enemies', () => {
  it('basic: two Block 4 against two different attacks', () => {
    const r = new CombatResolver(new SeededRandom(42))
    const combat = r.initiateCombat([enemy(1, { attack: 4 }), enemy(2, { attack: 4 })], false)
    const { result } = renderHook(() => useCombatCards('block', [shield()], [], combat.enemies, [], 'day'))
    const [e1, e2] = combat.enemies.map((e) => e.instanceId)
    act(() => result.current.playMultiBlock(0, 'basic', 4, 'physical', [e1, e2]))

    const decls = result.current.buildBlockDeclarations()
    expect(decls).toHaveLength(2)
    expect(decls.every((d) => d.blockValue === 4)).toBe(true)
    expect(decls.map((d) => d.enemyInstanceId).sort()).toEqual([e1, e2].sort())

    const resolved = r.resolveBlock(combat, decls)
    expect(resolved.enemies.filter((e) => e.isBlocked)).toHaveLength(2)
    // The card is consumed exactly once even though it produced two blocks.
    expect(result.current.usedCardIndices.has(0)).toBe(true)
  })

  it('strong: up to three Cold Fire Block 4 against different enemies', () => {
    const r = new CombatResolver(new SeededRandom(42))
    const combat = r.initiateCombat([enemy(1, { attack: 4 }), enemy(2, { attack: 4 }), enemy(3, { attack: 4 })], false)
    const { result } = renderHook(() => useCombatCards('block', [shield()], [], combat.enemies, [], 'day'))
    const ids = combat.enemies.map((e) => e.instanceId)
    act(() => result.current.playMultiBlock(0, 'strong', 4, 'cold_fire', ids))

    const decls = result.current.buildBlockDeclarations()
    expect(decls).toHaveLength(3)
    expect(decls.every((d) => d.blockValue === 4 && d.blockElement === 'cold_fire')).toBe(true)
  })

  it('duplicate targets are ignored (blocks must be against DIFFERENT attacks)', () => {
    const r = new CombatResolver(new SeededRandom(42))
    const combat = r.initiateCombat([enemy(1)], false)
    const { result } = renderHook(() => useCombatCards('block', [shield()], [], combat.enemies, [], 'day'))
    const id = combat.enemies[0].instanceId
    act(() => result.current.playMultiBlock(0, 'basic', 4, 'physical', [id, id]))
    const decls = result.current.buildBlockDeclarations()
    expect(decls).toHaveLength(1)
    expect(decls[0].blockValue).toBe(4) // not stacked to 8 — different attacks only
  })
})
