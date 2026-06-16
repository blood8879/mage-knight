// ═══════════════════════════════════════════
// Gameplay Completion Tests — 2026-06-10
// Covers the engine paths added to make a full
// playthrough possible from the UI:
//  - Fame gain → pending level-up queue (UNIT-10)
//  - Combat site rewards (UNIT-07-G)
//  - Rampaging hex detection (UNIT-05-B)
//  - Healing accumulation on the turn (EC-02 healing)
// ═══════════════════════════════════════════

import { describe, test, expect } from 'vitest'
import { SeededRandom } from '@/utils/random'
import { ManaPool } from '@/engine/ManaPool'
import { LevelUpManager } from '@/engine/LevelUpManager'
import { CardEffectResolver } from '@/engine/CardEffectResolver'
import { applyFameGain, buildSiteRewards, isRampagingHex } from '@/hooks/useGameEngine'
import type { EngineRefs } from '@/hooks/useGameEngine'
import type { GameState } from '@/engine/GameState'
import { INITIAL_TURN_STATE, INITIAL_MANA_POOL, INITIAL_COMBAT_STATE } from '@/engine/GameState'
import type { HeroSkill, ArtifactCard, HexCell, EnemyToken } from '@/engine/types'

function makeSkill(id: number, name: string): HeroSkill {
  return { id, name, type: 'once_per_turn', effect: '', actions: [], isFlipped: false, isUsedThisTurn: false }
}

function makeArtifact(id: number, name: string): ArtifactCard {
  return {
    id,
    name,
    type: 'artifact',
    basicEffect: { text: '', actions: [] },
    strongEffect: { text: '', actions: [] },
    set: 'base',
  }
}

function makeEnemy(): EnemyToken {
  return {
    id: 1, name: 'Orc', color: 'green', category: 'marauding',
    armor: 3, attack: 4, attackType: 'normal', abilities: [], fameReward: 2, copies: 1, set: 'base',
  }
}

function makeEngine(seed = 42): EngineRefs {
  const random = new SeededRandom(seed)
  return {
    random,
    manaPool: new ManaPool(random),
    levelUpManager: new LevelUpManager(),
  } as unknown as EngineRefs
}

function makeState(overrides: Partial<GameState['player']> = {}): GameState {
  return {
    phase: 'player_turn_start',
    round: 1,
    totalRounds: 3,
    dayNight: 'day',
    roundPattern: ['day', 'night', 'day'],
    player: {
      name: 'Arythea',
      heroName: 'Arythea',
      deck: { drawPile: [], hand: [], playArea: [], discardPile: [] },
      fame: 0,
      reputation: 0,
      level: 1,
      armor: 2,
      handLimit: 5,
      unitLimit: 1,
      units: [],
      mana: { ...INITIAL_MANA_POOL },
      skills: [],
      commonSkillsAvailable: [],
      skillDeck: [makeSkill(1, 'S1'), makeSkill(2, 'S2'), makeSkill(3, 'S3'), makeSkill(4, 'S4')],
      currentTactic: null,
      position: { q: 0, r: 0 },
      turn: { ...INITIAL_TURN_STATE },
      conqueredSites: [],
      levelTokens: [],
      ...overrides,
    },
    dummyPlayer: {
      heroName: 'Norowas', deedDeck: [], discardPile: [],
      crystals: { red: 0, blue: 0, green: 0, white: 0 },
      tacticCard: null, hasEndedRound: false, cardsFlippedThisRound: 0,
    },
    map: { tiles: [], tileDeck: [], hexGrid: new Map() },
    offers: {
      advancedActions: [], spells: [], units: [],
      advancedActionDeck: [], spellDeck: [], regularUnitDeck: [], eliteUnitDeck: [], artifactDeck: [],
    },
    combat: { ...INITIAL_COMBAT_STATE },
    interaction: null,
    availableTactics: [],
    usedTactics: [],
    enemyPools: {
      green: [], grey: [], violet: [], brown: [], red: [], white: [],
      discarded: { green: [], grey: [], violet: [], brown: [], red: [], white: [] },
    },
    seed: 1,
    turnCount: 1,
    isGameOver: false,
    finalScore: null,
    pendingLevelUps: [],
    pendingRewards: [],
    log: [],
  }
}

