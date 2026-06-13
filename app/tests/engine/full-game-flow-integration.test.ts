/**
 * ═══════════════════════════════════════════════════════════════════
 * Mage Knight — Full Game Flow Integration Tests
 * ═══════════════════════════════════════════════════════════════════
 *
 * Tests the COMPLETE game flow: card play, combat with units,
 * level-up with skill acquisition, interaction/influence purchasing,
 * and full multi-round game simulation.
 *
 * Unlike scenario-walkthrough tests that test individual phases,
 * these tests verify that all engine modules compose correctly
 * for a real game experience.
 */

import { describe, it, expect, beforeEach } from 'vitest'

// Engine modules
import { ScenarioSetup } from '@/engine/ScenarioSetup'
import { TurnManager } from '@/engine/TurnManager'
import { ManaPool } from '@/engine/ManaPool'
import { DeckManager } from '@/engine/DeckManager'
import { CombatResolver } from '@/engine/CombatResolver'
import { LevelUpManager } from '@/engine/LevelUpManager'
import { ReputationManager } from '@/engine/ReputationManager'
import { UnitManager } from '@/engine/UnitManager'
import { InteractionManager } from '@/engine/InteractionManager'
import { CardEffectResolver } from '@/engine/CardEffectResolver'
import { SkillManager } from '@/engine/SkillManager'
import { DummyPlayer } from '@/engine/DummyPlayer'
import { ScoringCalculator } from '@/engine/ScoringCalculator'
import {
  validateCardPlay,
  validateSidewaysPlay,
} from '@/engine/CardPlayValidator'

// Types
import type {
  BasicActionCard,
  AdvancedActionCard,
  SpellCard,
  ArtifactCard,
  TacticCard,
  EnemyToken,
  AnyCard,
  AnyUnit,
  RegularUnit,
  HeroSkill,
  UnitInstance,
  ManaPoolState,
  DeckState,
  AttackDeclaration,
  DamageAssignment,
} from '@/engine/types'
import { FAME_LEVEL_THRESHOLDS } from '@/engine/GameState'

// Utilities
import { SeededRandom } from '@/utils/random'

// ─── Test Fixtures ────────────────────────────────────────────────

function makeBasicAction(overrides: Partial<BasicActionCard> = {}): BasicActionCard {
  return {
    id: 1,
    name: 'March',
    type: 'basic_action',
    color: 'green',
    basicEffect: { text: 'Move 2', actions: [{ type: 'move', value: 2 }] },
    strongEffect: { text: 'Move 4', actions: [{ type: 'move', value: 4 }] },
    copies: 2,
    heroSpecific: null,
    replaces: null,
    set: 'base',
    ...overrides,
  }
}

function makeAdvancedAction(overrides: Partial<AdvancedActionCard> = {}): AdvancedActionCard {
  return {
    id: 100,
    name: 'Crystal Mastery',
    type: 'advanced_action',
    color: 'blue',
    basicEffect: { text: 'Attack 3', actions: [{ type: 'attack', value: 3 }] },
    strongEffect: { text: 'Attack 5 Ice', actions: [{ type: 'attack', value: 5, element: 'ice' }] },
    set: 'base',
    ...overrides,
  }
}

function makeSpell(overrides: Partial<SpellCard> = {}): SpellCard {
  return {
    id: 200,
    name: 'Fireball',
    type: 'spell',
    color: 'red',
    basicSpell: { name: 'Fireball', text: 'Ranged Attack 3 Fire', actions: [{ type: 'ranged_attack', value: 3, element: 'fire' }] },
    strongSpell: { name: 'Firestorm', text: 'Ranged Attack 5 Fire', actions: [{ type: 'ranged_attack', value: 5, element: 'fire' }] },
    set: 'base',
    ...overrides,
  }
}

function makeArtifact(overrides: Partial<ArtifactCard> = {}): ArtifactCard {
  return {
    id: 300,
    name: 'Sword of Justice',
    type: 'artifact',
    basicEffect: { text: 'Attack 4', actions: [{ type: 'attack', value: 4 }] },
    strongEffect: { text: 'Attack 8', actions: [{ type: 'attack', value: 8 }] },
    set: 'base',
    ...overrides,
  }
}

function makeTactic(id: number, number: number, type: 'day' | 'night' = 'day'): TacticCard {
  return { id, name: `Tactic_${id}`, type, number, effect: `Effect ${id}`, isUsed: false }
}

function makeDayTactics(): TacticCard[] {
  return [makeTactic(1, 1), makeTactic(2, 2), makeTactic(3, 3), makeTactic(4, 4), makeTactic(5, 5), makeTactic(6, 6)]
}

function makeEnemy(overrides: Partial<EnemyToken> = {}): EnemyToken {
  return {
    id: 1, name: 'Orc', color: 'green', category: 'marauding',
    armor: 3, attack: 3, attackType: 'normal', abilities: [],
    fameReward: 2, copies: 1, set: 'base', ...overrides,
  }
}

function makeUnit(overrides: Partial<RegularUnit> = {}): RegularUnit {
  return {
    id: 50, name: 'Peasants', type: 'regular_unit', tier: 'regular', level: 1,
    cost: 3, armor: 3, recruitSites: ['village'], abilities: [
      { name: 'Attack', text: 'Attack 2', actions: [{ type: 'attack', value: 2 }] },
    ],
    resistance: null, copies: 2, set: 'base', ...overrides,
  }
}

function makeSkill(overrides: Partial<HeroSkill> = {}): HeroSkill {
  return {
    id: 1, name: 'Resistance', type: 'once_per_round',
    effect: 'Physical Resistance 3', actions: [{ type: 'block', value: 3 }],
    isFlipped: false, isUsedThisTurn: false, ...overrides,
  }
}

function makeInfluenceCard(value: number): BasicActionCard {
  return makeBasicAction({
    id: 10, name: 'Influence',
    color: 'white',
    basicEffect: { text: `Influence ${value}`, actions: [{ type: 'influence', value }] },
    strongEffect: { text: `Influence ${value * 2}`, actions: [{ type: 'influence', value: value * 2 }] },
  })
}

// ═══════════════════════════════════════════════════════════════════
// US-001: Card Play Integration - Basic/Strong with Mana
// ═══════════════════════════════════════════════════════════════════

