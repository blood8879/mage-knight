import { describe, it, expect, beforeEach } from 'vitest'
import { ScenarioSetup } from '@/engine/ScenarioSetup'
import { TurnManager } from '@/engine/TurnManager'
import { ManaPool } from '@/engine/ManaPool'
import { DeckManager } from '@/engine/DeckManager'
import { LevelUpManager } from '@/engine/LevelUpManager'
import { CombatResolver } from '@/engine/CombatResolver'
import { SeededRandom } from '@/utils/random'
import type { TacticCard, AnyCard, EnemyToken } from '@/engine/types'
import type { PhaseContext } from '@/engine/TurnManager'

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

describe('Walkthrough: Full Playthrough Integration (Phase 13)', () => {
  let random: SeededRandom
  let setup: ScenarioSetup
  let tm: TurnManager
  let pool: ManaPool
  let dm: DeckManager
  let levelMgr: LevelUpManager
  let combat: CombatResolver

  beforeEach(() => {
    random = new SeededRandom(42)
    setup = new ScenarioSetup(random)
    tm = new TurnManager(random)
    pool = new ManaPool(random)
    dm = new DeckManager(random)
    levelMgr = new LevelUpManager()
    combat = new CombatResolver(random)
  })

  it('simulates a complete round: setup → tactic → turn → combat → end round', () => {
    // Setup
    const config = setup.setupFirstReconnaissance()
    expect(config.totalRounds).toBe(3)

    // Start round 1
    const tactics = makeDayTactics()
    const round = tm.startRound(1, 'day', tactics)
    expect(round.dayNight).toBe('day')

    // Tactic selection
    const { selected: dummyT, remaining } = tm.selectTacticForDummy(round.availableTactics)
    const { selected: playerT } = tm.selectTacticForPlayer(remaining, remaining[1].id)
    const order = tm.determineTurnOrder(playerT, dummyT)
    expect(['player_first', 'dummy_first']).toContain(order)

    // Player turn: combat against an orc
    const combatState = combat.initiateCombat([makeEnemy({ armor: 3, fameReward: 2 })], false)
    expect(combatState.phase).toBe('ranged_siege')

    // Attack in melee
    const afterRanged = combat.resolveRangedSiegeAttack(combatState, [])
    const afterBlock = combat.resolveBlock(afterRanged, [])
    const afterDamage = combat.assignDamage({ ...afterBlock, phase: 'assign_damage' }, [])
    const afterMelee = combat.resolveMeleeAttack(
      { ...afterDamage, phase: 'attack' },
      [{ id: 'atk_1', targetEnemyIds: [afterDamage.enemies[0].instanceId], attackValue: 3, attackElement: 'physical', isSiege: false, isRanged: false, cardIds: [], unitIds: [] }]
    )
    expect(afterMelee.enemies[0].isDefeated).toBe(true)

    // Level up check
    const fameResult = levelMgr.addFame(0, 2)
    expect(fameResult.newFame).toBe(2)
    expect(fameResult.newLevel).toBe(1) // not enough for level 2 yet
  })

  it('simulates fame accumulation across multiple combats leading to level up', () => {
    // Combat 1: 2 fame
    let totalFame = 0
    let result = levelMgr.addFame(totalFame, 2)
    totalFame = result.newFame
    expect(result.newLevel).toBe(1)

    // Combat 2: 1 fame → total 3 → level 2
    result = levelMgr.addFame(totalFame, 1)
    totalFame = result.newFame
    expect(result.newLevel).toBe(2)
    expect(result.levelsGained).toBe(1)

    // Combat 3: 5 fame → total 8 → level 3
    result = levelMgr.addFame(totalFame, 5)
    totalFame = result.newFame
    expect(result.newLevel).toBe(3)
  })

  it('simulates three-round game flow from round_start to game_over', () => {
    const pattern = tm.getRoundPattern(3)
    expect(pattern).toEqual(['day', 'night', 'day'])

    // Round 1 → 2
    let eor = tm.processEndOfRound({ currentRound: 1, totalRounds: 3, roundPattern: pattern })
    expect(eor.isGameOver).toBe(false)
    expect(eor.nextDayNight).toBe('night')

    // Round 2 → 3
    eor = tm.processEndOfRound({ currentRound: 2, totalRounds: 3, roundPattern: pattern })
    expect(eor.isGameOver).toBe(false)
    expect(eor.nextDayNight).toBe('day')

    // Round 3 → game over
    eor = tm.processEndOfRound({ currentRound: 3, totalRounds: 3, roundPattern: pattern })
    expect(eor.isGameOver).toBe(true)

    // Phase flow ends at game_over
    const phase = tm.advancePhase('end_of_round', { gameEnding: true })
    expect(phase).toBe('game_over')
  })

  it('mana system integrates with turn lifecycle', () => {
    // Initialize mana
    let mana = pool.initializeSource(4)
    expect(mana.dice).toHaveLength(4)

    // Take a die
    const dieId = mana.dice[0].id
    mana = pool.takeDieFromSource(mana, dieId)
    expect(mana.playerMana).toHaveLength(1)

    // End of turn: reset
    mana = pool.resetTurnState(mana)
    expect(mana.playerMana).toHaveLength(0)
    expect(mana.sourceDieTakenThisTurn).toBe(false)

    // End of round: reroll source
    mana = pool.rerollSource(mana)
    expect(mana.dice).toHaveLength(4)
    expect(mana.dice.every(d => d.isInSource)).toBe(true)
  })
})