// ═══════════════════════════════════════════
// UNIT-10: applyFameGain
// ═══════════════════════════════════════════
describe('applyFameGain (UNIT-10)', () => {
  test('fame below the level threshold queues nothing', () => {
    const result = applyFameGain(makeEngine(), makeState(), 2)
    expect(result.player.fame).toBe(2)
    expect(result.player.level).toBe(1)
    expect(result.pendingLevelUps).toHaveLength(0)
  })

  test('crossing level 2 queues a skill+AA reward with 2 revealed skills', () => {
    const result = applyFameGain(makeEngine(), makeState(), 4)
    expect(result.player.fame).toBe(4)
    expect(result.player.level).toBe(2)
    expect(result.player.unitLimit).toBe(2) // level 2 stat row
    expect(result.pendingLevelUps).toHaveLength(1)
    const pending = result.pendingLevelUps![0]
    expect(pending.level).toBe(2)
    expect(pending.rewardType).toBe('advanced_action_and_skill')
    expect(pending.revealedSkills.map(s => s.id)).toEqual([1, 2])
  })

  test('EC-10-A-1: multiple level-ups queue in order with non-overlapping skill reveals', () => {
    // 0 → 16 fame crosses level 2 (3), 3 (8), and 4 (15)
    const result = applyFameGain(makeEngine(), makeState(), 16)
    expect(result.player.level).toBe(4)
    expect(result.pendingLevelUps!.map(p => p.level)).toEqual([2, 3, 4])
    expect(result.pendingLevelUps![0].rewardType).toBe('advanced_action_and_skill')
    expect(result.pendingLevelUps![1].rewardType).toBe('stat_boost')
    expect(result.pendingLevelUps![2].rewardType).toBe('advanced_action_and_skill')
    // Level 2 reveals skills 1,2 — level 4 must reveal 3,4 (no overlap)
    expect(result.pendingLevelUps![0].revealedSkills.map(s => s.id)).toEqual([1, 2])
    expect(result.pendingLevelUps![2].revealedSkills.map(s => s.id)).toEqual([3, 4])
    // Stats follow the highest level reached
    expect(result.player.armor).toBe(3)
    expect(result.player.unitLimit).toBe(3)
  })

  test('zero fame gain is a no-op', () => {
    const state = makeState()
    expect(applyFameGain(makeEngine(), state, 0)).toBe(state)
  })
})

// ═══════════════════════════════════════════
// UNIT-07-G: buildSiteRewards
// ═══════════════════════════════════════════
describe('buildSiteRewards (UNIT-07-G)', () => {
  const artifacts = [makeArtifact(1, 'A1'), makeArtifact(2, 'A2'), makeArtifact(3, 'A3'), makeArtifact(4, 'A4')]

  test('dungeon: 1 artifact choice drawn from quantity+1 options', () => {
    const { rewards, artifactsConsumed } = buildSiteRewards(makeEngine(), 'dungeon', artifacts)
    expect(rewards).toHaveLength(1)
    expect(rewards[0]).toMatchObject({ type: 'artifact_choice', pickCount: 1 })
    if (rewards[0].type === 'artifact_choice') {
      expect(rewards[0].options.map(c => c.id)).toEqual([1, 2])
    }
    expect(artifactsConsumed).toBe(2)
  })

  test('tomb: artifact choice + spell choice', () => {
    const { rewards } = buildSiteRewards(makeEngine(), 'tomb', artifacts)
    expect(rewards.map(r => r.type)).toEqual(['artifact_choice', 'spell_choice'])
  })

  test('ancient ruins: artifact-or-spell choice', () => {
    const { rewards, artifactsConsumed } = buildSiteRewards(makeEngine(), 'ancientRuins', artifacts)
    expect(rewards.map(r => r.type)).toEqual(['artifact_or_spell'])
    expect(artifactsConsumed).toBe(0)
  })

  test('spawning grounds: 1 artifact + three crystal rolls (EC-07-G-4)', () => {
    const { rewards, artifactsConsumed } = buildSiteRewards(makeEngine(), 'spawningGrounds', artifacts)
    expect(rewards.map(r => r.type)).toEqual([
      'artifact_choice', 'crystal_roll', 'crystal_roll', 'crystal_roll',
    ])
    expect(rewards[0]).toMatchObject({ type: 'artifact_choice', pickCount: 1 })
    expect(artifactsConsumed).toBe(2)
  })

  test('monster den: two crystal rolls', () => {
    const { rewards } = buildSiteRewards(makeEngine(), 'monsterDen', artifacts)
    expect(rewards.map(r => r.type)).toEqual(['crystal_roll', 'crystal_roll'])
  })

  test('keep / undefined: no extra rewards (conquest only)', () => {
    expect(buildSiteRewards(makeEngine(), 'keep', artifacts).rewards).toHaveLength(0)
    expect(buildSiteRewards(makeEngine(), undefined, artifacts).rewards).toHaveLength(0)
  })

  test('mage tower: choose a Spell (rulebook reward)', () => {
    const { rewards } = buildSiteRewards(makeEngine(), 'mageTower', artifacts)
    expect(rewards.map(r => r.type)).toEqual(['spell_choice'])
  })

  test('monastery: an Artifact (burned monastery reward)', () => {
    const { rewards, artifactsConsumed } = buildSiteRewards(makeEngine(), 'monastery', artifacts)
    expect(rewards.map(r => r.type)).toEqual(['artifact_choice'])
    expect(artifactsConsumed).toBe(2)
  })

  test('dungeon with an empty artifact deck yields nothing instead of crashing', () => {
    const { rewards, artifactsConsumed } = buildSiteRewards(makeEngine(), 'dungeon', [])
    expect(rewards).toHaveLength(0)
    expect(artifactsConsumed).toBe(0)
  })
})