describe('US-001: Card Play Integration — Basic/Strong with Mana', () => {
  const resolver = new CardEffectResolver()

  describe('Basic Action Cards', () => {
    it('basic effect always playable without mana', () => {
      const card = makeBasicAction()
      const result = validateCardPlay(card, 'day', {
        hasColor: () => false, hasBlack: false, hasGold: false,
      })
      expect(result.canPlayBasic).toBe(true)
      expect(result.requiredMana).toBe('green')
    })

    it('strong effect requires matching color mana during day', () => {
      const card = makeBasicAction({ color: 'green' })

      // Without green mana
      let result = validateCardPlay(card, 'day', {
        hasColor: () => false, hasBlack: false, hasGold: false,
      })
      expect(result.canPlayStrong).toBe(false)

      // With green mana
      result = validateCardPlay(card, 'day', {
        hasColor: (c) => c === 'green', hasBlack: false, hasGold: false,
      })
      expect(result.canPlayStrong).toBe(true)

      // With gold mana (wildcard)
      result = validateCardPlay(card, 'day', {
        hasColor: () => false, hasBlack: false, hasGold: true,
      })
      expect(result.canPlayStrong).toBe(true)
    })

    it('strong effect at night requires matching color + black mana', () => {
      const card = makeBasicAction({ color: 'red' })

      // Only color — missing black
      let result = validateCardPlay(card, 'night', {
        hasColor: (c) => c === 'red', hasBlack: false, hasGold: false,
      })
      expect(result.canPlayStrong).toBe(false)
      expect(result.requiresBlackMana).toBe(true)

      // Color + black
      result = validateCardPlay(card, 'night', {
        hasColor: (c) => c === 'red', hasBlack: true, hasGold: false,
      })
      expect(result.canPlayStrong).toBe(true)

      // Gold + black
      result = validateCardPlay(card, 'night', {
        hasColor: () => false, hasBlack: true, hasGold: true,
      })
      expect(result.canPlayStrong).toBe(true)
    })
  })

  describe('Spell Cards', () => {
    it('basic spell requires matching color mana', () => {
      const spell = makeSpell({ color: 'red' })

      let result = validateCardPlay(spell, 'day', {
        hasColor: () => false, hasBlack: false, hasGold: false,
      })
      expect(result.canPlayBasic).toBe(false)

      result = validateCardPlay(spell, 'day', {
        hasColor: (c) => c === 'red', hasBlack: false, hasGold: false,
      })
      expect(result.canPlayBasic).toBe(true)
    })

    it('strong spell impossible during day, available at night with matching mana', () => {
      const spell = makeSpell({ color: 'red' })

      // Day: strong impossible
      let result = validateCardPlay(spell, 'day', {
        hasColor: (c) => c === 'red', hasBlack: true, hasGold: true,
      })
      expect(result.canPlayStrong).toBe(false)

      // Night: strong with matching color
      result = validateCardPlay(spell, 'night', {
        hasColor: (c) => c === 'red', hasBlack: false, hasGold: false,
      })
      expect(result.canPlayStrong).toBe(true)
    })
  })

  describe('Night + Gold Wildcard', () => {
    it('gold mana substitutes for color at night (action strong)', () => {
      const card = makeBasicAction({ color: 'red' })
      const result = validateCardPlay(card, 'night', {
        hasColor: () => false, hasBlack: true, hasGold: true,
      })
      expect(result.canPlayStrong).toBe(true) // gold replaces red, black present
    })

    it('gold mana substitutes for color at night (spell strong)', () => {
      const spell = makeSpell({ color: 'blue' })
      const result = validateCardPlay(spell, 'night', {
        hasColor: () => false, hasBlack: false, hasGold: true,
      })
      expect(result.canPlayStrong).toBe(true) // gold replaces blue, no black needed for spell
    })
  })

  describe('Artifact Cards', () => {
    it('basic and strong always playable regardless of mana', () => {
      const artifact = makeArtifact()
      const result = validateCardPlay(artifact, 'day', {
        hasColor: () => false, hasBlack: false, hasGold: false,
      })
      expect(result.canPlayBasic).toBe(true)
      expect(result.canPlayStrong).toBe(true)
    })

    it('artifact strong playable at night without black mana', () => {
      const artifact = makeArtifact()
      const result = validateCardPlay(artifact, 'night', {
        hasColor: () => false, hasBlack: false, hasGold: false,
      })
      expect(result.canPlayStrong).toBe(true)
    })
  })

  describe('Sideways Play', () => {
    it('produces 1 physical point of chosen effect', () => {
      const card = makeBasicAction()

      // Move sideways
      let validation = validateSidewaysPlay(card, 'move')
      expect(validation.valid).toBe(true)
      let effect = resolver.resolveSideways('move')
      expect(effect.movePointsDelta).toBe(1)

      // Influence sideways
      validation = validateSidewaysPlay(card, 'influence')
      expect(validation.valid).toBe(true)
      effect = resolver.resolveSideways('influence')
      expect(effect.influenceValue).toBe(1)

      // Attack sideways (only melee phase)
      validation = validateSidewaysPlay(card, 'attack', 'attack')
      expect(validation.valid).toBe(true)
      effect = resolver.resolveSideways('attack')
      expect(effect.attackValue).toBe(1)
      expect(effect.attackElement).toBe('physical')
    })

    it('sideways attack invalid during ranged/siege phase', () => {
      const card = makeBasicAction()
      const validation = validateSidewaysPlay(card, 'attack', 'ranged_siege')
      expect(validation.valid).toBe(false)
    })

    it('artifact cards can be played sideways', () => {
      const artifact = makeArtifact()
      const validation = validateSidewaysPlay(artifact, 'move')
      expect(validation.valid).toBe(true)
      expect(validation.element).toBe('physical')
    })

    it('wound cards cannot be played sideways', () => {
      const wound = { type: 'wound' as const, id: 'wound_1' }
      const validation = validateSidewaysPlay(wound, 'move')
      expect(validation.valid).toBe(false)
    })
  })

  describe('CardEffectResolver accumulation', () => {
    it('accumulates multiple card effects of same type', () => {
      const march = makeBasicAction()
      const march2 = makeBasicAction({ id: 2, name: 'Stamina', color: 'blue' })

      const r1 = resolver.resolveEffect(march.basicEffect, 'day')
      const r2 = resolver.resolveEffect(march2.basicEffect, 'day')
      const combined = resolver.accumulateResolutions([r1, r2])

      expect(combined.movePointsDelta).toBe(4) // 2 + 2
    })

    it('last non-physical element wins in accumulation', () => {
      const iceAttack = makeAdvancedAction({
        basicEffect: { text: 'Attack 3 Ice', actions: [{ type: 'attack', value: 3, element: 'ice' }] },
      })
      const fireAttack = makeAdvancedAction({
        basicEffect: { text: 'Attack 2 Fire', actions: [{ type: 'attack', value: 2, element: 'fire' }] },
      })

      const r1 = resolver.resolveEffect(iceAttack.basicEffect, 'day')
      const r2 = resolver.resolveEffect(fireAttack.basicEffect, 'day')
      const combined = resolver.accumulateResolutions([r1, r2])

      expect(combined.attackValue).toBe(5)
      expect(combined.attackElement).toBe('fire') // last non-physical wins
    })

    it('sideways + normal card effects combine', () => {
      const march = makeBasicAction()
      const r1 = resolver.resolveEffect(march.basicEffect, 'day')
      const r2 = resolver.resolveSideways('move')
      const combined = resolver.accumulateResolutions([r1, r2])

      expect(combined.movePointsDelta).toBe(3) // 2 + 1
    })
  })
})

// ═══════════════════════════════════════════════════════════════════
// US-002: Full Combat Flow with Cards and Units
// ═══════════════════════════════════════════════════════════════════

