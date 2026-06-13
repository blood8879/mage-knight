import { describe, it, expect, beforeEach } from 'vitest'
import { CombatResolver } from '@/engine/CombatResolver'
import { SeededRandom } from '@/utils/random'
import type {
  EnemyToken,
  AttackDeclaration,
  BlockDeclaration,
  DamageAssignment,
  CombatState,
} from '@/engine/types'

function makeEnemy(overrides: Partial<EnemyToken> = {}): EnemyToken {
  return {
    id: 1,
    name: 'Test Enemy',
    color: 'green',
    category: 'marauding',
    armor: 4,
    attack: 3,
    attackType: 'normal',
    abilities: [],
    fameReward: 3,
    copies: 1,
    set: 'base',
    ...overrides,
  }
}

function makeAttack(overrides: Partial<AttackDeclaration> = {}): AttackDeclaration {
  return {
    id: 'atk_1',
    targetEnemyIds: [],
    attackValue: 5,
    attackElement: 'physical',
    isSiege: false,
    isRanged: true,
    cardIds: [],
    unitIds: [],
    ...overrides,
  }
}

function makeBlock(overrides: Partial<BlockDeclaration> = {}): BlockDeclaration {
  return {
    enemyInstanceId: '',
    blockValue: 5,
    blockElement: 'physical',
    cardIds: [],
    unitIds: [],
    isSuccessful: false,
    ...overrides,
  }
}

