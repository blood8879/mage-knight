import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCombatCards } from '@/hooks/useCombatCards'
import { applyEnemyArmorReduction } from '@/hooks/useCombat'
import { CombatResolver } from '@/engine/CombatResolver'
import { SeededRandom } from '@/utils/random'
import { getHeroSkills } from '@/data/loader'
import type { EnemyToken, HeroSkill, CardAction } from '@/engine/types'
import type { CombatCardPlay } from '@/engine/combatCardTypes'

function skill(hero: string, id: number): HeroSkill {
  const s = getHeroSkills(hero).find((x) => x.id === id)!
  return { ...s, type: s.type as HeroSkill['type'], actions: s.actions as CardAction[], isFlipped: false, isUsedThisTurn: false }
}
function enemy(o: Partial<EnemyToken> = {}): EnemyToken {
  return { id: 1, name: 'E', color: 'green', category: 'marauding', armor: 4, attack: 3, attackType: 'normal', abilities: [], fameReward: 3, copies: 1, set: 'base', ...o }
}
function play(action: CardAction): CombatCardPlay {
  return { id: 'p', sourceType: 'skill', cardId: 305, cardName: 'Resistance Break', effectType: 'basic', chosenAction: action, value: 0, element: 'physical' }
}

describe('Resistance Break (enemy_armor_reduction, per resistance) — Tovak', () => {
  it('reduces Armor by 1 for each resistance the enemy has', () => {
    const r = new CombatResolver(new SeededRandom(42))
    // Enemy armor 6 with fire + ice resistance (2 resistances) → armor 4.
    const combat = r.initiateCombat([enemy({ armor: 6, abilities: ['fire_resistance', 'ice_resistance'] })], false)
    const action = skill('Tovak', 305).actions[0]
    const out = applyEnemyArmorReduction(combat.enemies, [play(action)])
    expect(out[0].currentArmor).toBe(4) // 6 − 2 resistances
  })

  it('floors armor at 1 and leaves a no-resistance enemy unchanged-ish (−0)', () => {
    const r = new CombatResolver(new SeededRandom(42))
    const combat = r.initiateCombat([enemy({ armor: 3, abilities: [] })], false)
    const action = skill('Tovak', 305).actions[0]
    const out = applyEnemyArmorReduction(combat.enemies, [play(action)])
    expect(out[0].currentArmor).toBe(3) // no resistances → −0
  })
})

describe('Cold Swordsmanship (attack skill) — Tovak', () => {
  it('contributes its Attack value to the melee declaration', () => {
    const r = new CombatResolver(new SeededRandom(42))
    const combat = r.initiateCombat([enemy({ armor: 4 })], false)
    const s = skill('Tovak', 303) // Cold Swordsmanship: Attack 3 (day) / 3
    const { result } = renderHook(() => useCombatCards('attack', [], [], combat.enemies, [s], 'night'))
    act(() => result.current.setActiveTarget(combat.enemies[0].instanceId))
    const avail = result.current.availableSkills.find((a) => a.skill.id === 303)
    expect(avail).toBeTruthy()
    const atk = avail!.actions.find((a) => a.type === 'attack')!
    act(() => result.current.activateSkillForCombat(avail!.index, atk))
    const decls = result.current.buildAttackDeclarations()
    expect(decls).toHaveLength(1)
    expect(decls[0].attackValue).toBe(2) // Cold Swordsmanship: Attack 2
  })
})