describe('US-002: Full Combat Flow with Cards and Units', () => {
  let random: SeededRandom
  let combat: CombatResolver
  let unitMgr: UnitManager
  let resolver: CardEffectResolver

  beforeEach(() => {
    random = new SeededRandom(42)
    combat = new CombatResolver(random)
    unitMgr = new UnitManager()
    resolver = new CardEffectResolver()
  })

  it('complete combat flow: initiate → ranged → block → damage → melee → end', () => {
    const orc = makeEnemy({ armor: 3, attack: 3, fameReward: 2 })
    const wolf = makeEnemy({ id: 2, name: 'Wolf', armor: 2, attack: 4, fameReward: 3, abilities: ['swift'] })

    // Phase 1: Initiate combat
    let state = combat.initiateCombat([orc, wolf], false)
    expect(state.isActive).toBe(true)
    expect(state.phase).toBe('ranged_siege')
    expect(state.enemies).toHaveLength(2)
    expect(state.reputationChange).toBe(0)

    // Phase 2: Ranged/siege — kill the orc with ranged fire attack (using Fireball spell)
    const fireballEffect = resolver.resolveEffect(
      makeSpell().basicSpell, 'day',
    )
    expect(fireballEffect.attackValue).toBe(3)

    state = combat.resolveRangedSiegeAttack(state, [{
      id: 'atk_ranged_1',
      targetEnemyIds: [state.enemies[0].instanceId],
      attackValue: 3,
      attackElement: 'fire',
      isSiege: false,
      isRanged: true,
      cardIds: ['spell_fireball'],
      unitIds: [],
    }])
    expect(state.phase).toBe('block')
    expect(state.enemies[0].isDefeated).toBe(true) // armor 3, attack 3 fire >= 3
    expect(state.enemies[1].isDefeated).toBe(false) // wolf still alive

    // Phase 3: Block — wolf is swift (requires double block value: 4*2=8)
    state = combat.resolveBlock(state, [{
      enemyInstanceId: state.enemies[1].instanceId,
      blockValue: 8,
      blockElement: 'physical',
      cardIds: ['shield_card'],
      unitIds: [],
      isSuccessful: false, // will be computed by resolver
    }])
    expect(state.phase).toBe('assign_damage')
    expect(state.enemies[1].isBlocked).toBe(true) // 8 >= 4*2

    // Phase 4: No unblocked damage
    const unblockedDmg = combat.calculateUnblockedDamage(state)
    expect(unblockedDmg).toHaveLength(0) // orc dead, wolf blocked

    state = combat.assignDamage({ ...state, phase: 'assign_damage' }, [])

    // Phase 5: Melee — no remaining enemies to attack
    state = combat.resolveMeleeAttack({ ...state, phase: 'attack' }, [])
    expect(state.phase).toBe('combat_end')

    // End combat
    const endState = combat.endCombat(state)
    expect(endState.isActive).toBe(false)
    expect(endState.fameEarned).toBe(2) // only orc was defeated (fame 2)
  })

  it('siege attack defeats fortified enemy', () => {
    // Enemy without innate fortified, but site is fortified → single fortified
    const guardian = makeEnemy({
      id: 3, name: 'Guardian', armor: 4, attack: 5,
      abilities: [], fameReward: 4,
    })

    let state = combat.initiateCombat([guardian], true) // fortified site adds fortified
    expect(state.enemies[0].isFortified).toBe(true)

    // Non-siege ranged: should NOT work on fortified
    state = combat.resolveRangedSiegeAttack(state, [{
      id: 'atk_1', targetEnemyIds: [state.enemies[0].instanceId],
      attackValue: 10, attackElement: 'physical',
      isSiege: false, isRanged: true, cardIds: [], unitIds: [],
    }])
    expect(state.enemies[0].isDefeated).toBe(false)

    // Siege ranged: should work
    state = combat.resolveRangedSiegeAttack(state, [{
      id: 'atk_2', targetEnemyIds: [state.enemies[0].instanceId],
      attackValue: 4, attackElement: 'physical',
      isSiege: true, isRanged: true, cardIds: [], unitIds: [],
    }])
    expect(state.enemies[0].isDefeated).toBe(true)
    expect(state.fameEarned).toBe(4)
  })

  it('unit activation in combat contributes attack value', () => {
    const peasant = makeUnit()
    let units: UnitInstance[] = unitMgr.recruitUnit([], peasant, 3)
    expect(units[0].status).toBe('ready')

    // Activate unit
    units = unitMgr.activateUnit(units, 0)
    expect(units[0].status).toBe('spent')

    // Use unit's attack ability value in melee
    const unitAbilityEffect = resolver.resolveEffect(
      { text: 'Attack 2', actions: peasant.abilities[0].actions },
      'day',
    )
    expect(unitAbilityEffect.attackValue).toBe(2)

    // Combine card + unit attack
    const cardAttack = resolver.resolveEffect(
      makeBasicAction({
        basicEffect: { text: 'Attack 2', actions: [{ type: 'attack', value: 2 }] },
      }).basicEffect,
      'day',
    )
    const combined = resolver.accumulateResolutions([cardAttack, unitAbilityEffect])
    expect(combined.attackValue).toBe(4) // 2 card + 2 unit

    // Use combined attack to defeat enemy
    const orc = makeEnemy({ armor: 4, fameReward: 2 })
    let state = combat.initiateCombat([orc], false)
    state = combat.resolveRangedSiegeAttack(state, [])
    state = combat.resolveBlock(state, [])
    state = combat.assignDamage({ ...state, phase: 'assign_damage' }, [])
    state = combat.resolveMeleeAttack({ ...state, phase: 'attack' }, [{
      id: 'melee_1',
      targetEnemyIds: [state.enemies[0].instanceId],
      attackValue: 4,
      attackElement: 'physical',
      isSiege: false, isRanged: false,
      cardIds: ['attack_card'], unitIds: ['peasant_0'],
    }])
    expect(state.enemies[0].isDefeated).toBe(true)
  })

  it('unblocked damage with brutal doubles, poison wounds units', () => {
    const brutalEnemy = makeEnemy({
      id: 5, name: 'Dire Wolf', armor: 5, attack: 4,
      abilities: ['brutal', 'poison'], fameReward: 5,
    })

    let state = combat.initiateCombat([brutalEnemy], false)
    state = combat.resolveRangedSiegeAttack(state, [])
    state = combat.resolveBlock(state, []) // no blocks

    const unblocked = combat.calculateUnblockedDamage(state)
    expect(unblocked).toHaveLength(1)
    expect(unblocked[0].damage).toBe(8) // 4 * 2 (brutal)
    expect(unblocked[0].abilities).toContain('brutal')
    expect(unblocked[0].abilities).toContain('poison')
  })

  it('swift enemy: insufficient block value fails, sufficient succeeds', () => {
    const swiftWolf = makeEnemy({ id: 7, name: 'Swift Wolf', armor: 2, attack: 4, abilities: ['swift'], fameReward: 3 })
    let state = combat.initiateCombat([swiftWolf], false)
    state = combat.resolveRangedSiegeAttack(state, [])

    // Block with 4 (equal to attack but swift needs 2x = 8) → fails
    state = combat.resolveBlock(state, [{
      enemyInstanceId: state.enemies[0].instanceId,
      blockValue: 4, blockElement: 'physical',
      cardIds: [], unitIds: [], isSuccessful: false,
    }])
    expect(state.enemies[0].isBlocked).toBe(false)

    // Reset and try with sufficient block (8)
    let state2 = combat.initiateCombat([swiftWolf], false)
    state2 = combat.resolveRangedSiegeAttack(state2, [])
    state2 = combat.resolveBlock(state2, [{
      enemyInstanceId: state2.enemies[0].instanceId,
      blockValue: 8, blockElement: 'physical',
      cardIds: [], unitIds: [], isSuccessful: false,
    }])
    expect(state2.enemies[0].isBlocked).toBe(true)
  })

  it('poison damage wounds unit with double wound count', () => {
    const peasant = makeUnit()
    let units: UnitInstance[] = unitMgr.recruitUnit([], peasant, 3)

    // Poison damage causes 2 wounds instead of 1
    units = unitMgr.woundUnit(units, 0, true) // poisonDamage = true
    expect(units[0].status).toBe('wounded')
    expect(units[0].woundCount).toBe(2) // poison = 2 wounds

    // Non-poison damage causes 1 wound
    const peasant2 = makeUnit({ id: 51 })
    let units2: UnitInstance[] = unitMgr.recruitUnit([], peasant2, 3)
    units2 = unitMgr.woundUnit(units2, 0, false)
    expect(units2[0].woundCount).toBe(1) // normal = 1 wound
  })

  it('city combat: reputation -1 at start, city color bonuses apply', () => {
    // Red city: normal attackers get brutal
    const orc = makeEnemy({ attack: 3, attackType: 'normal', abilities: [] })
    const state = combat.initiateCombat([orc], false, 'red')

    expect(state.reputationChange).toBe(-1) // city assault penalty
    expect(state.enemies[0].appliedAbilities).toContain('brutal')
  })

  it('white city: +1 armor to all enemies', () => {
    const orc = makeEnemy({ armor: 3 })
    const state = combat.initiateCombat([orc], false, 'white')
    expect(state.enemies[0].currentArmor).toBe(4) // 3 + 1
  })

  it('fame earned from defeating multiple enemies sums correctly', () => {
    const enemies = [
      makeEnemy({ id: 1, armor: 2, fameReward: 2 }),
      makeEnemy({ id: 2, name: 'Wolf', armor: 2, fameReward: 3 }),
      makeEnemy({ id: 3, name: 'Guardian', armor: 2, fameReward: 5 }),
    ]

    let state = combat.initiateCombat(enemies, false)
    // Kill all in ranged
    state = combat.resolveRangedSiegeAttack(state, state.enemies.map((e, i) => ({
      id: `atk_${i}`,
      targetEnemyIds: [e.instanceId],
      attackValue: 5,
      attackElement: 'physical',
      isSiege: false, isRanged: true,
      cardIds: [], unitIds: [],
    })))

    expect(state.enemies.every(e => e.isDefeated)).toBe(true)
    expect(combat.getTotalFameEarned(state)).toBe(10) // 2+3+5
  })
})

