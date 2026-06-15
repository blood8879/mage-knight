/**
 * Rules Implementation Spec Validation Tests
 * Tests each bug fix against RULES_IMPLEMENTATION_SPEC.md edge cases
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ManaPool } from '@/engine/ManaPool'
import { DeckManager } from '@/engine/DeckManager'
import { UnitManager } from '@/engine/UnitManager'
import { DummyPlayer } from '@/engine/DummyPlayer'
import { TurnManager } from '@/engine/TurnManager'
import { ReputationManager } from '@/engine/ReputationManager'
import { CombatResolver } from '@/engine/CombatResolver'
import { SeededRandom } from '@/utils/random'
import type {
  ManaPoolState,
  ManaColor,
  UnitInstance,
  AnyUnit,
  TacticCard,
  EnemyToken,
} from '@/engine/types'
import { INITIAL_CRYSTALS, MAX_CRYSTAL_PER_COLOR } from '@/engine/GameState'

// ── Helpers ──────────────────────────────────
function makeTactic(id: number, number: number): TacticCard {
  return { id, name: `Tactic ${id}`, type: 'day', number, effect: '', isUsed: false }
}

function makeUnit(overrides: Partial<AnyUnit> = {}): AnyUnit {
  return {
    id: 1,
    name: 'Test Unit',
    type: 'peasants',
    tier: 'regular' as const,
    level: 1,
    cost: 3,
    armor: 3,
    recruitSites: ['village'],
    abilities: [],
    resistance: null,
    copies: 1,
    set: 'base' as const,
    ...overrides,
  } as AnyUnit
}

function makeUnitInstance(overrides: Partial<UnitInstance> = {}): UnitInstance {
  return {
    unit: makeUnit(),
    status: 'ready',
    woundCount: 0,
    ...overrides,
  }
}

// ═══════════════════════════════════════════════
// UNIT-01: Mana System
// ═══════════════════════════════════════════════

describe('UNIT-01: Mana System — Bug Fixes', () => {
  let pool: ManaPool
  let random: SeededRandom

  beforeEach(() => {
    random = new SeededRandom(42)
    pool = new ManaPool(random)
  })

  describe('01-B: takeDieFromSource — Day/Night validation', () => {
    it('EC-01-B-1: rejects second die take in same turn', () => {
      let state = pool.initializeSource(4)
      // Force a basic color die for reliable test
      state = {
        ...state,
        dice: state.dice.map((d, i) =>
          i === 0 ? { ...d, color: 'red' as const } :
          i === 1 ? { ...d, color: 'blue' as const } : d
        ),
      }

      state = pool.takeDieFromSource(state, 'die_0', 'day')
      expect(state.sourceDieTakenThisTurn).toBe(true)
      expect(state.playerMana).toHaveLength(1)

      // Second take should be rejected
      const result = pool.takeDieFromSource(state, 'die_1', 'day')
      expect(result.playerMana).toHaveLength(1) // unchanged
      expect(result).toBe(state) // same reference = no change
    })

    it('EC-01-B-2: rejects Gold die during Night', () => {
      let state = pool.initializeSource(4)
      state = {
        ...state,
        dice: state.dice.map((d, i) =>
          i === 0 ? { ...d, color: 'gold' as const } : d
        ),
      }

      const result = pool.takeDieFromSource(state, 'die_0', 'night')
      expect(result).toBe(state) // unchanged
      expect(result.playerMana).toHaveLength(0)
    })

    it('EC-01-B-2: allows Gold die during Day', () => {
      let state = pool.initializeSource(4)
      state = {
        ...state,
        dice: state.dice.map((d, i) =>
          i === 0 ? { ...d, color: 'gold' as const } : d
        ),
      }

      const result = pool.takeDieFromSource(state, 'die_0', 'day')
      expect(result.playerMana).toHaveLength(1)
      expect(result.playerMana[0].color).toBe('gold')
    })

    it('EC-01-B-3: rejects Black die during Day', () => {
      let state = pool.initializeSource(4)
      state = {
        ...state,
        dice: state.dice.map((d, i) =>
          i === 0 ? { ...d, color: 'black' as const } : d
        ),
      }

      const result = pool.takeDieFromSource(state, 'die_0', 'day')
      expect(result).toBe(state)
      expect(result.playerMana).toHaveLength(0)
    })

    it('EC-01-B-3: allows Black die during Night', () => {
      let state = pool.initializeSource(4)
      state = {
        ...state,
        dice: state.dice.map((d, i) =>
          i === 0 ? { ...d, color: 'black' as const } : d
        ),
      }

      const result = pool.takeDieFromSource(state, 'die_0', 'night')
      expect(result.playerMana).toHaveLength(1)
      expect(result.playerMana[0].color).toBe('black')
    })

    it('allows basic color die regardless of day/night', () => {
      let state = pool.initializeSource(4)
      state = {
        ...state,
        dice: state.dice.map((d, i) =>
          i === 0 ? { ...d, color: 'red' as const } : d
        ),
      }

      const dayResult = pool.takeDieFromSource(state, 'die_0', 'day')
      expect(dayResult.playerMana).toHaveLength(1)

      // Reset for night test
      state = pool.initializeSource(4)
      state = {
        ...state,
        dice: state.dice.map((d, i) =>
          i === 0 ? { ...d, color: 'red' as const } : d
        ),
      }
      const nightResult = pool.takeDieFromSource(state, 'die_0', 'night')
      expect(nightResult.playerMana).toHaveLength(1)
    })
  })

  describe('01-D: Black Mana does NOT substitute basic colors', () => {
    it('EC-01-D: canUseManaColor returns false for black mana as basic substitute at night', () => {
      let state = pool.initializeSource(4)
      state = pool.addManaToken(state, 'black', 'effect')

      // Black mana should NOT count as red/blue/green/white
      expect(pool.canUseManaColor(state, 'red', 'night')).toBe(false)
      expect(pool.canUseManaColor(state, 'blue', 'night')).toBe(false)
      expect(pool.canUseManaColor(state, 'green', 'night')).toBe(false)
      expect(pool.canUseManaColor(state, 'white', 'night')).toBe(false)
    })

    it('hasBlackMana returns true when black mana is available at night', () => {
      let state = pool.initializeSource(4)
      state = pool.addManaToken(state, 'black', 'effect')

      expect(pool.hasBlackMana(state, 'night')).toBe(true)
      expect(pool.hasBlackMana(state, 'day')).toBe(false)
    })

    it('spendBlackMana removes a black mana token', () => {
      let state = pool.initializeSource(4)
      state = pool.addManaToken(state, 'black', 'effect')
      state = pool.addManaToken(state, 'red', 'effect')

      const result = pool.spendBlackMana(state)
      expect(result).not.toBeNull()
      expect(result!.playerMana).toHaveLength(1)
      expect(result!.playerMana[0].color).toBe('red')
    })

    it('spendBlackMana returns null when no black mana', () => {
      let state = pool.initializeSource(4)
      state = pool.addManaToken(state, 'red', 'effect')

      expect(pool.spendBlackMana(state)).toBeNull()
    })
  })

  describe('01-E: Crystal overflow → Pure Mana', () => {
    it('EC-01-E-1: addCrystal at max gives pure mana token instead', () => {
      let state = pool.initializeSource(4)
      state = pool.addCrystal(state, 'red')
      state = pool.addCrystal(state, 'red')
      state = pool.addCrystal(state, 'red')
      expect(state.crystals.red).toBe(3)
      expect(state.playerMana).toHaveLength(0)

      // 4th crystal should overflow to mana token
      const result = pool.addCrystal(state, 'red')
      expect(result.crystals.red).toBe(3) // still 3
      expect(result.playerMana).toHaveLength(1) // got mana token instead
      expect(result.playerMana[0].color).toBe('red')
    })

    it('addCrystal below max still works normally', () => {
      let state = pool.initializeSource(4)
      state = pool.addCrystal(state, 'blue')
      expect(state.crystals.blue).toBe(1)
      expect(state.playerMana).toHaveLength(0)
    })
  })
})

// ═══════════════════════════════════════════════
// UNIT-02: Card System — DeckManager Bug Fixes
// ═══════════════════════════════════════════════

describe('UNIT-02: Card System — Bug Fixes', () => {
  let dm: DeckManager

  beforeEach(() => {
    dm = new DeckManager(new SeededRandom(42))
  })

  describe('02-D: Wound card discard protection', () => {
    it('EC-02-D-2: discardFromHand rejects Wound cards', () => {
      const wound: any = { type: 'wound', id: 'wound_1' }
      const nonWound: any = { type: 'basic_action', id: 1, name: 'March', color: 'green', basicEffect: { text: '', actions: [] }, strongEffect: { text: '', actions: [] }, copies: 1, heroSpecific: null, replaces: null, set: 'base' }
      const deck = { drawPile: [], hand: [wound, nonWound], playArea: [], discardPile: [] }

      // Try to discard wound (index 0) — should be rejected
      const result = dm.discardFromHand(deck, 0)
      expect(result.hand).toHaveLength(2) // unchanged
      expect(result.discardPile).toHaveLength(0)
    })

    it('discardFromHand allows non-Wound cards', () => {
      const nonWound: any = { type: 'basic_action', id: 1, name: 'March', color: 'green', basicEffect: { text: '', actions: [] }, strongEffect: { text: '', actions: [] }, copies: 1, heroSpecific: null, replaces: null, set: 'base' }
      const deck = { drawPile: [], hand: [nonWound], playArea: [], discardPile: [] }

      const result = dm.discardFromHand(deck, 0)
      expect(result.hand).toHaveLength(0)
      expect(result.discardPile).toHaveLength(1)
    })

    it('discardFromHandForced allows Wound cards (for Resting)', () => {
      const wound: any = { type: 'wound', id: 'wound_1' }
      const deck = { drawPile: [], hand: [wound], playArea: [], discardPile: [] }

      const result = dm.discardFromHandForced(deck, 0)
      expect(result.hand).toHaveLength(0)
      expect(result.discardPile).toHaveLength(1)
      expect(result.discardPile[0].type).toBe('wound')
    })
  })
})

// ═══════════════════════════════════════════════
// UNIT-07: Combat — Summon Auto-Trigger
// ═══════════════════════════════════════════════

describe('UNIT-07: Combat — Summon Auto-Trigger', () => {
  it('EC-07-C-5: processSummons adds brown enemies for summon attackType', () => {
    const resolver = new CombatResolver(new SeededRandom(42))
    const summoner: EnemyToken = {
      id: 10, name: 'Orc Summoners', color: 'green', category: 'marauding',
      armor: 3, attack: 0, attackType: 'summon', abilities: [],
      fameReward: 3, copies: 1, set: 'base',
    }
    const combat = resolver.initiateCombat([summoner], false)
    expect(combat.enemies).toHaveLength(1)

    const afterSummon = resolver.processSummons(combat)
    expect(afterSummon.enemies).toHaveLength(2)
    expect(afterSummon.enemies[1].token.color).toBe('brown')
  })

  it('processSummons skips defeated summoners', () => {
    const resolver = new CombatResolver(new SeededRandom(42))
    const summoner: EnemyToken = {
      id: 10, name: 'Orc Summoners', color: 'green', category: 'marauding',
      armor: 3, attack: 0, attackType: 'summon', abilities: [],
      fameReward: 3, copies: 1, set: 'base',
    }
    const combat = resolver.initiateCombat([summoner], false)
    const defeated = {
      ...combat,
      enemies: combat.enemies.map((e) => ({ ...e, isDefeated: true })),
    }

    const afterSummon = resolver.processSummons(defeated)
    expect(afterSummon.enemies).toHaveLength(1) // no summon added
  })
})

// ═══════════════════════════════════════════════
// UNIT-04: Round Structure — Tactic Selection
// ═══════════════════════════════════════════════

describe('UNIT-04: Tactic Selection — Bug Fixes', () => {
  describe('04-B: Dummy selects RANDOM tactic', () => {
    it('EC-04-B-1: DummyPlayer.selectDummyTactic picks randomly (not always lowest)', () => {
      const tactics = [
        makeTactic(1, 1),
        makeTactic(2, 2),
        makeTactic(3, 3),
        makeTactic(4, 4),
        makeTactic(5, 5),
        makeTactic(6, 6),
      ]

      // Use widely spaced seeds to avoid LCG sequential correlation
      const selectedNumbers = new Set<number>()
      for (let i = 0; i < 100; i++) {
        const seed = i * 7919 // prime spacing for better distribution
        const dummy = new DummyPlayer(new SeededRandom(seed))
        const { selected } = dummy.selectDummyTactic(tactics)
        selectedNumbers.add(selected.number)
      }

      // With random selection across 100 varied seeds, we should see variety
      expect(selectedNumbers.size).toBeGreaterThan(1)
    })

    it('EC-04-B-1: TurnManager.selectTacticForDummy also picks randomly', () => {
      const tactics = [
        makeTactic(1, 1),
        makeTactic(2, 2),
        makeTactic(3, 3),
      ]

      const selectedNumbers = new Set<number>()
      for (let i = 0; i < 100; i++) {
        const seed = i * 7919
        const tm = new TurnManager(new SeededRandom(seed))
        const { selected } = tm.selectTacticForDummy(tactics)
        selectedNumbers.add(selected.number)
      }

      expect(selectedNumbers.size).toBeGreaterThan(1)
    })

    it('returns remaining tactics without the selected one', () => {
      const tactics = [makeTactic(1, 1), makeTactic(2, 2), makeTactic(3, 3)]
      const dummy = new DummyPlayer(new SeededRandom(42))
      const { selected, remaining } = dummy.selectDummyTactic(tactics)

      expect(remaining).toHaveLength(2)
      expect(remaining.find((t) => t.id === selected.id)).toBeUndefined()
    })
  })
})

// ═══════════════════════════════════════════════
// UNIT-06: Reputation — Interaction Influence
// ═══════════════════════════════════════════════

describe('UNIT-06: Reputation — Bug Fixes', () => {
  let rep: ReputationManager

  beforeEach(() => {
    rep = new ReputationManager()
  })

  describe('06-A: getInteractionInfluence — Shield bonus', () => {
    it('shield bonus is per-token, not leader-dependent', () => {
      // With 3 shield tokens, should get +3 regardless of leader status
      const result = rep.getInteractionInfluence(5, 0, 3)
      expect(result).toBe(8) // 5 base + 0 rep + 3 shields
    })

    it('zero shields gives no bonus', () => {
      const result = rep.getInteractionInfluence(5, 0, 0)
      expect(result).toBe(5)
    })

    it('reputation modifier is applied', () => {
      // Reputation 3 → modifier +2
      const result = rep.getInteractionInfluence(5, 3, 0)
      expect(result).toBe(7)
    })

    it('negative reputation reduces influence', () => {
      // Reputation -3 → modifier -3
      const result = rep.getInteractionInfluence(5, -3, 0)
      expect(result).toBe(2)
    })

    it('deprecated getInteractionCost still works via delegation', () => {
      const result = rep.getInteractionCost(5, 0, 2, true)
      // Should now ignore isCityLeader and just use shield tokens
      expect(result).toBe(7) // 5 + 0 + 2
    })
  })
})

// ═══════════════════════════════════════════════
// UNIT-08: Unit System
// ═══════════════════════════════════════════════

describe('UNIT-08: Unit System — Bug Fixes', () => {
  let um: UnitManager

  beforeEach(() => {
    um = new UnitManager()
  })

  describe('08-A: readyAllUnits — Wounded units become Ready', () => {
    it('EC-08-A-2: wounded units get status=ready but keep woundCount', () => {
      const units: UnitInstance[] = [
        makeUnitInstance({ status: 'wounded', woundCount: 1 }),
        makeUnitInstance({ status: 'spent', woundCount: 0 }),
        makeUnitInstance({ status: 'ready', woundCount: 0 }),
      ]

      const result = um.readyAllUnits(units)

      // All should be ready
      expect(result[0].status).toBe('ready')
      expect(result[1].status).toBe('ready')
      expect(result[2].status).toBe('ready')

      // Wounded unit keeps its wound
      expect(result[0].woundCount).toBe(1)

      // But wounded-ready unit is still not activatable
      expect(um.isUnitActivatable(result[0])).toBe(false)

      // Healthy-ready unit is activatable
      expect(um.isUnitActivatable(result[2])).toBe(true)
    })

    it('spent+wounded unit becomes ready but stays wounded', () => {
      // A unit that was spent then wounded (woundUnit sets status to wounded)
      const units: UnitInstance[] = [
        makeUnitInstance({ status: 'wounded', woundCount: 2 }), // poison wound
      ]

      const result = um.readyAllUnits(units)
      expect(result[0].status).toBe('ready')
      expect(result[0].woundCount).toBe(2)
      expect(um.isUnitActivatable(result[0])).toBe(false)
    })
  })
})

// ═══════════════════════════════════════════════
// UNIT-07: Combat — Existing correctness verification
// ═══════════════════════════════════════════════

describe('UNIT-07: Combat — Edge Case Verification', () => {
  let resolver: CombatResolver

  beforeEach(() => {
    resolver = new CombatResolver(new SeededRandom(42))
  })

  function makeEnemy(overrides: Partial<EnemyToken> = {}): EnemyToken {
    return {
      id: 1, name: 'Test', color: 'green', category: 'marauding',
      armor: 4, attack: 3, attackType: 'normal', abilities: [],
      fameReward: 3, copies: 1, set: 'base', ...overrides,
    }
  }

  it('EC-07-A-2: double fortified blocks all ranged/siege', () => {
    const enemy = makeEnemy({ abilities: ['fortified'] })
    const combat = resolver.initiateCombat([enemy], true) // site fortified + ability = double

    expect(resolver.isEnemyDoubleFortified(combat.enemies[0])).toBe(true)
  })

  it('EC-07-E-5: sideways physical attack 1 vs physical resistance = 0', () => {
    const effective = resolver.calculateEffectiveAttack(1, 'physical', ['physical_resistance'])
    expect(effective).toBe(0) // floor(1/2) = 0
  })

  it('EC-07-F-3: red city brutal only on normal attackType', () => {
    const fireEnemy = makeEnemy({ attackType: 'fire' })
    const combat = resolver.initiateCombat([fireEnemy], false, 'red')
    expect(combat.enemies[0].appliedAbilities).not.toContain('brutal')
  })

  it('EC-07-F-4: blue city cold_fire gets +1 (not +2)', () => {
    const cfEnemy = makeEnemy({ attack: 3, attackType: 'cold_fire' })
    const combat = resolver.initiateCombat([cfEnemy], false, 'blue')
    expect(combat.enemies[0].currentAttack).toBe(4) // +1 only
  })

  it('EC-13-A-2: cold_fire only resisted when BOTH fire AND ice resistance', () => {
    // Only fire resistance → cold_fire is NOT halved
    const v1 = resolver.calculateEffectiveAttack(6, 'cold_fire', ['fire_resistance'])
    expect(v1).toBe(6)

    // Only ice resistance → cold_fire is NOT halved
    const v2 = resolver.calculateEffectiveAttack(6, 'cold_fire', ['ice_resistance'])
    expect(v2).toBe(6)

    // Both → halved
    const v3 = resolver.calculateEffectiveAttack(6, 'cold_fire', ['fire_resistance', 'ice_resistance'])
    expect(v3).toBe(3)
  })
})

// ═══════════════════════════════════════════════
// UNIT-11: Dummy Player
// ═══════════════════════════════════════════════

describe('UNIT-11: Dummy Player — Behavior Verification', () => {
  it('EC-11-A-1: deck exhausted mid-flip → flip what you can, End of Round next turn', () => {
    const random = new SeededRandom(42)
    const dummy = new DummyPlayer(random)

    // Create dummy with only 2 cards (less than 3)
    const state = dummy.initializeDummy('Goldyx', [
      { type: 'basic_action', id: 100, name: 'A', color: 'red', basicEffect: { text: '', actions: [] }, strongEffect: { text: '', actions: [] }, copies: 1, heroSpecific: null, replaces: null, set: 'base' },
      { type: 'basic_action', id: 101, name: 'B', color: 'blue', basicEffect: { text: '', actions: [] }, strongEffect: { text: '', actions: [] }, copies: 1, heroSpecific: null, replaces: null, set: 'base' },
    ] as any)

    // Rulebook: flip as many as you can this turn; End of Round is announced
    // on the NEXT turn (when the deck is empty at the start of the turn).
    const result = dummy.executeDummyTurn(state)
    expect(result.hasEndedRound).toBe(false)
    expect(result.deedDeck).toHaveLength(0)
    expect(result.discardPile).toHaveLength(2)

    const next = dummy.executeDummyTurn(result)
    expect(next.hasEndedRound).toBe(true)
  })

  it('EC-11-B-1: dummy crystal count can exceed 3 per color', () => {
    const random = new SeededRandom(42)
    const dummy = new DummyPlayer(random)

    let state = dummy.initializeDummy('Goldyx', [])
    // Goldyx starts with blue:1, green:2
    // Add more green via spell removal
    state = dummy.processRoundStartForDummy(state, null, 'green')
    state = dummy.processRoundStartForDummy(state, null, 'green')
    // Should now have green: 4 (exceeding the 3 limit for regular players)
    expect(state.crystals.green).toBe(4)
  })
})
