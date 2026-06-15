import type {
  CombatState,
  CombatPhase,
  EnemyToken,
  EnemyInstance,
  EnemyAbility,
  Element,
  AttackType,
  AttackDeclaration,
  BlockDeclaration,
  DamageAssignment,
  CityColor,
  HexCoord,
} from './types'
import type { SeededRandom } from '@/utils/random'

const BROWN_ENEMY_TEMPLATES: EnemyToken[] = [
  {
    id: 901,
    name: 'Summoned Orc',
    color: 'brown',
    category: 'summoned',
    armor: 3,
    attack: 3,
    attackType: 'normal',
    abilities: [],
    fameReward: 2,
    copies: 1,
    set: 'base',
  },
  {
    id: 902,
    name: 'Summoned Wolf',
    color: 'brown',
    category: 'summoned',
    armor: 2,
    attack: 4,
    attackType: 'normal',
    abilities: ['swift'],
    fameReward: 3,
    copies: 1,
    set: 'base',
  },
  {
    id: 903,
    name: 'Summoned Skeleton',
    color: 'brown',
    category: 'summoned',
    armor: 4,
    attack: 2,
    attackType: 'normal',
    abilities: ['physical_resistance'],
    fameReward: 2,
    copies: 1,
    set: 'base',
  },
]

export class CombatResolver {
  private random: SeededRandom
  private instanceCounter = 0

  constructor(random: SeededRandom) {
    this.random = random
  }

  initiateCombat(
    enemies: EnemyToken[],
    isFortifiedSite: boolean,
    cityColor?: CityColor,
    hexCoord?: HexCoord,
  ): CombatState {
    const instances = enemies.map((token) =>
      this.createEnemyInstance(token, isFortifiedSite, cityColor),
    )

    return {
      isActive: true,
      phase: 'ranged_siege',
      enemies: instances,
      attacks: [],
      blocks: [],
      damageAssignments: [],
      isFortifiedSite,
      cityColor,
      fameEarned: 0,
      // Rulebook: assaulting ANY unconquered fortified site (keep, mage tower
      // OR city) costs 1 Reputation, regardless of the combat's outcome.
      reputationChange: isFortifiedSite || cityColor ? -1 : 0,
      rewards: [],
      combatHexCoord: hexCoord,
    }
  }

  resolveRangedSiegeAttack(
    combat: CombatState,
    attacks: AttackDeclaration[],
  ): CombatState {
    let enemies = [...combat.enemies.map((e) => ({ ...e, appliedAbilities: [...e.appliedAbilities] }))]
    let fameEarned = combat.fameEarned

    for (const attack of attacks) {
      const targetIds = attack.targetEnemyIds
      const targets = enemies.filter(
        (e) => targetIds.includes(e.instanceId) && !e.isDefeated,
      )

      if (targets.length === 0) continue

      for (const target of targets) {
        if (this.isEnemyDoubleFortified(target)) continue
        if (target.isFortified && !attack.isSiege) continue

        const effectiveAttack = this.calculateEffectiveAttack(
          attack.attackValue,
          attack.attackElement,
          target.appliedAbilities,
        )

        if (effectiveAttack >= target.currentArmor) {
          const idx = enemies.findIndex((e) => e.instanceId === target.instanceId)
          enemies = [
            ...enemies.slice(0, idx),
            { ...enemies[idx], isDefeated: true },
            ...enemies.slice(idx + 1),
          ]
          fameEarned += target.token.fameReward
        }
      }
    }

    return {
      ...combat,
      enemies,
      attacks: [...combat.attacks, ...attacks],
      fameEarned,
      phase: 'block' as CombatPhase,
    }
  }

  /**
   * EC-07-C-5: Auto-trigger Summon at Block Phase start.
   * Call this before resolveBlock to spawn summoned enemies.
   */
  processSummons(combat: CombatState): CombatState {
    let result = { ...combat }
    const summoners = combat.enemies.filter(
      (e) => !e.isDefeated && (
        e.currentAttackType === 'summon' ||
        e.appliedAbilities.some((a) => a.startsWith('summon'))
      ),
    )
    for (const summoner of summoners) {
      result = this.handleSummon(result, summoner.instanceId)
    }
    return result
  }