describe('Walkthrough: Combat System (Phase 5)', () => {
  let resolver: CombatResolver
  let random: SeededRandom

  beforeEach(() => {
    random = new SeededRandom(42)
    resolver = new CombatResolver(random)
  })

  // ── Combat Phase Sequence (2 tests) ────────────────────────

  describe('combat phase sequence', () => {
    it('combat starts at ranged_siege phase', () => {
      const enemies = [makeEnemy()]
      const combat = resolver.initiateCombat(enemies, false)

      expect(combat.phase).toBe('ranged_siege')
      expect(combat.isActive).toBe(true)
    })

    it('combat flows: ranged_siege → block → assign_damage → attack → combat_end', () => {
      const enemies = [makeEnemy({ attack: 3 })]
      let combat = resolver.initiateCombat(enemies, false)
      const enemyId = combat.enemies[0].instanceId

      expect(combat.phase).toBe('ranged_siege')

      combat = resolver.resolveRangedSiegeAttack(combat, [])
      expect(combat.phase).toBe('block')

      combat = resolver.resolveBlock(combat, [
        makeBlock({ enemyInstanceId: enemyId, blockValue: 3 }),
      ])
      expect(combat.phase).toBe('assign_damage')

      combat = resolver.assignDamage(combat, [])
      expect(combat.phase).toBe('attack')

      combat = resolver.resolveMeleeAttack(combat, [])
      expect(combat.phase).toBe('combat_end')
    })
  })

  // ── Ranged/Siege Phase — Walkthrough Scenarios (6 tests) ───

  describe('ranged/siege phase — walkthrough scenarios', () => {
    it('ranged attack defeats enemy when attack >= armor', () => {
      const enemy = makeEnemy({ armor: 4 })
      const combat = resolver.initiateCombat([enemy], false)
      const enemyId = combat.enemies[0].instanceId

      const result = resolver.resolveRangedSiegeAttack(combat, [
        makeAttack({ targetEnemyIds: [enemyId], attackValue: 4 }),
      ])

      expect(result.enemies[0].isDefeated).toBe(true)
    })

    it('ranged attack fails when attack < armor', () => {
      const enemy = makeEnemy({ armor: 5 })
      const combat = resolver.initiateCombat([enemy], false)
      const enemyId = combat.enemies[0].instanceId

      const result = resolver.resolveRangedSiegeAttack(combat, [
        makeAttack({ targetEnemyIds: [enemyId], attackValue: 4 }),
      ])

      expect(result.enemies[0].isDefeated).toBe(false)
    })

    it('siege attack works vs fortified enemy', () => {
      const enemy = makeEnemy({ armor: 4 })
      const combat = resolver.initiateCombat([enemy], true)
      const enemyId = combat.enemies[0].instanceId

      const result = resolver.resolveRangedSiegeAttack(combat, [
        makeAttack({
          targetEnemyIds: [enemyId],
          attackValue: 4,
          isSiege: true,
        }),
      ])

      expect(result.enemies[0].isDefeated).toBe(true)
    })

    it('ranged attack cannot hit fortified enemy', () => {
      const enemy = makeEnemy({ armor: 4 })
      const combat = resolver.initiateCombat([enemy], true)
      const enemyId = combat.enemies[0].instanceId

      const result = resolver.resolveRangedSiegeAttack(combat, [
        makeAttack({
          targetEnemyIds: [enemyId],
          attackValue: 10,
          isSiege: false,
          isRanged: true,
        }),
      ])

      expect(result.enemies[0].isDefeated).toBe(false)
    })

    it('fire attack bypasses physical resistance', () => {
      const enemy = makeEnemy({
        armor: 4,
        abilities: ['physical_resistance'],
      })
      const combat = resolver.initiateCombat([enemy], false)
      const enemyId = combat.enemies[0].instanceId

      const result = resolver.resolveRangedSiegeAttack(combat, [
        makeAttack({
          targetEnemyIds: [enemyId],
          attackValue: 4,
          attackElement: 'fire',
        }),
      ])

      expect(result.enemies[0].isDefeated).toBe(true)
    })

    it('physical attack is halved by physical resistance (floor)', () => {
      const enemy = makeEnemy({
        armor: 3,
        abilities: ['physical_resistance'],
      })
      const combat = resolver.initiateCombat([enemy], false)
      const enemyId = combat.enemies[0].instanceId

      const result = resolver.resolveRangedSiegeAttack(combat, [
        makeAttack({
          targetEnemyIds: [enemyId],
          attackValue: 5,
          attackElement: 'physical',
        }),
      ])

      // 5 / 2 = 2 (floor), < 3 armor → not defeated
      expect(result.enemies[0].isDefeated).toBe(false)
    })
  })

  // ── Block Phase — Walkthrough Scenarios (5 tests) ──────────

  describe('block phase — walkthrough scenarios', () => {
    it('successful block when block value >= enemy attack', () => {
      const enemy = makeEnemy({ attack: 3, attackType: 'normal' })
      const combat = resolver.initiateCombat([enemy], false)
      const blockCombat: CombatState = { ...combat, phase: 'block' as const }
      const enemyId = combat.enemies[0].instanceId

      const result = resolver.resolveBlock(blockCombat, [
        makeBlock({ enemyInstanceId: enemyId, blockValue: 3 }),
      ])

      expect(result.enemies[0].isBlocked).toBe(true)
    })

    it('failed block when value < attack', () => {
      const enemy = makeEnemy({ attack: 3, attackType: 'normal' })
      const combat = resolver.initiateCombat([enemy], false)
      const blockCombat: CombatState = { ...combat, phase: 'block' as const }
      const enemyId = combat.enemies[0].instanceId

      const result = resolver.resolveBlock(blockCombat, [
        makeBlock({ enemyInstanceId: enemyId, blockValue: 2 }),
      ])

      expect(result.enemies[0].isBlocked).toBe(false)
    })

    it('ice block is efficient vs fire attack', () => {
      const enemy = makeEnemy({ attack: 4, attackType: 'fire' })
      const combat = resolver.initiateCombat([enemy], false)
      const blockCombat: CombatState = { ...combat, phase: 'block' as const }
      const enemyId = combat.enemies[0].instanceId

      const result = resolver.resolveBlock(blockCombat, [
        makeBlock({
          enemyInstanceId: enemyId,
          blockValue: 4,
          blockElement: 'ice',
        }),
      ])

      expect(result.enemies[0].isBlocked).toBe(true)
    })

    it('physical block is halved vs fire attack', () => {
      const enemy = makeEnemy({ attack: 4, attackType: 'fire' })
      const combat = resolver.initiateCombat([enemy], false)
      const blockCombat: CombatState = { ...combat, phase: 'block' as const }
      const enemyId = combat.enemies[0].instanceId

      const result = resolver.resolveBlock(blockCombat, [
        makeBlock({
          enemyInstanceId: enemyId,
          blockValue: 7,
          blockElement: 'physical',
        }),
      ])

      // 7 / 2 = 3 (floor), < 4 → block fails
      expect(result.enemies[0].isBlocked).toBe(false)
    })

    it('swift enemy requires double block value', () => {
      const enemy = makeEnemy({
        attack: 3,
        attackType: 'normal',
        abilities: ['swift'],
      })
      const combat = resolver.initiateCombat([enemy], false)
      const blockCombat: CombatState = { ...combat, phase: 'block' as const }
      const enemyId = combat.enemies[0].instanceId

      // blockValue 5 < required 6 → fails
      const failResult = resolver.resolveBlock(blockCombat, [
        makeBlock({ enemyInstanceId: enemyId, blockValue: 5 }),
      ])
      expect(failResult.enemies[0].isBlocked).toBe(false)

      // blockValue 6 >= required 6 → succeeds
      const combat2 = resolver.initiateCombat([enemy], false)
      const blockCombat2: CombatState = { ...combat2, phase: 'block' as const }
      const enemyId2 = combat2.enemies[0].instanceId

      const successResult = resolver.resolveBlock(blockCombat2, [
        makeBlock({ enemyInstanceId: enemyId2, blockValue: 6 }),
      ])
      expect(successResult.enemies[0].isBlocked).toBe(true)
    })
  })

  // ── Damage Phase — Walkthrough Scenarios (4 tests) ─────────

  describe('damage phase — walkthrough scenarios', () => {
    it('unblocked enemy deals its attack value as damage', () => {
      const enemy = makeEnemy({ attack: 5 })
      const combat = resolver.initiateCombat([enemy], false)

      const damage = resolver.calculateUnblockedDamage(combat)

      expect(damage).toHaveLength(1)
      expect(damage[0].damage).toBe(5)
    })

    it('blocked enemy deals no damage', () => {
      const enemy = makeEnemy({ attack: 5 })
      const combat = resolver.initiateCombat([enemy], false)
      const blockedCombat: CombatState = {
        ...combat,
        enemies: combat.enemies.map((e) => ({ ...e, isBlocked: true })),
      }

      const damage = resolver.calculateUnblockedDamage(blockedCombat)

      expect(damage).toHaveLength(0)
    })

    it('brutal enemy doubles its damage', () => {
      const enemy = makeEnemy({ attack: 4, abilities: ['brutal'] })
      const combat = resolver.initiateCombat([enemy], false)

      const damage = resolver.calculateUnblockedDamage(combat)

      expect(damage[0].damage).toBe(8)
    })

    it('poison is flagged in damage info', () => {
      const enemy = makeEnemy({ attack: 3, abilities: ['poison'] })
      const combat = resolver.initiateCombat([enemy], false)

      const damage = resolver.calculateUnblockedDamage(combat)

      expect(damage[0].abilities).toContain('poison')
    })
  })

  // ── Melee Attack Phase — Walkthrough Scenarios (3 tests) ───

  describe('melee attack phase — walkthrough scenarios', () => {
    it('melee attack defeats enemy when attack >= armor', () => {
      const enemy = makeEnemy({ armor: 4 })
      const combat = resolver.initiateCombat([enemy], false)
      const meleeCombat: CombatState = { ...combat, phase: 'attack' as const }
      const enemyId = combat.enemies[0].instanceId

      const result = resolver.resolveMeleeAttack(meleeCombat, [
        makeAttack({
          targetEnemyIds: [enemyId],
          attackValue: 4,
          isRanged: false,
        }),
      ])

      expect(result.enemies[0].isDefeated).toBe(true)
    })

    it('melee ignores fortification', () => {
      const enemy = makeEnemy({ armor: 3 })
      const combat = resolver.initiateCombat([enemy], true)
      const meleeCombat: CombatState = { ...combat, phase: 'attack' as const }
      const enemyId = combat.enemies[0].instanceId

      expect(combat.enemies[0].isFortified).toBe(true)

      const result = resolver.resolveMeleeAttack(meleeCombat, [
        makeAttack({
          targetEnemyIds: [enemyId],
          attackValue: 3,
          isRanged: false,
        }),
      ])

      expect(result.enemies[0].isDefeated).toBe(true)
    })

    it('defeating enemy awards fame', () => {
      const enemy = makeEnemy({ armor: 3, fameReward: 5 })
      const combat = resolver.initiateCombat([enemy], false)
      const meleeCombat: CombatState = { ...combat, phase: 'attack' as const }
      const enemyId = combat.enemies[0].instanceId

      const result = resolver.resolveMeleeAttack(meleeCombat, [
        makeAttack({
          targetEnemyIds: [enemyId],
          attackValue: 3,
          isRanged: false,
        }),
      ])

      expect(result.fameEarned).toBe(5)
    })
  })

  // ── Combat Completion (3 tests) ────────────────────────────

  describe('combat completion', () => {
    it('endCombat sets isActive to false', () => {
      const enemy = makeEnemy({ armor: 3 })
      const combat = resolver.initiateCombat([enemy], false)
      const endPhaseCombat: CombatState = {
        ...combat,
        phase: 'combat_end' as const,
      }

      const result = resolver.endCombat(endPhaseCombat)

      expect(result.isActive).toBe(false)
    })

    it('total fame sums all defeated enemies', () => {
      const enemies = [
        makeEnemy({ id: 1, armor: 2, fameReward: 3 }),
        makeEnemy({ id: 2, armor: 2, fameReward: 5 }),
      ]
      const combat = resolver.initiateCombat(enemies, false)
      const defeatCombat: CombatState = {
        ...combat,
        enemies: combat.enemies.map((e) => ({ ...e, isDefeated: true })),
      }

      const result = resolver.endCombat(defeatCombat)

      expect(result.fameEarned).toBe(8)
    })

    it('reputation_minus_1 enemy applies rep change', () => {
      const enemy = makeEnemy({ abilities: ['reputation_minus_1'] })
      const combat = resolver.initiateCombat([enemy], false)
      const defeatCombat: CombatState = {
        ...combat,
        enemies: combat.enemies.map((e) => ({ ...e, isDefeated: true })),
      }

      const result = resolver.endCombat(defeatCombat)

      expect(result.reputationChange).toBe(-1)
    })
  })

  // ── Full Combat Walkthrough (1 test) ───────────────────────

  describe('full combat walkthrough', () => {
    it('completes a full 4-phase scenario: ranged kill one, block other, melee finish', () => {
      // Two enemies: one weak (armor 3, fame 2), one strong (armor 6, fame 4)
      const weakEnemy = makeEnemy({ id: 1, armor: 3, attack: 2, fameReward: 2 })
      const strongEnemy = makeEnemy({ id: 2, armor: 6, attack: 4, fameReward: 4 })

      // Phase 1: Ranged — kill the weak enemy
      let combat = resolver.initiateCombat([weakEnemy, strongEnemy], false)
      const weakId = combat.enemies[0].instanceId
      const strongId = combat.enemies[1].instanceId

      expect(combat.phase).toBe('ranged_siege')

      combat = resolver.resolveRangedSiegeAttack(combat, [
        makeAttack({
          targetEnemyIds: [weakId],
          attackValue: 3,
        }),
      ])
      expect(combat.phase).toBe('block')
      expect(combat.enemies[0].isDefeated).toBe(true)
      expect(combat.enemies[1].isDefeated).toBe(false)

      // Phase 2: Block the strong enemy
      combat = resolver.resolveBlock(combat, [
        makeBlock({
          enemyInstanceId: strongId,
          blockValue: 4,
          blockElement: 'physical',
        }),
      ])
      expect(combat.phase).toBe('assign_damage')
      expect(combat.enemies[1].isBlocked).toBe(true)

      // Phase 3: No unblocked damage (strong is blocked, weak is defeated)
      const unblockedDamage = resolver.calculateUnblockedDamage(combat)
      expect(unblockedDamage).toHaveLength(0)

      combat = resolver.assignDamage(combat, [])
      expect(combat.phase).toBe('attack')

      // Phase 4: Melee — kill the strong enemy
      combat = resolver.resolveMeleeAttack(combat, [
        makeAttack({
          targetEnemyIds: [strongId],
          attackValue: 6,
          isRanged: false,
        }),
      ])
      expect(combat.phase).toBe('combat_end')
      expect(combat.enemies[1].isDefeated).toBe(true)

      // End combat: total fame = 2 + 4 = 6
      combat = resolver.endCombat(combat)
      expect(combat.isActive).toBe(false)
      expect(combat.fameEarned).toBe(6)
    })
  })
})