// ═══════════════════════════════════════════════════════════════════
// US-003: Level Up Flow with Skill Acquisition
// ═══════════════════════════════════════════════════════════════════

describe('US-003: Level Up Flow with Skill Acquisition', () => {
  let levelMgr: LevelUpManager
  let skillMgr: SkillManager

  beforeEach(() => {
    levelMgr = new LevelUpManager()
    skillMgr = new SkillManager()
  })

  it('fame accumulation triggers level up at correct thresholds', () => {
    // Level 1: 0 fame, Level 2: 3 fame, Level 3: 8 fame, Level 4: 15 fame
    expect(levelMgr.getCurrentLevel(0)).toBe(1)
    expect(levelMgr.getCurrentLevel(2)).toBe(1)
    expect(levelMgr.getCurrentLevel(3)).toBe(2)
    expect(levelMgr.getCurrentLevel(7)).toBe(2)
    expect(levelMgr.getCurrentLevel(8)).toBe(3)
    expect(levelMgr.getCurrentLevel(15)).toBe(4)
  })

  it('addFame returns correct levelsGained for single level up', () => {
    const result = levelMgr.addFame(2, 1) // 2 + 1 = 3 → level 2
    expect(result.newFame).toBe(3)
    expect(result.newLevel).toBe(2)
    expect(result.levelsGained).toBe(1)
  })

  it('addFame returns correct levelsGained for multi-level jump', () => {
    const result = levelMgr.addFame(2, 13) // 2 + 13 = 15 → level 4
    expect(result.newFame).toBe(15)
    expect(result.newLevel).toBe(4)
    expect(result.levelsGained).toBe(3) // from 1 to 4
  })

  it('level up rewards alternate: AA+skill at even levels, stat_boost at odd', () => {
    // Level 2: advanced_action_and_skill
    const r2 = levelMgr.getLevelUpReward(2)
    expect(r2.type).toBe('advanced_action_and_skill')
    expect(r2.newUnitLimit).toBe(2)

    // Level 3: stat_boost
    const r3 = levelMgr.getLevelUpReward(3)
    expect(r3.type).toBe('stat_boost')
    expect(r3.newArmor).toBe(3)

    // Level 4: advanced_action_and_skill
    const r4 = levelMgr.getLevelUpReward(4)
    expect(r4.type).toBe('advanced_action_and_skill')
    expect(r4.newUnitLimit).toBe(3)

    // Level 5: stat_boost
    const r5 = levelMgr.getLevelUpReward(5)
    expect(r5.type).toBe('stat_boost')
    expect(r5.newHandLimit).toBe(6)
  })

  it('processLevelUp returns correct rewards for multi-level jumps', () => {
    const rewards = levelMgr.processLevelUp(1, 4) // 1→4
    expect(rewards).toHaveLength(3)
    expect(rewards[0].type).toBe('advanced_action_and_skill') // level 2
    expect(rewards[1].type).toBe('stat_boost') // level 3
    expect(rewards[2].type).toBe('advanced_action_and_skill') // level 4
  })

  it('armor/handLimit/unitLimit progression matches table', () => {
    // Level 1: armor=2, hand=5, units=1
    const r1 = levelMgr.getLevelUpReward(1)
    expect(r1.newArmor).toBe(2)
    expect(r1.newHandLimit).toBe(5)
    expect(r1.newUnitLimit).toBe(1)

    // Level 7: armor=4, hand=6, units=4
    const r7 = levelMgr.getLevelUpReward(7)
    expect(r7.newArmor).toBe(4)
    expect(r7.newHandLimit).toBe(6)
    expect(r7.newUnitLimit).toBe(4)
  })

  describe('Skill Acquisition', () => {
    it('Choice A: take from player deck, other goes to common', () => {
      const playerDeck: HeroSkill[] = [
        makeSkill({ id: 1, name: 'Skill A' }),
        makeSkill({ id: 2, name: 'Skill B' }),
        makeSkill({ id: 3, name: 'Skill C' }),
      ]
      const commonSkills: HeroSkill[] = []

      const result = skillMgr.processSkillAcquisition(playerDeck, commonSkills, 'A', 0)

      expect(result.acquiredSkill.name).toBe('Skill A')
      expect(result.newCommonSkills).toHaveLength(1)
      expect(result.newCommonSkills[0].name).toBe('Skill B')
      expect(result.remainingPlayerDeck).toHaveLength(1)
      expect(result.remainingPlayerDeck[0].name).toBe('Skill C')
      expect(result.aaCardPosition).toBe('any')
    })

    it('Choice B: take from common skills, AA goes to bottom', () => {
      const playerDeck: HeroSkill[] = [
        makeSkill({ id: 1, name: 'Skill A' }),
        makeSkill({ id: 2, name: 'Skill B' }),
      ]
      const commonSkills: HeroSkill[] = [
        makeSkill({ id: 10, name: 'Common Skill X' }),
      ]

      const result = skillMgr.processSkillAcquisition(playerDeck, commonSkills, 'B', 0)

      expect(result.acquiredSkill.name).toBe('Common Skill X')
      expect(result.newCommonSkills).toHaveLength(2)
      expect(result.newCommonSkills.map(s => s.name)).toContain('Skill A')
      expect(result.newCommonSkills.map(s => s.name)).toContain('Skill B')
      expect(result.remainingPlayerDeck).toHaveLength(0)
      expect(result.aaCardPosition).toBe('bottom')
    })

    it('Choice B throws if common skills empty', () => {
      const playerDeck: HeroSkill[] = [makeSkill()]
      expect(() =>
        skillMgr.processSkillAcquisition(playerDeck, [], 'B', 0),
      ).toThrow('EC-09-A-1')
    })

    it('throws if player skill deck is empty', () => {
      expect(() =>
        skillMgr.processSkillAcquisition([], [], 'A', 0),
      ).toThrow('EC-09-A-2')
    })
  })

  describe('Skill activation and reset', () => {
    it('once_per_round skill flips after use, resets at round start', () => {
      let skills = [makeSkill({ type: 'once_per_round', isFlipped: false })]

      expect(skillMgr.canActivateSkill(skills[0])).toBe(true)
      skills = skillMgr.activateSkill(skills, 0, { isNewTurn: false })
      expect(skills[0].isFlipped).toBe(true)
      expect(skillMgr.canActivateSkill(skills[0])).toBe(false)

      skills = skillMgr.resetSkillsForRound(skills)
      expect(skills[0].isFlipped).toBe(false)
      expect(skillMgr.canActivateSkill(skills[0])).toBe(true)
    })

    it('once_per_turn skill resets at turn start', () => {
      let skills = [makeSkill({ type: 'once_per_turn', isUsedThisTurn: false })]

      skills = skillMgr.activateSkill(skills, 0, { isNewTurn: false })
      expect(skills[0].isUsedThisTurn).toBe(true)
      expect(skillMgr.canActivateSkill(skills[0])).toBe(false)

      skills = skillMgr.resetSkillsForTurn(skills)
      expect(skills[0].isUsedThisTurn).toBe(false)
      expect(skillMgr.canActivateSkill(skills[0])).toBe(true)
    })
  })
})