// ═══════════════════════════════════════════
// UNIT-05-B: isRampagingHex
// ═══════════════════════════════════════════
describe('isRampagingHex (UNIT-05-B)', () => {
  const baseHex: HexCell = {
    coord: { q: 1, r: 0 },
    terrain: 'plains',
    enemyTokens: [],
    tileId: 't1',
    isRevealed: true,
  }

  test('enemies on a siteless hex are rampaging', () => {
    expect(isRampagingHex({ ...baseHex, enemyTokens: [makeEnemy()] })).toBe(true)
  })

  test('garrison/adventure-site enemies are NOT rampaging', () => {
    expect(
      isRampagingHex({
        ...baseHex,
        site: 'keep',
        siteData: { type: 'keep', isConquered: false, enemyTokenIds: [], shieldTokens: 0 },
        enemyTokens: [makeEnemy()],
      }),
    ).toBe(false)
  })

  test('empty or missing hexes are not rampaging', () => {
    expect(isRampagingHex(baseHex)).toBe(false)
    expect(isRampagingHex(undefined)).toBe(false)
  })
})

// ═══════════════════════════════════════════
// EC-07-E-1: melee phase accepts ALL attack types
// ═══════════════════════════════════════════
describe('filterActionsForPhase (EC-07-E-1)', () => {
  test('ranged and siege attacks unused in phase 1 are valid in melee', async () => {
    const { filterActionsForPhase } = await import('@/utils/combatCardUtils')
    const actions = [
      { type: 'attack', value: 2 },
      { type: 'ranged_attack', value: 1 },
      { type: 'siege_attack', value: 1 },
      { type: 'block', value: 3 },
    ]
    expect(filterActionsForPhase(actions, 'attack').map(a => a.type)).toEqual([
      'attack', 'ranged_attack', 'siege_attack',
    ])
    // Phase 1 still restricts to ranged/siege only (EC-07-B)
    expect(filterActionsForPhase(actions, 'ranged_siege').map(a => a.type)).toEqual([
      'ranged_attack', 'siege_attack',
    ])
    // Block phase only accepts blocks
    expect(filterActionsForPhase(actions, 'block').map(a => a.type)).toEqual(['block'])
  })
})

// ═══════════════════════════════════════════
// Banner helpers (EC-02-C-3, EC-08-B-1)
// ═══════════════════════════════════════════
describe('banner utils (EC-02-C-3)', () => {
  test('banner bonuses are read from the assign_to_unit action', async () => {
    const { getBannerBonuses, getEffectiveUnitArmor, isBannerCard } = await import('@/utils/bannerUtils')
    const banner = {
      id: 1,
      name: 'Banner of Glory',
      type: 'artifact' as const,
      subtype: 'banner',
      basicEffect: {
        text: '',
        actions: [{ type: 'assign_to_unit', bonus_armor: 1, bonus_attack: 1, bonus_block: 1 }],
      },
      strongEffect: { text: '', actions: [] },
      set: 'base' as const,
    }
    expect(isBannerCard(banner)).toBe(true)

    const unit = {
      unit: {
        id: 1, name: 'Foresters', type: 'foresters', tier: 'regular' as const,
        level: 1, cost: 5, armor: 4, recruitSites: [], abilities: [], resistance: null, copies: 1, set: 'base' as const,
      },
      status: 'ready' as const,
      woundCount: 0,
      bannerCard: banner,
    }
    expect(getBannerBonuses(unit)).toEqual({ armor: 1, attack: 1, block: 1 })
    expect(getEffectiveUnitArmor(unit)).toBe(5)
    expect(getEffectiveUnitArmor({ ...unit, bannerCard: undefined })).toBe(4)
  })

  test('EC-08-B-1: bannered units cannot use mana-powered abilities', async () => {
    const { getUnitCombatActions } = await import('@/utils/combatCardUtils')
    const unit = {
      unit: {
        id: 1, name: 'Test', type: 't', tier: 'regular' as const,
        level: 1, cost: 5, armor: 4, recruitSites: [],
        abilities: [
          { name: 'Strike', text: '', actions: [{ type: 'attack', value: 2 }] },
          { name: 'Fire Strike', text: '', manaCost: 'red', actions: [{ type: 'attack', value: 4, element: 'fire' }] },
        ],
        resistance: null, copies: 1, set: 'base' as const,
      },
      status: 'ready' as const,
      woundCount: 0,
      bannerCard: {
        id: 1, name: 'Banner', type: 'artifact' as const, subtype: 'banner',
        basicEffect: { text: '', actions: [] }, strongEffect: { text: '', actions: [] }, set: 'base' as const,
      },
    }
    const actions = getUnitCombatActions(unit, 'attack')
    expect(actions.map((a) => a.ability.name)).toEqual(['Strike'])
    // Without the banner the powered ability is available again
    const free = getUnitCombatActions({ ...unit, bannerCard: undefined }, 'attack')
    expect(free.map((a) => a.ability.name)).toEqual(['Strike', 'Fire Strike'])
  })
})

