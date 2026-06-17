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

import { chivalryReward } from '@/hooks/useCombat'

function chPlay(effectType: 'basic' | 'strong'): CombatCardPlay {
  return { id: 'p2', sourceType: 'card', cardIndex: 0, cardId: 35, cardName: 'Chivalry', effectType, chosenAction: { type: 'special', value: 0 }, value: effectType === 'strong' ? 4 : 2, element: 'physical' }
}

describe('Chivalry special variant reward', () => {
  it('basic: +1 Reputation per enemy defeated, no fame', () => {
    expect(chivalryReward([e('a', false), e('b', false)], [e('a', true), e('b', true)], [chPlay('basic')])).toEqual({ reputation: 2, fame: 0 })
  })
  it('strong: +1 Reputation and +1 Fame per enemy defeated', () => {
    expect(chivalryReward([e('a', false)], [e('a', true)], [chPlay('strong')])).toEqual({ reputation: 1, fame: 1 })
  })
  it('no reward without the special variant chosen', () => {
    const normal: CombatCardPlay = { id: 'p3', sourceType: 'card', cardIndex: 0, cardId: 35, cardName: 'Chivalry', effectType: 'basic', chosenAction: { type: 'attack', value: 3 }, value: 3, element: 'physical' }
    expect(chivalryReward([e('a', false)], [e('a', true)], [normal])).toEqual({ reputation: 0, fame: 0 })
  })
})

import { applyExpose } from '@/hooks/useCombat'

function fortifiedResistant(id: string): EnemyInstance {
  return { ...e(id, false), isFortified: true, appliedAbilities: ['fortified', 'fire_resistance', 'ice_resistance', 'swift'] }
}
function exposePlay(effectType: 'basic' | 'strong'): CombatCardPlay {
  return { id: 'px', sourceType: 'card', cardIndex: 0, cardId: 3, cardName: 'Expose', effectType, chosenAction: { type: 'ranged_attack', value: 2 }, value: 2, element: 'physical' }
}

describe('Expose / Mass Expose strips fortifications and resistances', () => {
  it('basic: strongest enemy loses fortified + resistances (keeps other abilities)', () => {
    const out = applyExpose([fortifiedResistant('a')], [exposePlay('basic')])
    expect(out[0].isFortified).toBe(false)
    expect(out[0].appliedAbilities).toEqual(['swift']) // resistances + fortified removed, swift kept
  })
  it('strong (Mass Expose): all enemies lose fortifications + resistances', () => {
    const out = applyExpose([fortifiedResistant('a'), fortifiedResistant('b')], [exposePlay('strong')])
    expect(out.every((x) => !x.isFortified && !x.appliedAbilities.some((ab) => ab.endsWith('_resistance')))).toBe(true)
  })
  it('no Expose play → enemies unchanged', () => {
    const inp = [fortifiedResistant('a')]
    expect(applyExpose(inp, [])).toBe(inp)
  })
})