// ═══════════════════════════════════════════════════════════════════
// US-004: Interaction & Influence — Purchase Units, AA, Spells, Artifacts
// ═══════════════════════════════════════════════════════════════════

describe('US-004: Interaction & Influence — Purchasing', () => {
  let interactionMgr: InteractionManager
  let reputationMgr: ReputationManager
  let unitMgr: UnitManager
  let resolver: CardEffectResolver

  beforeEach(() => {
    interactionMgr = new InteractionManager()
    reputationMgr = new ReputationManager()
    unitMgr = new UnitManager()
    resolver = new CardEffectResolver()
  })

  describe('Village Interaction', () => {
    it('heal wounds at 3 influence each', () => {
      let state = interactionMgr.startInteraction(0, 'village', { q: 1, r: 0 })
      expect(state.isActive).toBe(true)

      // Add influence from cards
      state = interactionMgr.addInfluence(state, 6)
      expect(state.influencePool).toBe(6) // 0 rep modifier + 6

      // Heal 2 wounds (3 influence each)
      state = interactionMgr.spendInfluence(state, 3, 'healing', undefined, 'wound_1')
      state = interactionMgr.spendInfluence(state, 3, 'healing', undefined, 'wound_2')
      expect(state.influencePool).toBe(0)
      expect(state.purchasesMade).toHaveLength(2)
    })

    it('recruit village unit with sufficient influence', () => {
      const peasant = makeUnit({ cost: 3, recruitSites: ['village'] })
      let units: UnitInstance[] = []

      // Recruit
      units = unitMgr.recruitUnit(units, peasant, 1)
      expect(units).toHaveLength(1)
      expect(units[0].unit.name).toBe('Peasants')
      expect(units[0].status).toBe('ready')
    })

    it('village filters units to village-recruitable only', () => {
      const villageUnit = makeUnit({ id: 1, recruitSites: ['village'] })
      const keepUnit = makeUnit({ id: 2, name: 'Knights', recruitSites: ['keep'] })

      const filtered = interactionMgr.filterUnitsForSite(
        [villageUnit, keepUnit], 'village', false,
      )
      expect(filtered).toHaveLength(1)
      expect(filtered[0].name).toBe('Peasants')
    })
  })

  describe('Monastery Interaction', () => {
    it('heal at 2 influence, buy advanced action at 6 influence', () => {
      let state = interactionMgr.startInteraction(0, 'monastery', { q: 2, r: 0 })
      state = interactionMgr.addInfluence(state, 8)

      // Heal (2 influence)
      state = interactionMgr.spendInfluence(state, 2, 'healing')
      expect(state.influencePool).toBe(6)

      // Buy advanced action (6 influence)
      state = interactionMgr.spendInfluence(state, 6, 'advanced_action', 100, 'Crystal Mastery')
      expect(state.influencePool).toBe(0)
      expect(state.purchasesMade).toHaveLength(2)
      expect(state.purchasesMade[1].type).toBe('advanced_action')
      expect(state.purchasesMade[1].cost).toBe(6)
    })

    it('available actions include healing, AA, and unit recruitment', () => {
      const actions = interactionMgr.getAvailableActions('monastery')
      const types = actions.map(a => a.type)
      expect(types).toContain('healing')
      expect(types).toContain('advanced_action')
      expect(types).toContain('unit')
    })
  })

  describe('Mage Tower', () => {
    it('buy spell at 7 influence', () => {
      let state = interactionMgr.startInteraction(0, 'mageTower', { q: 3, r: 0 })
      state = interactionMgr.addInfluence(state, 7)

      state = interactionMgr.spendInfluence(state, 7, 'spell', 200, 'Fireball')
      expect(state.influencePool).toBe(0)
      expect(state.purchasesMade[0].type).toBe('spell')
    })
  })

  describe('City Interaction — Red (Artifacts)', () => {
    it('buy artifact at 12 influence in red city', () => {
      let state = interactionMgr.startInteraction(0, 'city', { q: 4, r: 0 }, 'red')
      state = interactionMgr.addInfluence(state, 12)

      state = interactionMgr.spendInfluence(state, 12, 'artifact', 300, 'Sword of Justice')
      expect(state.influencePool).toBe(0)
      expect(state.purchasesMade[0].type).toBe('artifact')
      expect(state.purchasesMade[0].cost).toBe(12)
    })

    it('red city available actions include artifact', () => {
      const actions = interactionMgr.getAvailableActions('city', 'red')
      expect(actions.some(a => a.type === 'artifact')).toBe(true)
    })
  })

  describe('Reputation & Influence', () => {
    it('positive reputation adds influence modifier', () => {
      // Reputation +3 → modifier +2
      let state = interactionMgr.startInteraction(3, 'village', { q: 0, r: 0 })
      expect(state.influencePool).toBe(2)

      // Reputation +5 → modifier +5
      state = interactionMgr.startInteraction(5, 'village', { q: 0, r: 0 })
      expect(state.influencePool).toBe(5)
    })

    it('negative reputation reduces influence', () => {
      // Reputation -2 → modifier -1
      let state = interactionMgr.startInteraction(-2, 'village', { q: 0, r: 0 })
      expect(state.influencePool).toBe(-1)

      // Reputation -3 → modifier -3
      state = interactionMgr.startInteraction(-3, 'village', { q: 0, r: 0 })
      expect(state.influencePool).toBe(-3)
    })

    it('very negative reputation prevents interaction', () => {
      expect(() =>
        interactionMgr.startInteraction(-5, 'village', { q: 0, r: 0 }),
      ).toThrow('Reputation too low')
    })

    it('not enough influence prevents purchase', () => {
      const state = interactionMgr.startInteraction(0, 'village', { q: 0, r: 0 })
      expect(interactionMgr.canPurchase(state, 3)).toBe(false) // pool is 0
    })
  })

  describe('Unit Recruitment Limits', () => {
    it('cannot recruit beyond unit limit', () => {
      const unit = makeUnit()
      let units = unitMgr.recruitUnit([], unit, 1)
      expect(() => unitMgr.recruitUnit(units, unit, 1)).toThrow('Unit limit reached')
    })

    it('can recruit after disbanding', () => {
      const unit1 = makeUnit({ id: 1, name: 'Peasants' })
      const unit2 = makeUnit({ id: 2, name: 'Herbalists' })

      let units = unitMgr.recruitUnit([], unit1, 1)
      units = unitMgr.disbandUnit(units, 0)
      expect(units).toHaveLength(0)

      units = unitMgr.recruitUnit(units, unit2, 1)
      expect(units).toHaveLength(1)
      expect(units[0].unit.name).toBe('Herbalists')
    })
  })

  describe('Influence from Cards', () => {
    it('influence cards accumulate via CardEffectResolver', () => {
      const card1 = makeInfluenceCard(2)
      const card2 = makeInfluenceCard(3)

      const r1 = resolver.resolveEffect(card1.basicEffect, 'day')
      const r2 = resolver.resolveEffect(card2.basicEffect, 'day')
      const combined = resolver.accumulateResolutions([r1, r2])

      expect(combined.influenceValue).toBe(5) // 2 + 3

      // Plus sideways influence
      const sideways = resolver.resolveSideways('influence')
      const total = resolver.accumulateResolutions([combined, sideways])
      expect(total.influenceValue).toBe(6) // 5 + 1
    })
  })
})

// ═══════════════════════════════════════════════════════════════════
// US-005: Full Multi-Round Game Flow Integration
// ═══════════════════════════════════════════════════════════════════