// ═══════════════════════════════════════════
// Banner of Fear / Bonds of Loyalty
// ═══════════════════════════════════════════
describe('banner specials & passive command bonus', () => {
  test('Banner of Fear offers an attack-cancel block in the block phase', async () => {
    const { getUnitCombatActions } = await import('@/utils/combatCardUtils')
    const unit = {
      unit: {
        id: 1, name: 'Foresters', type: 'f', tier: 'regular' as const,
        level: 1, cost: 5, armor: 4, recruitSites: [],
        abilities: [{ name: 'Block', text: '', actions: [{ type: 'block', value: 3 }] }],
        resistance: null, copies: 1, set: 'base' as const,
      },
      status: 'ready' as const,
      woundCount: 0,
      bannerCard: {
        id: 2, name: 'Banner of Fear', type: 'artifact' as const, subtype: 'banner',
        basicEffect: { text: '', actions: [{ type: 'assign_to_unit' }] },
        strongEffect: { text: '', actions: [] }, set: 'base' as const,
      },
    }
    const actions = getUnitCombatActions(unit, 'block')
    const cancel = actions.find((a) => a.action.bannerFear)
    expect(cancel).toBeDefined()
    expect(cancel?.action.value).toBe(99) // overwhelming block = cancelled attack
    // Not offered in attack phases
    expect(getUnitCombatActions(unit, 'attack').some((a) => a.action.bannerFear)).toBe(false)
  })

  test('Bonds of Loyalty command bonus survives level-up stat application', () => {
    const bondsSkill = {
      id: 108,
      name: 'Bonds of Loyalty',
      type: 'passive' as const,
      effect: '',
      actions: [{ type: 'passive_command_bonus', extraCommand: 1, recruitDiscount: 5 }],
      isFlipped: false,
      isUsedThisTurn: false,
    }
    const state = makeState({ skills: [bondsSkill], unitLimit: 2 }) // 1 base + 1 bonds
    // Level 1 → 2 (table unitLimit 2) — the +1 bonus must persist on top
    const result = applyFameGain(makeEngine(), state, 4)
    expect(result.player.level).toBe(2)
    expect(result.player.unitLimit).toBe(3)
  })
})

// ═══════════════════════════════════════════
// Norowas dummy skills (EC-09-A-3)
// ═══════════════════════════════════════════
describe('Norowas skill data (EC-09-A-3)', () => {
  test('loader provides Norowas skills with one interactive token', async () => {
    const { getNorowasSkills } = await import('@/data/loader')
    const skills = getNorowasSkills()
    expect(skills.length).toBeGreaterThanOrEqual(8)
    expect(skills.filter((s) => s.type.startsWith('interactive'))).toHaveLength(1)
    expect(skills.map((s) => s.name)).toContain('Day Sharpshooting')
    expect(skills.map((s) => s.name)).toContain('Forward March')
  })
})

// ═══════════════════════════════════════════
// Healing accumulation (EC-02 healing → turn state)
// ═══════════════════════════════════════════
describe('healing accumulation', () => {
  test('healing card effects accumulate on the turn state', () => {
    const resolver = new CardEffectResolver()
    const resolution = resolver.resolveEffect(
      { text: 'Heal 2', actions: [{ type: 'healing', value: 2 }] },
      'day',
    )
    expect(resolution.healingValue).toBe(2)
    const turn = resolver.applyToTurnState({ ...INITIAL_TURN_STATE }, resolution)
    expect(turn.healingAvailable).toBe(2)

    const more = resolver.applyToTurnState(turn, resolution)
    expect(more.healingAvailable).toBe(4)
  })

  test('move-only effects leave healing untouched', () => {
    const resolver = new CardEffectResolver()
    const resolution = resolver.resolveEffect(
      { text: 'Move 2', actions: [{ type: 'move', value: 2 }] },
      'day',
    )
    const turn = resolver.applyToTurnState({ ...INITIAL_TURN_STATE }, resolution)
    expect(turn.movePointsAvailable).toBe(2)
    expect(turn.healingAvailable ?? 0).toBe(0)
  })
})