  resolveBlock(
    combat: CombatState,
    blocks: BlockDeclaration[],
  ): CombatState {
    let enemies = [...combat.enemies.map((e) => ({ ...e, appliedAbilities: [...e.appliedAbilities] }))]
    const resolvedBlocks: BlockDeclaration[] = []

    for (const block of blocks) {
      const enemyIdx = enemies.findIndex(
        (e) => e.instanceId === block.enemyInstanceId && !e.isDefeated,
      )
      if (enemyIdx === -1) {
        resolvedBlocks.push({ ...block, isSuccessful: false })
        continue
      }

      const enemy = enemies[enemyIdx]
      const effectiveBlock = this.calculateEffectiveBlock(
        block.blockValue,
        block.blockElement,
        enemy.currentAttackType,
      )

      const requiredBlock = enemy.appliedAbilities.includes('swift')
        ? enemy.currentAttack * 2
        : enemy.currentAttack

      const isSuccessful = effectiveBlock >= requiredBlock

      if (isSuccessful) {
        enemies = [
          ...enemies.slice(0, enemyIdx),
          { ...enemies[enemyIdx], isBlocked: true },
          ...enemies.slice(enemyIdx + 1),
        ]
      }

      resolvedBlocks.push({ ...block, isSuccessful })
    }

    return {
      ...combat,
      enemies,
      blocks: [...combat.blocks, ...resolvedBlocks],
      phase: 'assign_damage' as CombatPhase,
    }
  }

  handleSummon(combat: CombatState, summonerInstanceId: string): CombatState {
    const summoner = combat.enemies.find(
      (e) => e.instanceId === summonerInstanceId && !e.isDefeated,
    )
    if (!summoner) return { ...combat }

    const template = this.random.pick(BROWN_ENEMY_TEMPLATES)
    const summonedInstance = this.createEnemyInstance(
      template,
      combat.isFortifiedSite,
      combat.cityColor,
    )

    return {
      ...combat,
      enemies: [
        ...combat.enemies.map((e) => ({ ...e, appliedAbilities: [...e.appliedAbilities] })),
        summonedInstance,
      ],
    }
  }

  calculateUnblockedDamage(
    combat: CombatState,
  ): Array<{ enemyInstanceId: string; damage: number; abilities: EnemyAbility[] }> {
    return combat.enemies
      .filter((e) => !e.isDefeated && !e.isBlocked)
      .map((enemy) => {
        let damage = enemy.currentAttack
        const abilities: EnemyAbility[] = []

        if (enemy.appliedAbilities.includes('brutal')) {
          damage *= 2
          abilities.push('brutal')
        }
        if (enemy.appliedAbilities.includes('poison')) {
          abilities.push('poison')
        }
        if (enemy.appliedAbilities.includes('paralyze')) {
          abilities.push('paralyze')
        }

        return { enemyInstanceId: enemy.instanceId, damage, abilities }
      })
  }

  assignDamage(
    combat: CombatState,
    assignments: DamageAssignment[],
  ): CombatState {
    const unblockedDamage = this.calculateUnblockedDamage(combat)
    const totalIncoming = unblockedDamage.reduce((sum, d) => sum + d.damage, 0)
    const totalAssigned = assignments.reduce(
      (sum, a) => a.assignments.reduce((s, x) => s + x.damageAbsorbed, sum),
      0,
    )

    if (totalAssigned !== totalIncoming) {
      return { ...combat }
    }

    return {
      ...combat,
      damageAssignments: [...combat.damageAssignments, ...assignments],
      phase: 'attack' as CombatPhase,
    }
  }

  resolveMeleeAttack(
    combat: CombatState,
    attacks: AttackDeclaration[],
  ): CombatState {
    let enemies = [...combat.enemies.map((e) => ({ ...e, appliedAbilities: [...e.appliedAbilities] }))]
    let fameEarned = combat.fameEarned

    for (const attack of attacks) {
      const targetIds = attack.targetEnemyIds
      const targets = enemies.filter(
        (e) => targetIds.includes(e.instanceId) && !e.isDefeated,
      )

      if (targets.length === 0) continue

      for (const target of targets) {
        const effectiveAttack = this.calculateEffectiveAttack(
          attack.attackValue,
          attack.attackElement,
          target.appliedAbilities,
        )

        if (effectiveAttack >= target.currentArmor) {
          const idx = enemies.findIndex((e) => e.instanceId === target.instanceId)
          enemies = [
            ...enemies.slice(0, idx),
            { ...enemies[idx], isDefeated: true },
            ...enemies.slice(idx + 1),
          ]
          fameEarned += target.token.fameReward
        }
      }
    }

    return {
      ...combat,
      enemies,
      attacks: [...combat.attacks, ...attacks],
      fameEarned,
      phase: 'combat_end' as CombatPhase,
    }
  }