describe('US-005: Full Multi-Round Game Flow', () => {
  let random: SeededRandom
  let tm: TurnManager
  let pool: ManaPool
  let dm: DeckManager
  let combat: CombatResolver
  let levelMgr: LevelUpManager
  let repMgr: ReputationManager
  let unitMgr: UnitManager
  let interMgr: InteractionManager
  let skillMgr: SkillManager
  let dummyEngine: DummyPlayer
  let resolver: CardEffectResolver

  beforeEach(() => {
    random = new SeededRandom(42)
    tm = new TurnManager(random)
    pool = new ManaPool(random)
    dm = new DeckManager(random)
    combat = new CombatResolver(random)
    levelMgr = new LevelUpManager()
    repMgr = new ReputationManager()
    unitMgr = new UnitManager()
    interMgr = new InteractionManager()
    skillMgr = new SkillManager()
    dummyEngine = new DummyPlayer(random)
    resolver = new CardEffectResolver()
  })

  it('simulates complete 3-round game with all sub-systems', () => {
    // ── Setup ──────────────────────────────────────────────
    const setup = new ScenarioSetup(random)
    const config = setup.setupFirstReconnaissance()
    expect(config.totalRounds).toBe(3)
    expect(config.roundPattern).toEqual(['day', 'night', 'day'])

    const tactics = makeDayTactics()
    const nightTactics = [
      makeTactic(7, 1, 'night'), makeTactic(8, 2, 'night'),
      makeTactic(9, 3, 'night'), makeTactic(10, 4, 'night'),
      makeTactic(11, 5, 'night'), makeTactic(12, 6, 'night'),
    ]

    // Player state
    let playerFame = 0
    let playerLevel = 1
    let playerReputation = 0
    let playerUnits: UnitInstance[] = []
    let playerSkills: HeroSkill[] = []
    let commonSkills: HeroSkill[] = []
    const playerSkillDeck: HeroSkill[] = [
      makeSkill({ id: 1, name: 'Shield Training' }),
      makeSkill({ id: 2, name: 'Cold Mastery' }),
      makeSkill({ id: 3, name: 'Fire Mastery' }),
      makeSkill({ id: 4, name: 'Agility' }),
    ]

    // Build player deck (16 basic action cards)
    const deckCards: AnyCard[] = []
    for (let i = 0; i < 16; i++) {
      deckCards.push(makeBasicAction({ id: i, name: `Card_${i}` }))
    }
    let playerDeck = dm.initializeDeck(deckCards)
    playerDeck = dm.drawToHandLimit(playerDeck, 5)
    expect(playerDeck.hand).toHaveLength(5)

    // Initialize mana source (4 dice)
    let manaState = pool.initializeSource(4)
    expect(manaState.dice).toHaveLength(4)

    // Dummy player state
    const dummyCards: AnyCard[] = Array.from({ length: 16 }, (_, i) =>
      makeBasicAction({ id: 100 + i, name: `DummyCard_${i}` }),
    )
    let dummyState = dummyEngine.initializeDummy('Tovak', dummyCards)
    expect(dummyState.deedDeck.length).toBeGreaterThan(0)

    // ══════════════════════════════════════════════════════
    // ROUND 1 (DAY)
    // ══════════════════════════════════════════════════════

    let currentRound = 1
    let dayNight = config.roundPattern[0]
    expect(dayNight).toBe('day')

    // Skills reset at round start
    playerSkills = skillMgr.resetSkillsForRound(playerSkills)

    // Tactic selection
    const round1 = tm.startRound(1, dayNight, tactics)
    expect(round1.dayNight).toBe('day')

    const { selected: dummyTactic1, remaining: r1Remaining } = tm.selectTacticForDummy(round1.availableTactics)
    const { selected: playerTactic1 } = tm.selectTacticForPlayer(r1Remaining, r1Remaining[0].id)
    const order1 = tm.determineTurnOrder(playerTactic1, dummyTactic1)
    expect(['player_first', 'dummy_first']).toContain(order1)

    // ── Player Turn 1: Combat with Orc → earn fame ──
    let turnState = tm.startTurn({ ...playerDeck, ...({} as any) } as any, 1)
    // (We use TurnManager.startTurn with turn state)
    turnState = tm.startTurn({
      turnNumber: 0, turnType: 'regular', hasMovedThisTurn: false,
      hasActedThisTurn: false, cardsPlayedThisTurn: [],
      unitsActivatedThisTurn: [], sidewaysCardsPlayed: 0,
      movePointsAvailable: 0, movePointsSpent: 0,
      forcedCombat: false, endOfRoundDeclared: false,
    }, 1)
    expect(turnState.turnNumber).toBe(1)

    // Play a card for movement (basic effect)
    const moveCard = playerDeck.hand[0]
    expect(moveCard.type).not.toBe('wound')
    playerDeck = dm.playCard(playerDeck, 0)
    expect(playerDeck.playArea).toHaveLength(1)

    // Resolve movement
    const moveEffect = resolver.resolveEffect(
      (moveCard as any).basicEffect, 'day',
    )
    turnState = resolver.applyToTurnState(turnState, moveEffect)
    expect(turnState.movePointsAvailable).toBe(2)

    // Enter combat against orc
    const orc = makeEnemy({ armor: 3, attack: 3, fameReward: 2 })
    let combatState = combat.initiateCombat([orc], false)
    expect(combatState.phase).toBe('ranged_siege')

    // Skip ranged, block, take damage
    combatState = combat.resolveRangedSiegeAttack(combatState, [])
    combatState = combat.resolveBlock(combatState, [])

    // Assign damage: orc attacks for 3
    const dmgEntries = combat.calculateUnblockedDamage(combatState)
    expect(dmgEntries[0].damage).toBe(3)

    // Take damage as wounds
    const woundCount = Math.ceil(dmgEntries[0].damage / 2) // armor 2 → ceil(3/2) = 2 wounds conceptually
    // Simplified: assign all to hero
    combatState = combat.assignDamage({ ...combatState, phase: 'assign_damage' }, [{
      enemyInstanceId: dmgEntries[0].enemyInstanceId,
      totalDamage: 3,
      assignments: [{ targetType: 'hero', damageAbsorbed: 3, woundsInflicted: 2 }],
    }])

    // Melee: use remaining cards for attack
    const attackCard = playerDeck.hand[0]
    playerDeck = dm.playCard(playerDeck, 0)
    // Play sideways for 1 attack + card basic (2 move → we use it sideways for 1 attack)
    // Use 2 cards sideways + 1 basic attack effect to get 3+
    combatState = combat.resolveMeleeAttack({ ...combatState, phase: 'attack' }, [{
      id: 'melee_1',
      targetEnemyIds: [combatState.enemies[0].instanceId],
      attackValue: 3,
      attackElement: 'physical',
      isSiege: false, isRanged: false,
      cardIds: ['card_sideways'], unitIds: [],
    }])
    expect(combatState.enemies[0].isDefeated).toBe(true)

    // End combat, earn fame
    combatState = combat.endCombat(combatState)
    const fameResult1 = levelMgr.addFame(playerFame, combatState.fameEarned)
    playerFame = fameResult1.newFame
    expect(playerFame).toBe(2)
    expect(fameResult1.newLevel).toBe(1) // not enough for level 2

    // End turn: discard play area, reset turn state
    playerDeck = dm.discardPlayArea(playerDeck)
    manaState = pool.resetTurnState(manaState)

    // ── Dummy Turn 1 ──
    const dummyFlippedBefore1 = dummyState.cardsFlippedThisRound
    dummyState = dummyEngine.executeDummyTurn(dummyState)
    expect(dummyState.cardsFlippedThisRound).toBeGreaterThan(dummyFlippedBefore1)

    // ── Player Turn 2: Interaction at Village → recruit unit ──
    playerDeck = dm.drawToHandLimit(playerDeck, 5)

    // Play influence cards
    const influenceCard = makeInfluenceCard(3)
    const inflEffect = resolver.resolveEffect(influenceCard.basicEffect, 'day')
    expect(inflEffect.influenceValue).toBe(3)

    // Start village interaction (reputation 0 → modifier 0)
    let interactionState = interMgr.startInteraction(playerReputation, 'village', { q: 1, r: 0 })
    interactionState = interMgr.addInfluence(interactionState, inflEffect.influenceValue)
    expect(interactionState.influencePool).toBe(3)

    // Recruit unit (costs 3 influence)
    const peasant = makeUnit({ cost: 3 })
    const unitLimit = levelMgr.getLevelUpReward(playerLevel).newUnitLimit
    playerUnits = unitMgr.recruitUnit(playerUnits, peasant, unitLimit)
    interactionState = interMgr.spendInfluence(interactionState, 3, 'unit', peasant.id, peasant.name)
    expect(playerUnits).toHaveLength(1)
    expect(interactionState.influencePool).toBe(0)

    // End turn 2
    playerDeck = dm.discardPlayArea(playerDeck)

    // ── Dummy Turn 2 & remaining turns until round end ──
    dummyState = dummyEngine.executeDummyTurn(dummyState)

    // Declare end of round (simplified — player decides)
    // Process end of round
    let eor = tm.processEndOfRound({ currentRound: 1, totalRounds: 3, roundPattern: config.roundPattern })
    expect(eor.isGameOver).toBe(false)
    expect(eor.nextDayNight).toBe('night')

    // End of round: reshuffle deck, reroll mana, ready units
    playerDeck = dm.reshuffleDiscard({
      ...playerDeck,
      discardPile: [...playerDeck.discardPile, ...playerDeck.hand],
      hand: [],
    })
    manaState = pool.rerollSource(manaState)
    playerUnits = unitMgr.readyAllUnits(playerUnits)
    expect(playerUnits[0].status).toBe('ready')

    // ══════════════════════════════════════════════════════
    // ROUND 2 (NIGHT) — Night-specific rules
    // ══════════════════════════════════════════════════════

    currentRound = 2
    dayNight = config.roundPattern[1]
    expect(dayNight).toBe('night')

    // Skills reset at round start
    playerSkills = skillMgr.resetSkillsForRound(playerSkills)

    // Tactic selection (night tactics)
    const round2 = tm.startRound(2, 'night', nightTactics)
    const { selected: dummyTactic2, remaining: r2Remaining } = tm.selectTacticForDummy(round2.availableTactics)
    const { selected: playerTactic2 } = tm.selectTacticForPlayer(r2Remaining, r2Remaining[0].id)

    // Draw hand
    playerDeck = dm.drawToHandLimit(playerDeck, 5)

    // ── Night rules test: Spell strong is available at night ──
    const fireSpell = makeSpell({ color: 'red' })
    const nightSpellCheck = validateCardPlay(fireSpell, 'night', {
      hasColor: (c) => c === 'red', hasBlack: false, hasGold: false,
    })
    expect(nightSpellCheck.canPlayStrong).toBe(true) // spell strong OK at night

    // ── Night rules: Action strong requires black + color mana ──
    const greenAction = makeBasicAction({ color: 'green' })
    const nightActionCheck = validateCardPlay(greenAction, 'night', {
      hasColor: (c) => c === 'green', hasBlack: false, hasGold: false,
    })
    expect(nightActionCheck.canPlayStrong).toBe(false) // needs black too
    expect(nightActionCheck.requiresBlackMana).toBe(true)

    const nightActionWithBlack = validateCardPlay(greenAction, 'night', {
      hasColor: (c) => c === 'green', hasBlack: true, hasGold: false,
    })
    expect(nightActionWithBlack.canPlayStrong).toBe(true)

    // ── Player Turn: Combat + earn enough fame for level up ──
    const elite = makeEnemy({ id: 10, name: 'Ice Dragon', armor: 5, attack: 6, fameReward: 8 })
    combatState = combat.initiateCombat([elite], false)

    // Use unit in combat
    playerUnits = unitMgr.activateUnit(playerUnits, 0)
    expect(playerUnits[0].status).toBe('spent')

    // Ranged → block → damage → melee with combined card + unit
    combatState = combat.resolveRangedSiegeAttack(combatState, [])
    combatState = combat.resolveBlock(combatState, [])
    // Take 6 damage (assign to hero)
    combatState = combat.assignDamage({ ...combatState, phase: 'assign_damage' }, [{
      enemyInstanceId: combatState.enemies[0].instanceId,
      totalDamage: 6,
      assignments: [{ targetType: 'hero', damageAbsorbed: 6, woundsInflicted: 3 }],
    }])
    // Melee attack with 5 physical to match armor 5
    combatState = combat.resolveMeleeAttack({ ...combatState, phase: 'attack' }, [{
      id: 'melee_dragon',
      targetEnemyIds: [combatState.enemies[0].instanceId],
      attackValue: 5,
      attackElement: 'physical',
      isSiege: false, isRanged: false,
      cardIds: ['multiple_cards'], unitIds: ['peasant'],
    }])
    expect(combatState.enemies[0].isDefeated).toBe(true)

    combatState = combat.endCombat(combatState)
    const fameResult2 = levelMgr.addFame(playerFame, combatState.fameEarned)
    playerFame = fameResult2.newFame
    expect(playerFame).toBe(10) // 2 + 8 = 10

    // Level up check: fame 10 → level 3 (threshold 8)
    expect(fameResult2.newLevel).toBe(3)
    expect(fameResult2.levelsGained).toBe(2) // from 1 to 3

    // Process level ups
    const levelRewards = levelMgr.processLevelUp(playerLevel, fameResult2.newLevel)
    expect(levelRewards).toHaveLength(2)
    expect(levelRewards[0].type).toBe('advanced_action_and_skill') // level 2
    expect(levelRewards[1].type).toBe('stat_boost') // level 3

    // Skill acquisition for level 2 reward
    const skillResult = skillMgr.processSkillAcquisition(
      playerSkillDeck, commonSkills, 'A', 0,
    )
    playerSkills = [...playerSkills, skillResult.acquiredSkill]
    commonSkills = skillResult.newCommonSkills
    expect(playerSkills).toHaveLength(1)
    expect(playerSkills[0].name).toBe('Shield Training')

    playerLevel = fameResult2.newLevel
    const lvl3Stats = levelMgr.getLevelUpReward(3)
    expect(lvl3Stats.newArmor).toBe(3) // armor goes up at level 3
    expect(lvl3Stats.newUnitLimit).toBe(2) // can now hold 2 units

    // End turn, discard
    playerDeck = dm.discardPlayArea(playerDeck)
    manaState = pool.resetTurnState(manaState)

    // ── Dummy turns ──
    dummyState = dummyEngine.executeDummyTurn(dummyState)

    // End Round 2
    eor = tm.processEndOfRound({ currentRound: 2, totalRounds: 3, roundPattern: config.roundPattern })
    expect(eor.isGameOver).toBe(false)
    expect(eor.nextDayNight).toBe('day')

    // Round end processing
    playerDeck = dm.reshuffleDiscard({
      ...playerDeck,
      discardPile: [...playerDeck.discardPile, ...playerDeck.hand],
      hand: [],
    })
    manaState = pool.rerollSource(manaState)
    playerUnits = unitMgr.readyAllUnits(playerUnits)
    playerSkills = skillMgr.resetSkillsForRound(playerSkills)

    // ══════════════════════════════════════════════════════
    // ROUND 3 (DAY) — Final round → Game Over
    // ══════════════════════════════════════════════════════

    currentRound = 3
    dayNight = config.roundPattern[2]
    expect(dayNight).toBe('day')

    const round3 = tm.startRound(3, 'day', tactics)
    const { selected: dummyTactic3, remaining: r3Remaining } = tm.selectTacticForDummy(round3.availableTactics)
    const { selected: playerTactic3 } = tm.selectTacticForPlayer(r3Remaining, r3Remaining[0].id)

    playerDeck = dm.drawToHandLimit(playerDeck, 5)

    // ── Player Turn: Interaction at monastery → buy advanced action ──
    const influenceCards = [makeInfluenceCard(3), makeInfluenceCard(3)]
    const totalInfluence = influenceCards.reduce((sum, c) => {
      const eff = resolver.resolveEffect(c.basicEffect, 'day')
      return sum + eff.influenceValue
    }, 0)
    expect(totalInfluence).toBe(6)

    let monasteryState = interMgr.startInteraction(playerReputation, 'monastery', { q: 3, r: 0 })
    monasteryState = interMgr.addInfluence(monasteryState, totalInfluence)
    expect(monasteryState.influencePool).toBe(6)

    // Buy advanced action (6 influence)
    monasteryState = interMgr.spendInfluence(monasteryState, 6, 'advanced_action', 100, 'Crystal Mastery')
    expect(monasteryState.purchasesMade[0].type).toBe('advanced_action')
    expect(monasteryState.influencePool).toBe(0)

    // End turns, dummy plays
    playerDeck = dm.discardPlayArea(playerDeck)
    dummyState = dummyEngine.executeDummyTurn(dummyState)

    // End Round 3 → Game Over
    eor = tm.processEndOfRound({ currentRound: 3, totalRounds: 3, roundPattern: config.roundPattern })
    expect(eor.isGameOver).toBe(true)

    // Phase advances to game_over
    const finalPhase = tm.advancePhase('end_of_round', { gameEnding: true })
    expect(finalPhase).toBe('game_over')

    // ══════════════════════════════════════════════════════
    // SCORING
    // ══════════════════════════════════════════════════════

    const scorer = new ScoringCalculator()
    // Verify final state
    expect(playerFame).toBe(10)
    expect(playerLevel).toBe(3)
    expect(playerUnits).toHaveLength(1)
    expect(playerSkills).toHaveLength(1)

    // Calculate final score
    const finalScore = scorer.calculateSoloConquestScore({
      playerName: 'Arythea',
      fame: playerFame,
      citiesConquered: 0,
      totalCities: 1,
      allCitiesConquered: false,
      roundsRemaining: 0, // used all 3 rounds
      dummyRemainingCards: dummyState.deedDeck.length,
      didNotDeclareEndOfRound: false,
    })

    expect(finalScore.playerName).toBe('Arythea')
    expect(finalScore.baseFame).toBe(10)
    expect(finalScore.totalScore).toBeGreaterThanOrEqual(10) // fame + achievements
    // Dummy remaining cards bonus
    if (dummyState.deedDeck.length > 0) {
      expect(finalScore.achievements.some(a => a.category === 'Dummy Remaining Cards')).toBe(true)
    }

    // Score rating
    const rating = scorer.getScoreRating(finalScore.totalScore)
    expect(typeof rating).toBe('string')
    expect(rating.length).toBeGreaterThan(0)

    // The game completed all 3 rounds successfully
    expect(currentRound).toBe(3)
  })

  it('end of round correctly processes all sub-systems', () => {
    // Setup minimal state
    let mana = pool.initializeSource(4)
    let units: UnitInstance[] = [
      { unit: makeUnit(), status: 'spent', woundCount: 0 },
    ]
    let skills: HeroSkill[] = [
      makeSkill({ type: 'once_per_round', isFlipped: true }),
      makeSkill({ id: 2, name: 'Quick Reflexes', type: 'once_per_turn', isUsedThisTurn: true }),
    ]
    const deckCards: AnyCard[] = Array.from({ length: 10 }, (_, i) =>
      makeBasicAction({ id: i }),
    )
    let deck = dm.initializeDeck(deckCards)
    deck = dm.drawCards(deck, 5)
    deck = dm.playCard(deck, 0)
    deck = dm.playCard(deck, 0)

    // Simulate end of round processing
    // 1. Discard play area + hand
    deck = dm.discardPlayArea(deck)
    deck = {
      ...deck,
      discardPile: [...deck.discardPile, ...deck.hand],
      hand: [],
    }
    // 2. Reshuffle
    deck = dm.reshuffleDiscard(deck)
    expect(deck.drawPile.length).toBe(10)
    expect(deck.discardPile).toHaveLength(0)
    expect(deck.hand).toHaveLength(0)

    // 3. Reroll mana source
    mana = pool.rerollSource(mana)
    expect(mana.dice).toHaveLength(4)
    expect(mana.dice.every(d => d.isInSource)).toBe(true)

    // 4. Ready all units
    units = unitMgr.readyAllUnits(units)
    expect(units[0].status).toBe('ready')

    // 5. Reset skills
    skills = skillMgr.resetSkillsForRound(skills)
    expect(skills[0].isFlipped).toBe(false)
    // once_per_turn resets at turn start, not round start
    expect(skills[1].isUsedThisTurn).toBe(true) // unchanged by resetSkillsForRound
  })

  it('dummy player turns execute correctly', () => {
    const dummyCards: AnyCard[] = Array.from({ length: 10 }, (_, i) =>
      makeBasicAction({ id: i }),
    )
    let state = dummyEngine.initializeDummy('Tovak', dummyCards)
    expect(state.hasEndedRound).toBe(false)

    // Execute multiple turns
    for (let i = 0; i < 5; i++) {
      state = dummyEngine.executeDummyTurn(state)
      if (state.hasEndedRound) break
    }

    expect(state.cardsFlippedThisRound).toBeGreaterThan(0)
  })

  it('phase transitions follow correct game flow', () => {
    // setup → round_start → tactic_selection → player_turn_start
    let phase = tm.advancePhase('setup', {})
    expect(phase).toBe('round_start')
    phase = tm.advancePhase('round_start', {})
    expect(phase).toBe('tactic_selection')
    phase = tm.advancePhase('tactic_selection', {})
    expect(phase).toBe('player_turn_start')

    // player_turn_start → movement → action_declaration
    phase = tm.advancePhase('player_turn_start', {})
    expect(phase).toBe('movement')
    phase = tm.advancePhase('movement', {})
    expect(phase).toBe('action_declaration')

    // action_declaration → combat flow
    phase = tm.advancePhase('action_declaration', { enteredCombat: true })
    expect(phase).toBe('combat_ranged_siege')
    phase = tm.advancePhase('combat_ranged_siege', {})
    expect(phase).toBe('combat_block')
    phase = tm.advancePhase('combat_block', {})
    expect(phase).toBe('combat_assign_damage')
    phase = tm.advancePhase('combat_assign_damage', {})
    expect(phase).toBe('combat_attack')
    phase = tm.advancePhase('combat_attack', {})
    expect(phase).toBe('combat_end')

    // combat_end → level_up (if leveled) → end_of_turn
    phase = tm.advancePhase('combat_end', { leveledUp: true })
    expect(phase).toBe('level_up')
    phase = tm.advancePhase('level_up', {})
    expect(phase).toBe('end_of_turn')

    // end_of_turn → end_of_round (if round ending) → game_over
    phase = tm.advancePhase('end_of_turn', { roundEnding: true })
    expect(phase).toBe('end_of_round')
    phase = tm.advancePhase('end_of_round', { gameEnding: true })
    expect(phase).toBe('game_over')
  })

  it('action_declaration → interaction flow (non-combat)', () => {
    let phase = tm.advancePhase('action_declaration', { enteredCombat: false })
    expect(phase).toBe('interaction')
    phase = tm.advancePhase('interaction', {})
    expect(phase).toBe('end_of_turn')
  })

  it('resting skips to end_of_turn', () => {
    const phase = tm.advancePhase('player_turn_start', { isResting: true })
    expect(phase).toBe('end_of_turn')
  })
})
