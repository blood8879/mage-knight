import { describe, it, expect } from 'vitest'
import { applyBurningShield } from '@/hooks/useCombat'
import { CombatResolver } from '@/engine/CombatResolver'
import { SeededRandom } from '@/utils/random'
import type { BlockDeclaration, EnemyToken } from '@/engine/types'
import type { CombatCardPlay } from '@/engine/combatCardTypes'

/**
 * Burning Shield / Exploding Shield (Spell, id 9) — Fire Block 4 plus:
 *  basic:  if the Block is successful, you may use it as Fire Attack 4 in the
 *          Attack phase (against the blocked enemy).
 *  strong: if the Block is successful, destroy the blocked enemy.
 */
function enemy(o: Partial<EnemyToken> = {}): EnemyToken {
  return { id: 1, name: 'E', color: 'green', category: 'marauding', armor: 4, attack: 4, attackType: 'normal', abilities: [], fameReward: 3, copies: 1, set: 'base', ...o }
}
function block(enemyInstanceId: string, ok: boolean): BlockDeclaration {
  return { enemyInstanceId, blockValue: ok ? 4 : 0, blockElement: 'fire', cardIds: ['9'], unitIds: [], isSuccessful: ok }
}
function play(effectType: 'basic' | 'strong'): CombatCardPlay {
  return { id: 'p', sourceType: 'card', cardId: 9, cardName: 'Burning Shield', effectType, chosenAction: { type: 'fire_block', value: 4 }, value: 4, element: 'fire' }
}

describe('Burning Shield / Exploding Shield', () => {
  it('strong: a successful block destroys the blocked enemy', () => {
    const r = new CombatResolver(new SeededRandom(42))
    const combat = r.initiateCombat([enemy({ attack: 4 })], false)
    const id = combat.enemies[0].instanceId
    const resolved = { ...combat, blocks: [block(id, true)] }
    const out = applyBurningShield(resolved, [block(id, true)], [play('strong')])
    expect(out.enemies[0].isDefeated).toBe(true)
  })

  it('basic: a successful block marks the enemy for a free Fire Attack 4', () => {
    const r = new CombatResolver(new SeededRandom(42))
    const combat = r.initiateCombat([enemy({ attack: 4 })], false)
    const id = combat.enemies[0].instanceId
    const resolved = { ...combat, blocks: [block(id, true)] }
    const out = applyBurningShield(resolved, [block(id, true)], [play('basic')])
    expect(out.burningShieldTargets).toContain(id)
    expect(out.enemies[0].isDefeated).toBe(false) // not destroyed, just flagged
  })

  it('an UNsuccessful block grants nothing', () => {
    const r = new CombatResolver(new SeededRandom(42))
    const combat = r.initiateCombat([enemy({ attack: 9 })], false)
    const id = combat.enemies[0].instanceId
    const resolved = { ...combat, blocks: [block(id, false)] }
    const out = applyBurningShield(resolved, [block(id, false)], [play('strong')])
    expect(out.enemies[0].isDefeated).toBe(false)
    expect(out.burningShieldTargets ?? []).toHaveLength(0)
  })

  it('without a Burning Shield play, the combat is unchanged', () => {
    const r = new CombatResolver(new SeededRandom(42))
    const combat = r.initiateCombat([enemy()], false)
    const out = applyBurningShield(combat, [], [])
    expect(out).toBe(combat)
  })
})