  endCombat(combat: CombatState): CombatState {
    const fameEarned = this.getTotalFameEarned(combat)
    let reputationChange = combat.reputationChange

    for (const enemy of combat.enemies) {
      if (enemy.appliedAbilities.includes('reputation_minus_1') && enemy.isDefeated) {
        reputationChange -= 1
      }
    }

    return {
      ...combat,
      isActive: false,
      phase: 'combat_end' as CombatPhase,
      fameEarned,
      reputationChange,
    }
  }

  calculateEffectiveAttack(
    baseValue: number,
    element: Element,
    targetResistances: EnemyAbility[],
  ): number {
    const resistances = this.extractResistanceElements(targetResistances)

    if (element === 'physical' && resistances.includes('physical')) {
      return Math.floor(baseValue / 2)
    }
    if (element === 'fire' && resistances.includes('fire')) {
      return Math.floor(baseValue / 2)
    }
    if (element === 'ice' && resistances.includes('ice')) {
      return Math.floor(baseValue / 2)
    }
    if (element === 'cold_fire') {
      if (resistances.includes('fire') && resistances.includes('ice')) {
        return Math.floor(baseValue / 2)
      }
    }

    return baseValue
  }

  calculateEffectiveBlock(
    baseValue: number,
    blockElement: Element,
    attackType: AttackType,
  ): number {
    if (attackType === 'normal' || attackType === 'summon') {
      return baseValue
    }

    if (attackType === 'fire') {
      if (blockElement === 'ice' || blockElement === 'cold_fire') return baseValue
      return Math.floor(baseValue / 2)
    }

    if (attackType === 'ice') {
      if (blockElement === 'fire' || blockElement === 'cold_fire') return baseValue
      return Math.floor(baseValue / 2)
    }

    if (attackType === 'cold_fire') {
      if (blockElement === 'cold_fire') return baseValue
      return Math.floor(baseValue / 2)
    }

    return baseValue
  }

  isEnemyFortified(enemy: EnemyInstance): boolean {
    return enemy.isFortified
  }

  isEnemyDoubleFortified(enemy: EnemyInstance): boolean {
    return enemy.appliedAbilities.filter((a) => a === 'fortified').length >= 2
  }

  getEnemyResistances(enemy: EnemyInstance): Element[] {
    return this.extractResistanceElements(enemy.appliedAbilities)
  }

  getTotalFameEarned(combat: CombatState): number {
    return combat.enemies
      .filter((e) => e.isDefeated)
      .reduce((sum, e) => sum + e.token.fameReward, 0)
  }

  private createEnemyInstance(
    token: EnemyToken,
    isFortifiedSite: boolean,
    cityColor?: CityColor,
  ): EnemyInstance {
    let armor = token.armor
    let attack = token.attack
    let attackType = token.attackType
    const abilities: EnemyAbility[] = [...token.abilities]

    if (cityColor === 'white') {
      armor += 1
    }

    if (cityColor === 'blue') {
      if (attackType === 'fire' || attackType === 'ice') {
        attack += 2
      } else if (attackType === 'cold_fire') {
        attack += 1
      }
    }

    if (cityColor === 'red') {
      if (token.attackType === 'normal' && !abilities.includes('brutal')) {
        abilities.push('brutal')
      }
    }

    if (cityColor === 'green') {
      if (token.attackType === 'normal' && !abilities.includes('poison')) {
        abilities.push('poison')
      }
    }

    const isFortified =
      isFortifiedSite || token.abilities.includes('fortified')

    if (isFortifiedSite) {
      abilities.push('fortified')
    }

    const instanceId = `enemy_${token.id}_${this.instanceCounter++}`

    return {
      token,
      instanceId,
      isDefeated: false,
      isBlocked: false,
      isFortified,
      currentArmor: armor,
      currentAttack: attack,
      currentAttackType: attackType,
      appliedAbilities: abilities,
    }
  }

  private extractResistanceElements(abilities: EnemyAbility[]): Element[] {
    const elements: Element[] = []
    if (abilities.includes('physical_resistance')) elements.push('physical')
    if (abilities.includes('fire_resistance')) elements.push('fire')
    if (abilities.includes('ice_resistance')) elements.push('ice')
    return elements
  }
}
