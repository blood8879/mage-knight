import { describe, it, expect } from 'vitest'
import { CombatResolver } from '@/engine/CombatResolver'
import { SeededRandom } from '@/utils/random'
import type { CombatState, EnemyToken, AttackDeclaration, BlockDeclaration } from '@/engine/types'

// ─────────────────────────────────────────────────────────────────────────────
// Combat math vs the rulebook (Combat with Enemies, pp.7-8 + Summary p.20).
// Asserts rulebook-correct outcomes, not the code's current behaviour.
// ─────────────────────────────────────────────────────────────────────────────

const cr = () => new CombatResolver(new SeededRandom(42))

function enemy(o: Partial<EnemyToken> = {}): EnemyToken {
  return {
    id: 1, name: 'E', color: 'green', category: 'marauding',
    armor: 4, attack: 3, attackType: 'normal', abilities: [],
    fameReward: 3, copies: 1, set: 'base', ...o,
  }
}

function attack(combat: CombatState, value: number, element: AttackDeclaration['attackElement'] = 'physical', isSiege = false): AttackDeclaration {
  return {
    id: 'a1', targetEnemyIds: [combat.enemies[0].instanceId],
    attackValue: value, attackElement: element, isSiege, isRanged: !isSiege,
    cardIds: [], unitIds: [],
  }
}
function block(combat: CombatState, value: number, element: BlockDeclaration['blockElement'] = 'physical'): BlockDeclaration {
  return { enemyInstanceId: combat.enemies[0].instanceId, blockValue: value, blockElement: element, isSuccessful: false }
}

describe('Ranged & Siege phase (rulebook p.7)', () => {
  it('defeats an enemy when total attack ≥ Armor', () => {
    const r = cr(); const c = r.initiateCombat([enemy({ armor: 4 })], false)
    const out = r.resolveRangedSiegeAttack(c, [attack(c, 4)])
    expect(out.enemies[0].isDefeated).toBe(true)
  })
  it('does NOT defeat when attack < Armor', () => {
    const r = cr(); const c = r.initiateCombat([enemy({ armor: 5 })], false)
    const out = r.resolveRangedSiegeAttack(c, [attack(c, 4)])
    expect(out.enemies[0].isDefeated).toBe(false)
  })
  it('a fortified-site enemy can only be hit by Siege in this phase', () => {
    const r = cr(); const c = r.initiateCombat([enemy({ armor: 4 })], true) // fortified site
    const ranged = r.resolveRangedSiegeAttack(c, [attack(c, 6, 'physical', false)])
    expect(ranged.enemies[0].isDefeated).toBe(false) // ranged can't touch fortified
    const r2 = cr(); const c2 = r2.initiateCombat([enemy({ armor: 4 })], true)
    const siege = r2.resolveRangedSiegeAttack(c2, [attack(c2, 4, 'physical', true)])
    expect(siege.enemies[0].isDefeated).toBe(true)
  })
  it('double-fortified (fortified ability + fortified site) is untargetable even by Siege', () => {
    const r = cr(); const c = r.initiateCombat([enemy({ armor: 4, abilities: ['fortified'] })], true)
    const out = r.resolveRangedSiegeAttack(c, [attack(c, 10, 'physical', true)])
    expect(out.enemies[0].isDefeated).toBe(false)
  })
  it('fire attack vs fire-resistant enemy is halved (inefficient)', () => {
    // armor 4, fire-resistant: a fire attack of 6 → effective 3 < 4 → not defeated
    const r = cr(); const c = r.initiateCombat([enemy({ armor: 4, abilities: ['fire_resistance'] })], false)
    const out = r.resolveRangedSiegeAttack(c, [attack(c, 6, 'fire')])
    expect(out.enemies[0].isDefeated).toBe(false)
    // a fire attack of 8 → effective 4 ≥ 4 → defeated
    const r2 = cr(); const c2 = r2.initiateCombat([enemy({ armor: 4, abilities: ['fire_resistance'] })], false)
    expect(r2.resolveRangedSiegeAttack(c2, [attack(c2, 8, 'fire')]).enemies[0].isDefeated).toBe(true)
  })
  it('cold-fire attack is halved only when the enemy resists BOTH fire and ice', () => {
    // only fire resist → cold fire NOT halved
    const r = cr(); const c = r.initiateCombat([enemy({ armor: 4, abilities: ['fire_resistance'] })], false)
    expect(r.resolveRangedSiegeAttack(c, [attack(c, 4, 'cold_fire')]).enemies[0].isDefeated).toBe(true)
    // both fire+ice resist → cold fire halved (4 → 2 < 4)
    const r2 = cr(); const c2 = r2.initiateCombat([enemy({ armor: 4, abilities: ['fire_resistance', 'ice_resistance'] })], false)
    expect(r2.resolveRangedSiegeAttack(c2, [attack(c2, 4, 'cold_fire')]).enemies[0].isDefeated).toBe(false)
  })
  it('awards Fame equal to the enemy fameReward on defeat', () => {
    const r = cr(); const c = r.initiateCombat([enemy({ armor: 3, fameReward: 5 })], false)
    const out = r.resolveRangedSiegeAttack(c, [attack(c, 3)])
    expect(out.fameEarned).toBe(5)
  })
})

