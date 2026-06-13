import { describe, it, expect, beforeEach } from 'vitest'
import { CombatResolver } from '@/engine/CombatResolver'
import { SeededRandom } from '@/utils/random'
import type {
  EnemyToken,
  EnemyInstance,
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

describe('CombatResolver', () => {
  let resolver: CombatResolver
  let random: SeededRandom

  beforeEach(() => {
    random = new SeededRandom(42)
    resolver = new CombatResolver(random)
  })

  describe('initiateCombat', () => {
    it('creates enemy instances from tokens', () => {
      const enemies = [makeEnemy({ id: 1 }), makeEnemy({ id: 2, name: 'Enemy 2' })]
      const combat = resolver.initiateCombat(enemies, false)

      expect(combat.isActive).toBe(true)
      expect(combat.phase).toBe('ranged_siege')
      expect(combat.enemies).toHaveLength(2)
      expect(combat.enemies[0].isDefeated).toBe(false)
      expect(combat.enemies[0].isBlocked).toBe(false)
    })

    it('applies fortification from site to all enemies', () => {
      const enemies = [makeEnemy()]
      const combat = resolver.initiateCombat(enemies, true)

      expect(combat.enemies[0].isFortified).toBe(true)
      expect(combat.enemies[0].appliedAbilities).toContain('fortified')
      expect(combat.isFortifiedSite).toBe(true)
    })

    it('applies white city bonus (+1 armor)', () => {
      const enemies = [makeEnemy({ armor: 4 })]
      const combat = resolver.initiateCombat(enemies, false, 'white')

      expect(combat.enemies[0].currentArmor).toBe(5)
    })

    it('applies blue city bonus (+2 attack for fire/ice attackers)', () => {
      const fireEnemy = makeEnemy({ attack: 3, attackType: 'fire' })
      const iceEnemy = makeEnemy({ id: 2, attack: 3, attackType: 'ice' })
      const coldFireEnemy = makeEnemy({ id: 3, attack: 3, attackType: 'cold_fire' })
      const normalEnemy = makeEnemy({ id: 4, attack: 3, attackType: 'normal' })

      const combat = resolver.initiateCombat(
        [fireEnemy, iceEnemy, coldFireEnemy, normalEnemy],
        false,
        'blue',
      )

      expect(combat.enemies[0].currentAttack).toBe(5) // fire +2
      expect(combat.enemies[1].currentAttack).toBe(5) // ice +2
      expect(combat.enemies[2].currentAttack).toBe(4) // cold_fire +1
      expect(combat.enemies[3].currentAttack).toBe(3) // normal unchanged
    })

    it('applies red city bonus (brutal to physical attackers)', () => {
      const enemy = makeEnemy({ attackType: 'normal' })
      const combat = resolver.initiateCombat([enemy], false, 'red')

      expect(combat.enemies[0].appliedAbilities).toContain('brutal')
    })

    it('applies green city bonus (poison to physical attackers)', () => {
      const enemy = makeEnemy({ attackType: 'normal' })
      const combat = resolver.initiateCombat([enemy], false, 'green')

      expect(combat.enemies[0].appliedAbilities).toContain('poison')
    })

    it('does not duplicate abilities from city bonus', () => {
      const enemy = makeEnemy({ abilities: ['brutal'] })
      const combat = resolver.initiateCombat([enemy], false, 'red')

      const brutalCount = combat.enemies[0].appliedAbilities.filter(
        (a) => a === 'brutal',
      ).length
      expect(brutalCount).toBe(1)
    })
  })

  describe('resolveRangedSiegeAttack', () => {
    it('defeats enemy when attack >= armor', () => {
      const combat = resolver.initiateCombat([makeEnemy({ armor: 4 })], false)
      const enemyId = combat.enemies[0].instanceId

      const result = resolver.resolveRangedSiegeAttack(combat, [
        makeAttack({ targetEnemyIds: [enemyId], attackValue: 4 }),
      ])

      expect(result.enemies[0].isDefeated).toBe(true)
      expect(result.fameEarned).toBe(3)
      expect(result.phase).toBe('block')
    })

    it('does not defeat enemy when attack < armor', () => {
      const combat = resolver.initiateCombat([makeEnemy({ armor: 5 })], false)
      const enemyId = combat.enemies[0].instanceId

      const result = resolver.resolveRangedSiegeAttack(combat, [
        makeAttack({ targetEnemyIds: [enemyId], attackValue: 4 }),
      ])

      expect(result.enemies[0].isDefeated).toBe(false)
      expect(result.fameEarned).toBe(0)
    })

    it('siege attack works vs fortified enemy', () => {
      const combat = resolver.initiateCombat([makeEnemy({ armor: 4 })], true)
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

    it('ranged attack fails vs fortified enemy', () => {
      const combat = resolver.initiateCombat([makeEnemy({ armor: 4 })], true)
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

    it('double fortified blocks all ranged/siege', () => {
      const enemy = makeEnemy({ armor: 3, abilities: ['fortified'] })
      const combat = resolver.initiateCombat([enemy], true)
      const enemyId = combat.enemies[0].instanceId

      const result = resolver.resolveRangedSiegeAttack(combat, [
        makeAttack({
          targetEnemyIds: [enemyId],
          attackValue: 20,
          isSiege: true,
        }),
      ])

      expect(result.enemies[0].isDefeated).toBe(false)
    })

    it('applies physical resistance (halves physical attack)', () => {
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

    it('applies fire resistance (halves fire attack)', () => {
      const enemy = makeEnemy({
        armor: 3,
        abilities: ['fire_resistance'],
      })
      const combat = resolver.initiateCombat([enemy], false)
      const enemyId = combat.enemies[0].instanceId

      const result = resolver.resolveRangedSiegeAttack(combat, [
        makeAttack({
          targetEnemyIds: [enemyId],
          attackValue: 5,
          attackElement: 'fire',
        }),
      ])

      // 5 / 2 = 2 (floor), < 3 armor → not defeated
      expect(result.enemies[0].isDefeated).toBe(false)
    })

    it('applies ice resistance (halves ice attack)', () => {
      const enemy = makeEnemy({
        armor: 3,
        abilities: ['ice_resistance'],
      })
      const combat = resolver.initiateCombat([enemy], false)
      const enemyId = combat.enemies[0].instanceId

      const result = resolver.resolveRangedSiegeAttack(combat, [
        makeAttack({
          targetEnemyIds: [enemyId],
          attackValue: 5,
          attackElement: 'ice',
        }),
      ])

      expect(result.enemies[0].isDefeated).toBe(false)
    })

    it('applies fire+ice resistance to cold_fire attack', () => {
      const enemy = makeEnemy({
        armor: 3,
        abilities: ['fire_resistance', 'ice_resistance'],
      })
      const combat = resolver.initiateCombat([enemy], false)
      const enemyId = combat.enemies[0].instanceId

      const result = resolver.resolveRangedSiegeAttack(combat, [
        makeAttack({
          targetEnemyIds: [enemyId],
          attackValue: 5,
          attackElement: 'cold_fire',
        }),
      ])

      // 5 / 2 = 2 (floor), < 3 armor → not defeated
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

    it('advances phase to block', () => {
      const combat = resolver.initiateCombat([makeEnemy()], false)

      const result = resolver.resolveRangedSiegeAttack(combat, [])

      expect(result.phase).toBe('block')
    })
  })

  describe('resolveBlock', () => {
    it('successfully blocks normal attack', () => {
      const combat = resolver.initiateCombat(
        [makeEnemy({ attack: 3, attackType: 'normal' })],
        false,
      )
      const blockCombat = { ...combat, phase: 'block' as const }
      const enemyId = combat.enemies[0].instanceId

      const result = resolver.resolveBlock(blockCombat, [
        makeBlock({ enemyInstanceId: enemyId, blockValue: 3 }),
      ])

      expect(result.enemies[0].isBlocked).toBe(true)
      expect(result.blocks[0].isSuccessful).toBe(true)
    })

    it('fails block when value is insufficient', () => {
      const combat = resolver.initiateCombat(
        [makeEnemy({ attack: 5, attackType: 'normal' })],
        false,
      )
      const blockCombat = { ...combat, phase: 'block' as const }
      const enemyId = combat.enemies[0].instanceId

      const result = resolver.resolveBlock(blockCombat, [
        makeBlock({ enemyInstanceId: enemyId, blockValue: 4 }),
      ])

      expect(result.enemies[0].isBlocked).toBe(false)
      expect(result.blocks[0].isSuccessful).toBe(false)
    })

    it('ice block is efficient vs fire attack', () => {
      const enemy = makeEnemy({ attack: 4, attackType: 'fire' })
      const combat = resolver.initiateCombat([enemy], false)
      const blockCombat = { ...combat, phase: 'block' as const }
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
      const blockCombat = { ...combat, phase: 'block' as const }
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

    it('cold_fire block is efficient vs fire attack', () => {
      const enemy = makeEnemy({ attack: 4, attackType: 'fire' })
      const combat = resolver.initiateCombat([enemy], false)
      const blockCombat = { ...combat, phase: 'block' as const }
      const enemyId = combat.enemies[0].instanceId

      const result = resolver.resolveBlock(blockCombat, [
        makeBlock({
          enemyInstanceId: enemyId,
          blockValue: 4,
          blockElement: 'cold_fire',
        }),
      ])

      expect(result.enemies[0].isBlocked).toBe(true)
    })

    it('fire block is efficient vs ice attack', () => {
      const enemy = makeEnemy({ attack: 3, attackType: 'ice' })
      const combat = resolver.initiateCombat([enemy], false)
      const blockCombat = { ...combat, phase: 'block' as const }
      const enemyId = combat.enemies[0].instanceId

      const result = resolver.resolveBlock(blockCombat, [
        makeBlock({
          enemyInstanceId: enemyId,
          blockValue: 3,
          blockElement: 'fire',
        }),
      ])

      expect(result.enemies[0].isBlocked).toBe(true)
    })

    it('only cold_fire block is efficient vs cold_fire attack', () => {
      const enemy = makeEnemy({ attack: 4, attackType: 'cold_fire' })
      const combat = resolver.initiateCombat([enemy], false)
      const blockCombat = { ...combat, phase: 'block' as const }
      const enemyId = combat.enemies[0].instanceId

      // ice block should be halved vs cold_fire
      const result = resolver.resolveBlock(blockCombat, [
        makeBlock({
          enemyInstanceId: enemyId,
          blockValue: 7,
          blockElement: 'ice',
        }),
      ])

      // 7 / 2 = 3, < 4 → fails
      expect(result.enemies[0].isBlocked).toBe(false)
    })

    it('needs 2x attack value to block swift enemy', () => {
      const enemy = makeEnemy({
        attack: 3,
        attackType: 'normal',
        abilities: ['swift'],
      })
      const combat = resolver.initiateCombat([enemy], false)
      const blockCombat = { ...combat, phase: 'block' as const }
      const enemyId = combat.enemies[0].instanceId

      // Need 6 to block swift with attack 3
      const failResult = resolver.resolveBlock(blockCombat, [
        makeBlock({ enemyInstanceId: enemyId, blockValue: 5 }),
      ])
      expect(failResult.enemies[0].isBlocked).toBe(false)

      // Reset and try with enough block
      const combat2 = resolver.initiateCombat([enemy], false)
      const blockCombat2 = { ...combat2, phase: 'block' as const }
      const enemyId2 = combat2.enemies[0].instanceId

      const successResult = resolver.resolveBlock(blockCombat2, [
        makeBlock({ enemyInstanceId: enemyId2, blockValue: 6 }),
      ])
      expect(successResult.enemies[0].isBlocked).toBe(true)
    })

    it('advances phase to assign_damage', () => {
      const combat = resolver.initiateCombat([makeEnemy()], false)
      const blockCombat = { ...combat, phase: 'block' as const }

      const result = resolver.resolveBlock(blockCombat, [])

      expect(result.phase).toBe('assign_damage')
    })
  })

  describe('handleSummon', () => {
    it('adds a new brown enemy to combat', () => {
      const summoner = makeEnemy({
        id: 4,
        name: 'Orc Summoners',
        attackType: 'summon',
        abilities: ['summoner_brown'],
      })
      const combat = resolver.initiateCombat([summoner], false)
      const summonerId = combat.enemies[0].instanceId

      const result = resolver.handleSummon(combat, summonerId)

      expect(result.enemies).toHaveLength(2)
      expect(result.enemies[1].token.color).toBe('brown')
    })

    it('does not summon for defeated summoner', () => {
      const summoner = makeEnemy({ id: 4, abilities: ['summoner_brown'] })
      const combat = resolver.initiateCombat([summoner], false)
      const summonerId = combat.enemies[0].instanceId
      const defeatCombat: CombatState = {
        ...combat,
        enemies: combat.enemies.map((e) => ({ ...e, isDefeated: true })),
      }

      const result = resolver.handleSummon(defeatCombat, summonerId)

      expect(result.enemies).toHaveLength(1)
    })
  })

  describe('calculateUnblockedDamage', () => {
    it('returns base damage for unblocked enemy', () => {
      const combat = resolver.initiateCombat(
        [makeEnemy({ attack: 5 })],
        false,
      )

      const damage = resolver.calculateUnblockedDamage(combat)

      expect(damage).toHaveLength(1)
      expect(damage[0].damage).toBe(5)
    })

    it('doubles damage for brutal ability', () => {
      const enemy = makeEnemy({ attack: 4, abilities: ['brutal'] })
      const combat = resolver.initiateCombat([enemy], false)

      const damage = resolver.calculateUnblockedDamage(combat)

      expect(damage[0].damage).toBe(8)
      expect(damage[0].abilities).toContain('brutal')
    })

    it('excludes defeated enemies', () => {
      const combat = resolver.initiateCombat([makeEnemy()], false)
      const defeatCombat: CombatState = {
        ...combat,
        enemies: combat.enemies.map((e) => ({ ...e, isDefeated: true })),
      }

      const damage = resolver.calculateUnblockedDamage(defeatCombat)

      expect(damage).toHaveLength(0)
    })

    it('excludes blocked enemies', () => {
      const combat = resolver.initiateCombat([makeEnemy()], false)
      const blockedCombat: CombatState = {
        ...combat,
        enemies: combat.enemies.map((e) => ({ ...e, isBlocked: true })),
      }

      const damage = resolver.calculateUnblockedDamage(blockedCombat)

      expect(damage).toHaveLength(0)
    })

    it('includes poison ability in damage info', () => {
      const enemy = makeEnemy({ attack: 3, abilities: ['poison'] })
      const combat = resolver.initiateCombat([enemy], false)

      const damage = resolver.calculateUnblockedDamage(combat)

      expect(damage[0].abilities).toContain('poison')
    })

    it('includes paralyze ability in damage info', () => {
      const enemy = makeEnemy({ attack: 3, abilities: ['paralyze'] })
      const combat = resolver.initiateCombat([enemy], false)

      const damage = resolver.calculateUnblockedDamage(combat)

      expect(damage[0].abilities).toContain('paralyze')
    })
  })

  describe('assignDamage', () => {
    it('accepts valid damage assignment', () => {
      const enemy = makeEnemy({ attack: 3 })
      const combat = resolver.initiateCombat([enemy], false)
      const damageCombat: CombatState = {
        ...combat,
        phase: 'assign_damage',
      }
      const enemyId = combat.enemies[0].instanceId

      const assignment: DamageAssignment = {
        enemyInstanceId: enemyId,
        totalDamage: 3,
        assignments: [
          {
            targetType: 'hero',
            damageAbsorbed: 3,
            woundsInflicted: 1,
          },
        ],
      }

      const result = resolver.assignDamage(damageCombat, [assignment])

      expect(result.damageAssignments).toHaveLength(1)
      expect(result.phase).toBe('attack')
    })

    it('rejects when total assigned does not match incoming', () => {
      const enemy = makeEnemy({ attack: 3 })
      const combat = resolver.initiateCombat([enemy], false)
      const damageCombat: CombatState = {
        ...combat,
        phase: 'assign_damage',
      }
      const enemyId = combat.enemies[0].instanceId

      const assignment: DamageAssignment = {
        enemyInstanceId: enemyId,
        totalDamage: 3,
        assignments: [
          {
            targetType: 'hero',
            damageAbsorbed: 2, // should be 3
            woundsInflicted: 1,
          },
        ],
      }

      const result = resolver.assignDamage(damageCombat, [assignment])

      // State unchanged because mismatch
      expect(result.phase).toBe('assign_damage')
    })
  })

  describe('resolveMeleeAttack', () => {
    it('defeats enemy with melee attack', () => {
      const combat = resolver.initiateCombat([makeEnemy({ armor: 4 })], false)
      const meleeCombat: CombatState = {
        ...combat,
        phase: 'attack',
      }
      const enemyId = combat.enemies[0].instanceId

      const result = resolver.resolveMeleeAttack(meleeCombat, [
        makeAttack({
          targetEnemyIds: [enemyId],
          attackValue: 4,
          isSiege: false,
          isRanged: false,
        }),
      ])

      expect(result.enemies[0].isDefeated).toBe(true)
      expect(result.phase).toBe('combat_end')
    })

    it('ignores fortification in melee phase', () => {
      const combat = resolver.initiateCombat([makeEnemy({ armor: 3 })], true)
      const meleeCombat: CombatState = {
        ...combat,
        phase: 'attack',
      }
      const enemyId = combat.enemies[0].instanceId

      const result = resolver.resolveMeleeAttack(meleeCombat, [
        makeAttack({
          targetEnemyIds: [enemyId],
          attackValue: 3,
          isSiege: false,
          isRanged: false,
        }),
      ])

      expect(result.enemies[0].isDefeated).toBe(true)
    })

    it('allows ranged attacks in melee phase', () => {
      const combat = resolver.initiateCombat([makeEnemy({ armor: 4 })], false)
      const meleeCombat: CombatState = {
        ...combat,
        phase: 'attack',
      }
      const enemyId = combat.enemies[0].instanceId

      const result = resolver.resolveMeleeAttack(meleeCombat, [
        makeAttack({
          targetEnemyIds: [enemyId],
          attackValue: 4,
          isRanged: true,
        }),
      ])

      expect(result.enemies[0].isDefeated).toBe(true)
    })

    it('earns fame from defeated enemies', () => {
      const combat = resolver.initiateCombat(
        [makeEnemy({ armor: 3, fameReward: 5 })],
        false,
      )
      const meleeCombat: CombatState = {
        ...combat,
        phase: 'attack',
      }
      const enemyId = combat.enemies[0].instanceId

      const result = resolver.resolveMeleeAttack(meleeCombat, [
        makeAttack({ targetEnemyIds: [enemyId], attackValue: 3 }),
      ])

      expect(result.fameEarned).toBe(5)
    })

    it('advances phase to combat_end', () => {
      const combat = resolver.initiateCombat([makeEnemy()], false)
      const meleeCombat: CombatState = { ...combat, phase: 'attack' }

      const result = resolver.resolveMeleeAttack(meleeCombat, [])

      expect(result.phase).toBe('combat_end')
    })
  })

  describe('endCombat', () => {
    it('sets isActive to false and phase to combat_end', () => {
      const combat = resolver.initiateCombat([makeEnemy({ armor: 3 })], false)
      const enemyId = combat.enemies[0].instanceId
      const afterAttack = resolver.resolveMeleeAttack(
        { ...combat, phase: 'attack' },
        [makeAttack({ targetEnemyIds: [enemyId], attackValue: 3 })],
      )

      const result = resolver.endCombat(afterAttack)

      expect(result.isActive).toBe(false)
      expect(result.phase).toBe('combat_end')
    })

    it('calculates total fame from all defeated enemies', () => {
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

    it('applies reputation_minus_1 for defeated enemies', () => {
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

  describe('calculateEffectiveAttack', () => {
    it('returns full value when no resistance', () => {
      const value = resolver.calculateEffectiveAttack(6, 'fire', [])
      expect(value).toBe(6)
    })

    it('halves physical attack vs physical resistance (floor)', () => {
      const value = resolver.calculateEffectiveAttack(5, 'physical', [
        'physical_resistance',
      ])
      expect(value).toBe(2)
    })

    it('halves fire attack vs fire resistance (floor)', () => {
      const value = resolver.calculateEffectiveAttack(7, 'fire', [
        'fire_resistance',
      ])
      expect(value).toBe(3)
    })

    it('halves ice attack vs ice resistance', () => {
      const value = resolver.calculateEffectiveAttack(6, 'ice', [
        'ice_resistance',
      ])
      expect(value).toBe(3)
    })

    it('halves cold_fire attack when both fire and ice resistance', () => {
      const value = resolver.calculateEffectiveAttack(6, 'cold_fire', [
        'fire_resistance',
        'ice_resistance',
      ])
      expect(value).toBe(3)
    })

    it('does not halve cold_fire attack with only fire resistance', () => {
      const value = resolver.calculateEffectiveAttack(6, 'cold_fire', [
        'fire_resistance',
      ])
      expect(value).toBe(6)
    })
  })

  describe('calculateEffectiveBlock', () => {
    it('returns full value for any block type vs normal attack', () => {
      expect(resolver.calculateEffectiveBlock(5, 'fire', 'normal')).toBe(5)
      expect(resolver.calculateEffectiveBlock(5, 'ice', 'normal')).toBe(5)
      expect(resolver.calculateEffectiveBlock(5, 'physical', 'normal')).toBe(5)
    })

    it('ice block is efficient vs fire attack', () => {
      expect(resolver.calculateEffectiveBlock(4, 'ice', 'fire')).toBe(4)
    })

    it('physical block is halved vs fire attack', () => {
      expect(resolver.calculateEffectiveBlock(4, 'physical', 'fire')).toBe(2)
    })

    it('fire block is efficient vs ice attack', () => {
      expect(resolver.calculateEffectiveBlock(4, 'fire', 'ice')).toBe(4)
    })

    it('physical block is halved vs ice attack', () => {
      expect(resolver.calculateEffectiveBlock(4, 'physical', 'ice')).toBe(2)
    })

    it('only cold_fire block is efficient vs cold_fire attack', () => {
      expect(resolver.calculateEffectiveBlock(4, 'cold_fire', 'cold_fire')).toBe(4)
      expect(resolver.calculateEffectiveBlock(4, 'fire', 'cold_fire')).toBe(2)
      expect(resolver.calculateEffectiveBlock(4, 'ice', 'cold_fire')).toBe(2)
    })
  })

  describe('utility methods', () => {
    it('isEnemyFortified returns correct value', () => {
      const combat = resolver.initiateCombat([makeEnemy()], true)
      expect(resolver.isEnemyFortified(combat.enemies[0])).toBe(true)

      const combat2 = resolver.initiateCombat([makeEnemy()], false)
      expect(resolver.isEnemyFortified(combat2.enemies[0])).toBe(false)
    })

    it('getEnemyResistances extracts resistance elements', () => {
      const enemy = makeEnemy({
        abilities: ['physical_resistance', 'fire_resistance'],
      })
      const combat = resolver.initiateCombat([enemy], false)

      const resistances = resolver.getEnemyResistances(combat.enemies[0])

      expect(resistances).toContain('physical')
      expect(resistances).toContain('fire')
      expect(resistances).not.toContain('ice')
    })

    it('getTotalFameEarned sums fame of defeated enemies', () => {
      const enemies = [
        makeEnemy({ id: 1, fameReward: 3 }),
        makeEnemy({ id: 2, fameReward: 5 }),
        makeEnemy({ id: 3, fameReward: 4 }),
      ]
      const combat = resolver.initiateCombat(enemies, false)
      const partialDefeat: CombatState = {
        ...combat,
        enemies: combat.enemies.map((e, i) => ({
          ...e,
          isDefeated: i !== 1, // middle enemy survives
        })),
      }

      expect(resolver.getTotalFameEarned(partialDefeat)).toBe(7)
    })
  })

  describe('immutability', () => {
    it('initiateCombat does not mutate input tokens', () => {
      const enemies = [makeEnemy()]
      const originalAbilities = [...enemies[0].abilities]

      resolver.initiateCombat(enemies, true, 'red')

      expect(enemies[0].abilities).toEqual(originalAbilities)
    })

    it('resolveRangedSiegeAttack does not mutate input state', () => {
      const combat = resolver.initiateCombat([makeEnemy({ armor: 3 })], false)
      const originalDefeated = combat.enemies[0].isDefeated
      const enemyId = combat.enemies[0].instanceId

      resolver.resolveRangedSiegeAttack(combat, [
        makeAttack({ targetEnemyIds: [enemyId], attackValue: 5 }),
      ])

      expect(combat.enemies[0].isDefeated).toBe(originalDefeated)
      expect(combat.phase).toBe('ranged_siege')
    })

    it('resolveBlock does not mutate input state', () => {
      const combat = resolver.initiateCombat([makeEnemy({ attack: 3 })], false)
      const originalBlocked = combat.enemies[0].isBlocked
      const enemyId = combat.enemies[0].instanceId

      resolver.resolveBlock(combat, [
        makeBlock({ enemyInstanceId: enemyId, blockValue: 3 }),
      ])

      expect(combat.enemies[0].isBlocked).toBe(originalBlocked)
      expect(combat.phase).toBe('ranged_siege')
    })

    it('handleSummon does not mutate input state', () => {
      const enemy = makeEnemy({ abilities: ['summoner_brown'] })
      const combat = resolver.initiateCombat([enemy], false)
      const originalLength = combat.enemies.length
      const summonerId = combat.enemies[0].instanceId

      resolver.handleSummon(combat, summonerId)

      expect(combat.enemies).toHaveLength(originalLength)
    })

    it('resolveMeleeAttack does not mutate input state', () => {
      const combat = resolver.initiateCombat([makeEnemy({ armor: 3 })], false)
      const meleeCombat: CombatState = { ...combat, phase: 'attack' }
      const originalDefeated = meleeCombat.enemies[0].isDefeated
      const enemyId = combat.enemies[0].instanceId

      resolver.resolveMeleeAttack(meleeCombat, [
        makeAttack({ targetEnemyIds: [enemyId], attackValue: 5 }),
      ])

      expect(meleeCombat.enemies[0].isDefeated).toBe(originalDefeated)
    })
  })

  describe('full combat flow', () => {
    it('completes a full 4-phase combat scenario', () => {
      const enemies = [
        makeEnemy({ id: 1, armor: 6, attack: 3, fameReward: 4 }),
        makeEnemy({ id: 2, armor: 3, attack: 5, fameReward: 2 }),
      ]

      // Phase 1: Ranged/Siege
      let combat = resolver.initiateCombat(enemies, false)
      const enemy1Id = combat.enemies[0].instanceId
      const enemy2Id = combat.enemies[1].instanceId

      combat = resolver.resolveRangedSiegeAttack(combat, [
        makeAttack({
          targetEnemyIds: [enemy2Id],
          attackValue: 3,
          attackElement: 'fire',
        }),
      ])
      expect(combat.phase).toBe('block')
      expect(combat.enemies[0].isDefeated).toBe(false) // not targeted
      expect(combat.enemies[1].isDefeated).toBe(true) // fire 3 >= armor 3

      // Phase 2: Block
      combat = resolver.resolveBlock(combat, [
        makeBlock({
          enemyInstanceId: enemy1Id,
          blockValue: 3,
          blockElement: 'physical',
        }),
      ])
      expect(combat.phase).toBe('assign_damage')
      expect(combat.enemies[0].isBlocked).toBe(true)

      // Phase 3: Assign Damage (no unblocked enemies)
      const unblockedDamage = resolver.calculateUnblockedDamage(combat)
      expect(unblockedDamage).toHaveLength(0)

      combat = resolver.assignDamage(combat, [])
      expect(combat.phase).toBe('attack')

      // Phase 4: Melee Attack
      combat = resolver.resolveMeleeAttack(combat, [
        makeAttack({
          targetEnemyIds: [enemy1Id],
          attackValue: 6,
        }),
      ])
      expect(combat.phase).toBe('combat_end')
      expect(combat.enemies[0].isDefeated).toBe(true)

      // End
      combat = resolver.endCombat(combat)
      expect(combat.isActive).toBe(false)
      expect(combat.fameEarned).toBe(6)
    })
  })

  // ── Edge Case Tests ──────────────────────

  describe('edge cases: multiple enemies with mixed abilities', () => {
    it('handles fortified + swift enemy in same combat', () => {
      const fortifiedEnemy = makeEnemy({
        id: 1,
        armor: 3,
        attack: 4,
        abilities: ['fortified'],
      })
      const swiftEnemy = makeEnemy({
        id: 2,
        armor: 2,
        attack: 3,
        abilities: ['swift'],
      })

      const combat = resolver.initiateCombat([fortifiedEnemy, swiftEnemy], false)

      // Fortified enemy should have fortification
      expect(combat.enemies[0].isFortified).toBe(true)
      expect(combat.enemies[0].appliedAbilities).toContain('fortified')

      // Swift enemy should have swiftness
      expect(combat.enemies[1].appliedAbilities).toContain('swift')

      // Block phase: swift needs 2x to block
      const blockCombat: CombatState = { ...combat, phase: 'block' }
      const swiftId = combat.enemies[1].instanceId

      const blockResult = resolver.resolveBlock(blockCombat, [
        makeBlock({ enemyInstanceId: swiftId, blockValue: 6 }),
      ])
      expect(blockResult.enemies[1].isBlocked).toBe(true)
    })

    it('handles multiple enemies with different resistances', () => {
      const fireResist = makeEnemy({
        id: 1,
        armor: 4,
        abilities: ['fire_resistance'],
      })
      const iceResist = makeEnemy({
        id: 2,
        armor: 4,
        abilities: ['ice_resistance'],
      })
      const physResist = makeEnemy({
        id: 3,
        armor: 4,
        abilities: ['physical_resistance'],
      })

      const combat = resolver.initiateCombat(
        [fireResist, iceResist, physResist],
        false,
      )

      // Fire attack against fire resist (halved), ice resist (full), physical resist (full)
      const enemy1Id = combat.enemies[0].instanceId
      const enemy2Id = combat.enemies[1].instanceId
      const enemy3Id = combat.enemies[2].instanceId

      const result = resolver.resolveRangedSiegeAttack(combat, [
        makeAttack({
          targetEnemyIds: [enemy1Id],
          attackValue: 4,
          attackElement: 'fire',
        }),
        makeAttack({
          targetEnemyIds: [enemy2Id],
          attackValue: 4,
          attackElement: 'fire',
        }),
        makeAttack({
          targetEnemyIds: [enemy3Id],
          attackValue: 4,
          attackElement: 'fire',
        }),
      ])

      // Fire vs fire resistance: 4/2 = 2 < 4 armor → not defeated
      expect(result.enemies[0].isDefeated).toBe(false)
      // Fire vs ice resistance: full 4 >= 4 armor → defeated
      expect(result.enemies[1].isDefeated).toBe(true)
      // Fire vs physical resistance: full 4 >= 4 armor → defeated
      expect(result.enemies[2].isDefeated).toBe(true)
    })
  })

  describe('edge cases: zero armor enemies', () => {
    it('defeats an enemy with armor 1 using attack 1', () => {
      const combat = resolver.initiateCombat([makeEnemy({ armor: 1 })], false)
      const enemyId = combat.enemies[0].instanceId

      const result = resolver.resolveRangedSiegeAttack(combat, [
        makeAttack({ targetEnemyIds: [enemyId], attackValue: 1 }),
      ])

      expect(result.enemies[0].isDefeated).toBe(true)
    })

    it('handles very low armor with resistance (1 attack halved to 0 < 1 armor)', () => {
      const enemy = makeEnemy({
        armor: 1,
        abilities: ['physical_resistance'],
      })
      const combat = resolver.initiateCombat([enemy], false)
      const enemyId = combat.enemies[0].instanceId

      const result = resolver.resolveRangedSiegeAttack(combat, [
        makeAttack({
          targetEnemyIds: [enemyId],
          attackValue: 1,
          attackElement: 'physical',
        }),
      ])

      // 1 / 2 = 0 (floor), < 1 armor → not defeated
      expect(result.enemies[0].isDefeated).toBe(false)
    })
  })

  describe('edge cases: overkill damage', () => {
    it('defeats enemy with massive overkill attack', () => {
      const combat = resolver.initiateCombat(
        [makeEnemy({ armor: 2, fameReward: 1 })],
        false,
      )
      const enemyId = combat.enemies[0].instanceId

      const result = resolver.resolveRangedSiegeAttack(combat, [
        makeAttack({ targetEnemyIds: [enemyId], attackValue: 100 }),
      ])

      expect(result.enemies[0].isDefeated).toBe(true)
      expect(result.fameEarned).toBe(1)
    })

    it('fame is not multiplied by overkill', () => {
      const combat = resolver.initiateCombat(
        [makeEnemy({ armor: 1, fameReward: 5 })],
        false,
      )
      const meleeCombat: CombatState = { ...combat, phase: 'attack' }
      const enemyId = combat.enemies[0].instanceId

      const result = resolver.resolveMeleeAttack(meleeCombat, [
        makeAttack({
          targetEnemyIds: [enemyId],
          attackValue: 50,
          isRanged: false,
        }),
      ])

      expect(result.enemies[0].isDefeated).toBe(true)
      expect(result.fameEarned).toBe(5)
    })
  })

  describe('edge cases: zero attack value', () => {
    it('does not defeat enemy with zero attack value', () => {
      const combat = resolver.initiateCombat([makeEnemy({ armor: 1 })], false)
      const enemyId = combat.enemies[0].instanceId

      const result = resolver.resolveRangedSiegeAttack(combat, [
        makeAttack({ targetEnemyIds: [enemyId], attackValue: 0 }),
      ])

      expect(result.enemies[0].isDefeated).toBe(false)
    })
  })

  describe('edge cases: empty attacks and blocks', () => {
    it('handles empty attack list in ranged phase', () => {
      const combat = resolver.initiateCombat(
        [makeEnemy({ attack: 3 })],
        false,
      )

      const result = resolver.resolveRangedSiegeAttack(combat, [])

      expect(result.phase).toBe('block')
      expect(result.enemies[0].isDefeated).toBe(false)
    })

    it('handles empty block list in block phase', () => {
      const combat = resolver.initiateCombat(
        [makeEnemy({ attack: 3 })],
        false,
      )
      const blockCombat: CombatState = { ...combat, phase: 'block' }

      const result = resolver.resolveBlock(blockCombat, [])

      expect(result.phase).toBe('assign_damage')
      expect(result.enemies[0].isBlocked).toBe(false)
    })

    it('handles empty melee attack list', () => {
      const combat = resolver.initiateCombat([makeEnemy()], false)
      const meleeCombat: CombatState = { ...combat, phase: 'attack' }

      const result = resolver.resolveMeleeAttack(meleeCombat, [])

      expect(result.phase).toBe('combat_end')
      expect(result.enemies[0].isDefeated).toBe(false)
    })
  })

  describe('edge cases: unblocked damage with combined abilities', () => {
    it('brutal + poison enemy deals doubled damage with poison', () => {
      const enemy = makeEnemy({
        attack: 3,
        abilities: ['brutal', 'poison'],
      })
      const combat = resolver.initiateCombat([enemy], false)

      const damage = resolver.calculateUnblockedDamage(combat)

      expect(damage).toHaveLength(1)
      expect(damage[0].damage).toBe(6) // brutal doubles
      expect(damage[0].abilities).toContain('brutal')
      expect(damage[0].abilities).toContain('poison')
    })

    it('swift enemy still deals normal damage when unblocked', () => {
      const enemy = makeEnemy({
        attack: 4,
        abilities: ['swift'],
      })
      const combat = resolver.initiateCombat([enemy], false)

      const damage = resolver.calculateUnblockedDamage(combat)

      expect(damage).toHaveLength(1)
      expect(damage[0].damage).toBe(4) // swift doesn't affect damage
    })
  })

  describe('edge cases: combat with all enemies defeated in ranged', () => {
    it('combat progresses normally when all enemies are defeated in ranged', () => {
      const enemies = [
        makeEnemy({ id: 1, armor: 2, fameReward: 2 }),
        makeEnemy({ id: 2, armor: 3, fameReward: 3 }),
      ]

      let combat = resolver.initiateCombat(enemies, false)
      const enemy1Id = combat.enemies[0].instanceId
      const enemy2Id = combat.enemies[1].instanceId

      combat = resolver.resolveRangedSiegeAttack(combat, [
        makeAttack({ targetEnemyIds: [enemy1Id], attackValue: 5 }),
        makeAttack({ targetEnemyIds: [enemy2Id], attackValue: 5 }),
      ])

      expect(combat.enemies.every((e) => e.isDefeated)).toBe(true)

      // Block phase should have no one to block
      combat = resolver.resolveBlock(combat, [])
      expect(resolver.calculateUnblockedDamage(combat)).toHaveLength(0)

      // End combat
      combat = resolver.endCombat(combat)
      expect(combat.fameEarned).toBe(5)
    })
  })
})
