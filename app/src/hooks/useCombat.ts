import { useState, useCallback } from 'react'
import { useGameEngine, sharedEngine, setSharedState, applyFameGain } from '@/hooks/useGameEngine'
import { useGameStore } from '@/store/gameStore'
import type {
  CombatPhase,
  EnemyInstance,
  EnemyToken,
  EnemyAbility,
  AttackDeclaration,
  BlockDeclaration,
  DamageAssignment,
  CityColor,
  DeckState,
  UnitInstance,
  TurnState,
  ManaPoolState,
  ManaColor,
  Element,
} from '@/engine/types'
import type { CombatCardPlay } from '@/engine/combatCardTypes'

interface UnblockedDamageEntry {
  enemyInstanceId: string
  damage: number
  element: Element
  abilities: EnemyAbility[]
}

interface ProcessedPlays {
  deck: DeckState
  units: UnitInstance[]
  turn: TurnState
  mana: ManaPoolState
  skills: import('@/engine/types').HeroSkill[]
  /** Banner of Fear cancels and Banner of Glory attack/block bonuses */
  fameBonus: number
}

export function useCombat() {
  const engine = useGameEngine()
  const combatState = useGameStore((s) => s.combat)
  const engineState = useGameStore((s) => s.engineState)
  const syncFromEngine = useGameStore((s) => s.syncFromEngine)

  const [selectedEnemyId, setSelectedEnemyId] = useState<string | null>(null)
  const [pendingAttacks, setPendingAttacks] = useState<AttackDeclaration[]>([])
  const [pendingBlocks, setPendingBlocks] = useState<BlockDeclaration[]>([])

  const isCombatActive: boolean = combatState.isActive
  const combatPhase: CombatPhase = combatState.phase
  const enemies: EnemyInstance[] = combatState.enemies

  const startCombat = useCallback(
    (enemyTokens: EnemyToken[], isFortified: boolean, cityColor?: CityColor, hexCoord?: import('@/engine/types').HexCoord) => {
      setPendingAttacks([])
      setPendingBlocks([])
      setSelectedEnemyId(null)
      engine.initiateCombat(enemyTokens, isFortified, cityColor, hexCoord)
    },
    [engine],
  )

  const selectEnemy = useCallback((instanceId: string) => {
    setSelectedEnemyId(instanceId)
  }, [])

  const addAttack = useCallback((attack: AttackDeclaration) => {
    setPendingAttacks((prev) => [...prev, attack])
  }, [])

  /** Process card plays: returns updated player state with cards moved to playArea, units spent, mana spent */
  const processCardPlays = useCallback(
    (plays: CombatCardPlay[]): ProcessedPlays | null => {
      if (!engineState || !sharedEngine) return null

      let newDeck = engineState.player.deck
      let newUnits = [...engineState.player.units]
      let newMana = engineState.player.mana
      const dayNight = engineState.dayNight
      const newTurn = {
        ...engineState.player.turn,
        cardsPlayedThisTurn: [
          ...engineState.player.turn.cardsPlayedThisTurn,
          ...plays.filter((p) => p.sourceType === 'card').map((p) => String(p.cardId)),
        ],
      }

      // Sort card indices descending so removal doesn't shift later indices
      const cardPlays = plays
        .filter((p) => p.sourceType === 'card' && p.cardIndex != null)
        .sort((a, b) => (b.cardIndex ?? 0) - (a.cardIndex ?? 0))

      for (const play of cardPlays) {
        if (play.cardIndex != null) {
          // Check if this is an artifact played strong — throw away instead of play
          const card = newDeck.hand[play.cardIndex]
          if (card && card.type === 'artifact' && play.effectType === 'strong') {
            newDeck = sharedEngine.deckManager.throwAwayCard(newDeck, String(card.id))
          } else {
            newDeck = sharedEngine.deckManager.playCard(newDeck, play.cardIndex)
          }
        }
      }

      // Spend mana for strong effect plays
      const manaPool = sharedEngine.manaPool
      for (const play of plays) {
        if (play.effectType !== 'strong' || !play.manaCost) continue
        // Artifacts don't cost mana
        if (play.manaCost === undefined) continue

        const costs = Array.isArray(play.manaCost) ? play.manaCost : [play.manaCost]
        for (const cost of costs) {
          if (cost === 'black') {
            const result = manaPool.spendBlackMana(newMana)
            if (result) newMana = result
          } else {
            // Handle "color_or_color" format (e.g. "green_or_blue")
            const colorParts = cost.split('_or_')
            let spent = false
            for (const colorPart of colorParts) {
              const result = manaPool.spendManaOfColor(newMana, colorPart as ManaColor, dayNight)
              if (result) { newMana = result; spent = true; break }
            }
            if (!spent) {
              // Fallback: try spending as single color
              const result = manaPool.spendManaOfColor(newMana, cost as ManaColor, dayNight)
              if (result) newMana = result
            }
          }
        }
      }

      // Mark units as spent
      const unitPlays = plays.filter((p) => p.sourceType === 'unit' && p.unitIndex != null)
      for (const play of unitPlays) {
        if (play.unitIndex != null && play.unitIndex < newUnits.length) {
          newUnits = [
            ...newUnits.slice(0, play.unitIndex),
            { ...newUnits[play.unitIndex], status: 'spent' as const },
            ...newUnits.slice(play.unitIndex + 1),
          ]
        }
      }

      // Mark skills as used (UNIT-09-B usage limits)
      let newSkills = engineState.player.skills
      const skillPlays = plays.filter((p) => p.sourceType === 'skill' && p.skillIndex != null)
      for (const play of skillPlays) {
        newSkills = sharedEngine.skillManager.activateSkill(newSkills, play.skillIndex!, { isNewTurn: false })
      }

      // Banner fame bonuses: Fear cancel (+1) and Glory attack/block (+bonus_fame)
      let fameBonus = 0
      for (const play of plays) {
        if (play.chosenAction?.bannerFear) fameBonus += 1
        if (play.sourceType === 'unit' && play.unitIndex != null) {
          const unit = engineState.player.units[play.unitIndex]
          const assign = unit?.bannerCard?.basicEffect.actions.find((a) => a.type === 'assign_to_unit')
          const actionType = play.chosenAction?.type ?? ''
          if (
            typeof assign?.bonus_fame === 'number' &&
            (actionType.includes('attack') || actionType === 'block')
          ) {
            fameBonus += assign.bonus_fame
          }
        }
      }

      return { deck: newDeck, units: newUnits, turn: newTurn, mana: newMana, skills: newSkills, fameBonus }
    },
    [engineState],
  )

  /**
   * Apply combat special card effects (Tremor, Whirlwind, Tornado…) to the
   * combat state BEFORE the phase resolver runs. Targets auto-pick the
   * strongest standing enemy; `target: 'all'` variants hit every enemy.
   */
  const applyCombatSpecials = useCallback(
    (combat: typeof combatState, plays: CombatCardPlay[]): typeof combatState => {
      let enemies = combat.enemies
      const standing = () =>
        enemies
          .map((e, i) => ({ e, i }))
          .filter(({ e }) => !e.isDefeated)
      const strongestIdx = () => {
        const s = standing().sort((a, b) => b.e.currentArmor - a.e.currentArmor)
        return s.length > 0 ? s[0].i : -1
      }

      for (const play of plays) {
        const a = play.chosenAction
        if (!a) continue
        if (a.type === 'enemy_armor_reduction') {
          const value = typeof a.value === 'number' ? a.value : 1
          const reduce = (e: EnemyInstance) => ({
            ...e,
            currentArmor: Math.max(1, e.currentArmor - value),
          })
          if (a.target === 'all') {
            enemies = enemies.map((e) => (e.isDefeated ? e : reduce(e)))
          } else {
            const idx = strongestIdx()
            if (idx >= 0) enemies = enemies.map((e, i) => (i === idx ? reduce(e) : e))
          }
        } else if (a.type === 'enemy_skip_attack') {
          // "Does not attack this combat" — model as already-blocked
          const count = typeof a.count === 'number' ? a.count : 1
          let applied = 0
          const byAttack = standing()
            .filter(({ e }) => !e.isBlocked)
            .sort((x, y) => y.e.currentAttack - x.e.currentAttack)
          const targetIdxs = new Set(byAttack.slice(0, count).map(({ i }) => i))
          enemies = enemies.map((e, i) => {
            if (!targetIdxs.has(i) || applied >= count) return e
            applied++
            return { ...e, isBlocked: true }
          })
        } else if (a.type === 'destroy_enemy') {
          const idx = strongestIdx()
          if (idx >= 0) {
            enemies = enemies.map((e, i) => (i === idx ? { ...e, isDefeated: true } : e))
          }
        }
      }
      return { ...combat, enemies }
    },
    [],
  )

  const confirmRangedPhase = useCallback(
    (attacks: AttackDeclaration[], plays: CombatCardPlay[] = []) => {
      if (!engineState || !sharedEngine) return
      const processed = plays.length > 0 ? processCardPlays(plays) : null
      const resolver = sharedEngine.combatResolver
      const preCombat = applyCombatSpecials(combatState, plays)
      const resolved = resolver.resolveRangedSiegeAttack(preCombat, attacks)
      const newState = {
        ...engineState,
        combat: resolved,
        ...(processed && {
          player: {
            ...engineState.player,
            deck: processed.deck,
            units: processed.units,
            turn: processed.turn,
            mana: processed.mana,
            skills: processed.skills,
          },
        }),
      }
      const finalState = processed && processed.fameBonus > 0
        ? applyFameGain(sharedEngine, newState, processed.fameBonus)
        : newState
      setSharedState(finalState)
      syncFromEngine(finalState)
      setPendingAttacks([])
    },
    [engineState, combatState, syncFromEngine, processCardPlays, applyCombatSpecials],
  )

  const addBlock = useCallback((block: BlockDeclaration) => {
    setPendingBlocks((prev) => [...prev, block])
  }, [])

  const confirmBlockPhase = useCallback(
    (blocks: BlockDeclaration[], plays: CombatCardPlay[] = []) => {
      if (!engineState || !sharedEngine) return
      const processed = plays.length > 0 ? processCardPlays(plays) : null
      const resolver = sharedEngine.combatResolver

      // Bug #11: Process summon abilities before block phase.
      // Keep summon semantics centralized in CombatResolver so UI hooks stay type-safe.
      const currentCombatState = applyCombatSpecials(resolver.processSummons(combatState), plays)

      const resolved = resolver.resolveBlock(currentCombatState, blocks)
      const newState = {
        ...engineState,
        combat: resolved,
        ...(processed && {
          player: {
            ...engineState.player,
            deck: processed.deck,
            units: processed.units,
            turn: processed.turn,
            mana: processed.mana,
            skills: processed.skills,
          },
        }),
      }
      const finalState = processed && processed.fameBonus > 0
        ? applyFameGain(sharedEngine, newState, processed.fameBonus)
        : newState
      setSharedState(finalState)
      syncFromEngine(finalState)
      setPendingBlocks([])
    },
    [engineState, combatState, syncFromEngine, processCardPlays, applyCombatSpecials],
  )

  const confirmDamageAssignment = useCallback(
    (assignments: DamageAssignment[]) => {
      if (!engineState || !sharedEngine) return
      const resolver = sharedEngine.combatResolver
      const resolved = resolver.assignDamage(combatState, assignments)
      const ds = { ...engineState, combat: resolved }
      setSharedState(ds)
      syncFromEngine(ds)
    },
    [engineState, combatState, syncFromEngine],
  )

  const addMeleeAttack = useCallback((attack: AttackDeclaration) => {
    setPendingAttacks((prev) => [...prev, attack])
  }, [])

  const confirmMeleePhase = useCallback(
    (attacks: AttackDeclaration[], plays: CombatCardPlay[] = []) => {
      if (!engineState || !sharedEngine) return
      const processed = plays.length > 0 ? processCardPlays(plays) : null
      const resolver = sharedEngine.combatResolver
      const resolved = resolver.resolveMeleeAttack(applyCombatSpecials(combatState, plays), attacks)
      const newState = {
        ...engineState,
        combat: resolved,
        ...(processed && {
          player: {
            ...engineState.player,
            deck: processed.deck,
            units: processed.units,
            turn: processed.turn,
            mana: processed.mana,
            skills: processed.skills,
          },
        }),
      }
      const finalState = processed && processed.fameBonus > 0
        ? applyFameGain(sharedEngine, newState, processed.fameBonus)
        : newState
      setSharedState(finalState)
      syncFromEngine(finalState)
      setPendingAttacks([])
    },
    [engineState, combatState, syncFromEngine, processCardPlays, applyCombatSpecials],
  )

  const finishCombat = useCallback(() => {
    engine.endCombat()
    setPendingAttacks([])
    setPendingBlocks([])
    setSelectedEnemyId(null)
  }, [engine])

  const getUnblockedDamage = useCallback((): UnblockedDamageEntry[] => {
    if (!sharedEngine) return []
    return sharedEngine.combatResolver.calculateUnblockedDamage(combatState)
  }, [combatState])

  return {
    isCombatActive,
    combatPhase,
    enemies,
    selectedEnemyId,
    pendingAttacks,
    pendingBlocks,

    startCombat,
    selectEnemy,
    addAttack,
    confirmRangedPhase,
    addBlock,
    confirmBlockPhase,
    confirmDamageAssignment,
    addMeleeAttack,
    confirmMeleePhase,
    finishCombat,
    getUnblockedDamage,
  }
}
