import { describe, it, expect } from 'vitest'
import { soulHarvesterReward } from '@/hooks/useCombat'
import type { EnemyInstance } from '@/engine/types'
import type { CombatCardPlay } from '@/engine/combatCardTypes'

function e(id: string, defeated: boolean): EnemyInstance {
  return {
    token: { id: 1, name: 'E', color: 'green', category: 'marauding', armor: 3, attack: 3, attackType: 'normal', abilities: [], fameReward: 2, copies: 1, set: 'base' },
    instanceId: id, isDefeated: defeated, isBlocked: false, isFortified: false,
    currentArmor: 3, currentAttack: 3, currentAttackType: 'normal', appliedAbilities: [],
  }
}
function shPlay(effectType: 'basic' | 'strong'): CombatCardPlay {
  return { id: 'p1', sourceType: 'card', cardIndex: 0, cardId: 20, cardName: 'Soul Harvester', effectType, chosenAction: { type: 'attack', value: 3 }, value: 3, element: 'physical' }
}

describe('Soul Harvester crystal reward', () => {
  it('basic: one crystal when the attack defeats ≥1 enemy', () => {
    expect(soulHarvesterReward([e('a', false)], [e('a', true)], [shPlay('basic')])).toBe(1)
  })
  it('basic: still one crystal even if two are defeated', () => {
    expect(soulHarvesterReward([e('a', false), e('b', false)], [e('a', true), e('b', true)], [shPlay('basic')])).toBe(1)
  })
  it('strong: one crystal per enemy defeated this phase', () => {
    expect(soulHarvesterReward([e('a', false), e('b', false)], [e('a', true), e('b', true)], [shPlay('strong')])).toBe(2)
  })
  it('no crystal when nothing newly defeated', () => {
    expect(soulHarvesterReward([e('a', true)], [e('a', true)], [shPlay('strong')])).toBe(0)
  })
  it('no crystal without a Soul Harvester play', () => {
    expect(soulHarvesterReward([e('a', false)], [e('a', true)], [])).toBe(0)
  })
})