describe('Block phase (rulebook p.7)', () => {
  it('blocks when block value ≥ attack value', () => {
    const r = cr(); const c = r.initiateCombat([enemy({ attack: 3 })], false)
    const out = r.resolveBlock(c, [block(c, 3)])
    expect(out.enemies[0].isBlocked).toBe(true)
  })
  it('does NOT block when block < attack', () => {
    const r = cr(); const c = r.initiateCombat([enemy({ attack: 4 })], false)
    expect(r.resolveBlock(c, [block(c, 3)]).enemies[0].isBlocked).toBe(false)
  })
  it('Swift enemies need DOUBLE block', () => {
    const r = cr(); const c = r.initiateCombat([enemy({ attack: 3, abilities: ['swift'] })], false)
    expect(r.resolveBlock(c, [block(c, 5)]).enemies[0].isBlocked).toBe(false) // 5 < 6
    const r2 = cr(); const c2 = r2.initiateCombat([enemy({ attack: 3, abilities: ['swift'] })], false)
    expect(r2.resolveBlock(c2, [block(c2, 6)]).enemies[0].isBlocked).toBe(true)
  })
  it('fire attack: only Ice/Cold-Fire blocks are efficient; physical block is halved', () => {
    // fire attack 4, physical block 6 → halved to 3 < 4 → not blocked
    const r = cr(); const c = r.initiateCombat([enemy({ attack: 4, attackType: 'fire' })], false)
    expect(r.resolveBlock(c, [block(c, 6, 'physical')]).enemies[0].isBlocked).toBe(false)
    // ice block 4 → efficient → blocked
    const r2 = cr(); const c2 = r2.initiateCombat([enemy({ attack: 4, attackType: 'fire' })], false)
    expect(r2.resolveBlock(c2, [block(c2, 4, 'ice')]).enemies[0].isBlocked).toBe(true)
  })
  it('ice attack: only Fire/Cold-Fire blocks are efficient', () => {
    const r = cr(); const c = r.initiateCombat([enemy({ attack: 4, attackType: 'ice' })], false)
    expect(r.resolveBlock(c, [block(c, 6, 'ice')]).enemies[0].isBlocked).toBe(false) // ice vs ice halved
    const r2 = cr(); const c2 = r2.initiateCombat([enemy({ attack: 4, attackType: 'ice' })], false)
    expect(r2.resolveBlock(c2, [block(c2, 4, 'fire')]).enemies[0].isBlocked).toBe(true)
  })
})

describe('Attack (melee) phase (rulebook p.8)', () => {
  it('defeats with melee attack ≥ Armor', () => {
    const r = cr(); let c = r.initiateCombat([enemy({ armor: 5 })], false)
    c = { ...c, phase: 'attack' }
    const out = r.resolveMeleeAttack(c, [attack(c, 5)])
    expect(out.enemies[0].isDefeated).toBe(true)
  })
  it('fortifications do NOT apply in the melee phase (fortified-site enemy hit by physical melee)', () => {
    const r = cr(); let c = r.initiateCombat([enemy({ armor: 4 })], true) // fortified site
    c = { ...c, phase: 'attack' }
    const out = r.resolveMeleeAttack(c, [attack(c, 4, 'physical', false)])
    expect(out.enemies[0].isDefeated).toBe(true)
  })
})

describe('Reputation on assault (rulebook p.7)', () => {
  it('assaulting a fortified site costs −1 Reputation even without a city colour', () => {
    const r = cr(); const c = r.initiateCombat([enemy()], true)
    expect(c.reputationChange).toBe(-1)
  })
  it('a non-fortified combat costs no Reputation', () => {
    const r = cr(); const c = r.initiateCombat([enemy()], false)
    expect(c.reputationChange).toBe(0)
  })
})
