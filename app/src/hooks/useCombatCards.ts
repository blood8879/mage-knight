import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useCardTranslation } from '@/hooks/useCardTranslation'
import type {
  CombatPhase,
  AnyCard,
  UnitInstance,
  EnemyInstance,
  AttackDeclaration,
  BlockDeclaration,
  CardAction,
  UnitAbility,
  HeroSkill,
  DayNight,
  Element,
} from '@/engine/types'
import type {
  CombatCardPlay,
  PendingAttack,
  PendingBlock,
  CombatCardsState,
} from '@/engine/combatCardTypes'
import { INITIAL_COMBAT_CARDS_STATE } from '@/engine/combatCardTypes'
import {
  getActionValue,
  getActionElement,
  getCardEffect,
  isCardRelevantForPhase,
  getUnitCombatActions,
  isRangedAction,
  isSiegeAction,
  filterActionsForPhase,
} from '@/utils/combatCardUtils'
import { getBannerCombatBonus } from '@/utils/bannerUtils'

// ── Return type ─────────────────────────────

export interface UseCombatCardsReturn {
  // State
  plays: CombatCardPlay[]
  pendingAttacks: PendingAttack[]
  pendingBlocks: PendingBlock[]
  usedCardIndices: Set<number>
  usedUnitIndices: Set<number>
  activeTargetEnemyId: string | null

  // Computed
  availableCards: Array<{ card: AnyCard; index: number; isRelevant: boolean }>
  availableUnits: Array<{
    unit: UnitInstance
    index: number
    actions: Array<{ ability: UnitAbility; action: CardAction }>
  }>
  availableSkills: Array<{
    skill: HeroSkill
    index: number
    actions: CardAction[]
  }>
  totalPhaseValue: number
  canConfirm: boolean

  // Actions
  playCardForPhase: (handIndex: number, effectType: 'basic' | 'strong', chosenAction: CardAction) => void
  playCardSideways: (handIndex: number) => void
  /** Concentration / Will Focus combo: play this card with another Action card,
   *  taking that card's strong effect for free with +bonus to its value. */
  playConcentrationCombo: (
    concentrationIndex: number,
    targetIndex: number,
    targetAction: CardAction,
    bonus: number,
    concentrationManaCost: string | string[] | undefined,
  ) => void
  activateUnit: (unitIndex: number, action: CardAction, ability: UnitAbility) => void
  activateSkillForCombat: (skillIndex: number, action: CardAction) => void
  playManaCardForCombat: (handIndex: number) => void
  setActiveTarget: (enemyId: string | null) => void
  startNewAttack: (targetEnemyIds: string[]) => void
  assignBlockToEnemy: (enemyInstanceId: string) => void
  removePlay: (playId: string) => void
  undoLastPlay: () => void
  resetPhase: () => void

  // Builders
  buildAttackDeclarations: () => AttackDeclaration[]
  buildBlockDeclarations: () => BlockDeclaration[]
}

// ── Element combination helper ──────────────

function combineElements(plays: CombatCardPlay[]): Element {
  if (plays.length === 0) return 'physical'
  const first = plays[0].element
  const allSame = plays.every((p) => p.element === first)
  return allSame ? first : 'physical'
}

// ── Hook ─────────────────────────────────────

export function useCombatCards(
  phase: CombatPhase,
  hand: AnyCard[],
  units: UnitInstance[],
  enemies: EnemyInstance[],
  skills: HeroSkill[] = [],
  dayNight: DayNight = 'day',
): UseCombatCardsReturn {
  const { t } = useTranslation('ui')
  const { t: tSkills } = useTranslation('heroSkills')
  const { getCardName, getUnitName } = useCardTranslation()
  const [state, setState] = useState<CombatCardsState>({
    ...INITIAL_COMBAT_CARDS_STATE,
    usedCardIndices: new Set(),
    usedUnitIndices: new Set(),
    usedSkillIndices: new Set(),
  })

  const playCounterRef = useRef(0)
  const attackCounterRef = useRef(0)

  // ── Reset when phase changes ──────────────

  useEffect(() => {
    setState({
      ...INITIAL_COMBAT_CARDS_STATE,
      usedCardIndices: new Set(),
      usedUnitIndices: new Set(),
      usedSkillIndices: new Set(),
    })
    playCounterRef.current = 0
    attackCounterRef.current = 0
  }, [phase])

  // ── Play ID generation ────────────────────

  const nextPlayId = useCallback((): string => {
    const id = `play_${playCounterRef.current}`
    playCounterRef.current += 1
    return id
  }, [])

  const nextAttackId = useCallback((): string => {
    const id = `attack_${attackCounterRef.current}`
    attackCounterRef.current += 1
    return id
  }, [])

  // ── Auto-assign play to pending attack/block ──

  const autoAssignPlay = useCallback(
    (play: CombatCardPlay, currentState: CombatCardsState): CombatCardsState => {
      const isAttackPhase = phase === 'ranged_siege' || phase === 'attack'
      const isBlockPhase = phase === 'block'

      if (isAttackPhase && currentState.activeTargetEnemyId) {
        // Auto-create a pending attack when the active target has none yet —
        // otherwise plays would silently attach to nothing and be wasted.
        const hasAttackForTarget = currentState.pendingAttacks.some((pa) =>
          pa.targetEnemyIds.includes(currentState.activeTargetEnemyId!),
        )
        const baseAttacks = hasAttackForTarget
          ? currentState.pendingAttacks
          : [
              ...currentState.pendingAttacks,
              {
                id: `attack_auto_${currentState.pendingAttacks.length}_${play.id}`,
                targetEnemyIds: [currentState.activeTargetEnemyId],
                plays: [],
                totalValue: 0,
                element: 'physical' as const,
                isSiege: false,
                isRanged: false,
              },
            ]

        const updatedAttacks = baseAttacks.map((pa) => {
          const isActiveTarget = pa.targetEnemyIds.includes(currentState.activeTargetEnemyId!)
          if (!isActiveTarget) return pa

          const updatedPlays = [...pa.plays, play]
          return {
            ...pa,
            plays: updatedPlays,
            totalValue: updatedPlays.reduce((sum, p) => sum + p.value, 0),
            element: combineElements(updatedPlays),
            isSiege: updatedPlays.some((p) => p.chosenAction !== null && isSiegeAction(p.chosenAction)),
            isRanged: updatedPlays.some((p) => p.chosenAction !== null && isRangedAction(p.chosenAction)),
          }
        })

        return { ...currentState, pendingAttacks: updatedAttacks }
      }

      if (isBlockPhase && currentState.activeTargetEnemyId) {
        const updatedBlocks = currentState.pendingBlocks.map((pb) => {
          if (pb.enemyInstanceId !== currentState.activeTargetEnemyId) return pb

          const updatedPlays = [...pb.plays, play]
          return {
            ...pb,
            plays: updatedPlays,
            totalValue: updatedPlays.reduce((sum, p) => sum + p.value, 0),
            element: combineElements(updatedPlays),
          }
        })

        return { ...currentState, pendingBlocks: updatedBlocks }
      }

      return currentState
    },
    [phase],
  )

  // ── playCardForPhase ──────────────────────

  const playCardForPhase = useCallback(
    (handIndex: number, effectType: 'basic' | 'strong', chosenAction: CardAction) => {
      setState((prev) => {
        const card = hand[handIndex]
        if (!card) return prev
        if (card.type === 'wound') return prev
        if (prev.usedCardIndices.has(handIndex)) return prev

        // Spells cost mana for BOTH effects (basic = the spell's colour); Action
        // cards have a free basic effect. Reading the chosen effect's manaCost
        // handles both: actions' basicEffect has none, spells' basicSpell does.
        const manaCost = getCardEffect(card, effectType)?.manaCost

        const play: CombatCardPlay = {
          id: nextPlayId(),
          sourceType: 'card',
          cardIndex: handIndex,
          cardId: card.id,
          cardName: getCardName(card),
          effectType,
          chosenAction,
          value: getActionValue(chosenAction),
          element: getActionElement(chosenAction),
          manaCost,
        }

        const newUsedCards = new Set(prev.usedCardIndices)
        newUsedCards.add(handIndex)

        const nextState: CombatCardsState = {
          ...prev,
          plays: [...prev.plays, play],
          usedCardIndices: newUsedCards,
        }

        return autoAssignPlay(play, nextState)
      })
    },
    [hand, nextPlayId, autoAssignPlay],
  )

  // ── playCardSideways ──────────────────────

  const playCardSideways = useCallback(
    (handIndex: number) => {
      // Rulebook p.7: cards cannot be played sideways to contribute to
      // Ranged or Siege Attacks (only Block and melee Attack phases allow it).
      if (phase === 'ranged_siege') return
      setState((prev) => {
        const card = hand[handIndex]
        if (!card) return prev
        if (card.type === 'wound') return prev
        if (prev.usedCardIndices.has(handIndex)) return prev

        const play: CombatCardPlay = {
          id: nextPlayId(),
          sourceType: 'card',
          cardIndex: handIndex,
          cardId: card.id,
          cardName: getCardName(card),
          effectType: 'sideways',
          chosenAction: null,
          value: 1,
          element: 'physical',
        }

        const newUsedCards = new Set(prev.usedCardIndices)
        newUsedCards.add(handIndex)

        const nextState: CombatCardsState = {
          ...prev,
          plays: [...prev.plays, play],
          usedCardIndices: newUsedCards,
        }

        return autoAssignPlay(play, nextState)
      })
    },
    [hand, nextPlayId, autoAssignPlay, phase],
  )

  // ── playConcentrationCombo ────────────────
  // Concentration (+2) / Will Focus (+3): pay the green mana, then play another
  // Action card's strong effect for free with +bonus added to its value.

  const playConcentrationCombo = useCallback(
    (
      concentrationIndex: number,
      targetIndex: number,
      targetAction: CardAction,
      bonus: number,
      concentrationManaCost: string | string[] | undefined,
    ) => {
      setState((prev) => {
        const cCard = hand[concentrationIndex]
        const tCard = hand[targetIndex]
        if (!cCard || !tCard) return prev
        if (cCard.type === 'wound' || tCard.type === 'wound') return prev
        if (prev.usedCardIndices.has(concentrationIndex) || prev.usedCardIndices.has(targetIndex)) return prev

        const targetElement = getActionElement(targetAction)

        // Concentration itself contributes no value; it shares the target's
        // element so it doesn't dilute a fire/ice attack to physical.
        const concentrationPlay: CombatCardPlay = {
          id: nextPlayId(),
          sourceType: 'card',
          cardIndex: concentrationIndex,
          cardId: cCard.id,
          cardName: getCardName(cCard),
          effectType: 'strong',
          chosenAction: { type: 'special', value: 0, description: 'concentration combo' },
          value: 0,
          element: targetElement,
          manaCost: concentrationManaCost,
        }

        const targetPlay: CombatCardPlay = {
          id: nextPlayId(),
          sourceType: 'card',
          cardIndex: targetIndex,
          cardId: tCard.id,
          cardName: `${getCardName(tCard)} (+${bonus})`,
          effectType: 'strong',
          chosenAction: targetAction,
          value: getActionValue(targetAction) + bonus,
          element: targetElement,
          // Free — the green mana paid for Concentration covers this card too.
          manaCost: undefined,
        }

        const newUsed = new Set(prev.usedCardIndices)
        newUsed.add(concentrationIndex)
        newUsed.add(targetIndex)

        let next: CombatCardsState = {
          ...prev,
          plays: [...prev.plays, concentrationPlay, targetPlay],
          usedCardIndices: newUsed,
        }
        next = autoAssignPlay(concentrationPlay, next)
        next = autoAssignPlay(targetPlay, next)
        return next
      })
    },
    [hand, nextPlayId, autoAssignPlay, getCardName],
  )

  // ── activateUnit ──────────────────────────

  const activateUnit = useCallback(
    (unitIndex: number, action: CardAction, ability: UnitAbility) => {
      setState((prev) => {
        const unit = units[unitIndex]
        if (!unit) return prev
        if (unit.status !== 'ready') return prev
        if (prev.usedUnitIndices.has(unitIndex)) return prev

        // Banner of Glory etc.: attack/block contributions gain the banner bonus
        const bannerBonus = getBannerCombatBonus(unit, action.type)

        const play: CombatCardPlay = {
          id: nextPlayId(),
          sourceType: 'unit',
          unitIndex,
          cardId: unit.unit.id,
          cardName: `${getUnitName(unit.unit)} — ${ability.name}`,
          effectType: 'basic',
          chosenAction: action,
          value: getActionValue(action) + bannerBonus,
          element: getActionElement(action),
        }

        const newUsedUnits = new Set(prev.usedUnitIndices)
        newUsedUnits.add(unitIndex)

        const nextState: CombatCardsState = {
          ...prev,
          plays: [...prev.plays, play],
          usedUnitIndices: newUsedUnits,
        }

        return autoAssignPlay(play, nextState)
      })
    },
    [units, nextPlayId, autoAssignPlay],
  )

  // ── activateSkillForCombat (UNIT-09-B) ────

  const activateSkillForCombat = useCallback(
    (skillIndex: number, action: CardAction) => {
      setState((prev) => {
        const skill = skills[skillIndex]
        if (!skill) return prev
        if (prev.usedSkillIndices.has(skillIndex)) return prev
        // global usage limits (once per turn / round)
        if (skill.type === 'once_per_turn' && skill.isUsedThisTurn) return prev
        if ((skill.type === 'once_per_round' || skill.type === 'interactive_once_per_round') && skill.isFlipped) return prev

        // Power of Pain: the synthesized attack/block also consumes a wound,
        // which is played alongside (0 value) so it lands in the play area.
        let usedCards = prev.usedCardIndices
        let woundPlay: CombatCardPlay | null = null
        if (action.woundAsCard) {
          const woundIdx = hand.findIndex(
            (c, idx) => c.type === 'wound' && !prev.usedCardIndices.has(idx),
          )
          if (woundIdx === -1) return prev
          woundPlay = {
            id: nextPlayId(),
            sourceType: 'card',
            cardIndex: woundIdx,
            cardId: hand[woundIdx].id,
            cardName: t('game.woundCard', { defaultValue: 'Wound' }),
            effectType: 'basic',
            chosenAction: { type: 'discard_cost', value: 0, description: 'Power of Pain wound' },
            value: 0,
            element: 'physical',
          }
          usedCards = new Set(prev.usedCardIndices)
          usedCards.add(woundIdx)
        }

        const play: CombatCardPlay = {
          id: nextPlayId(),
          sourceType: 'skill',
          skillIndex,
          cardId: skill.id,
          cardName: tSkills(`${skill.id}.name`, { defaultValue: skill.name }),
          effectType: 'basic',
          chosenAction: action,
          value: getActionValue(action),
          element: getActionElement(action),
        }

        const newUsedSkills = new Set(prev.usedSkillIndices)
        newUsedSkills.add(skillIndex)

        const nextState: CombatCardsState = {
          ...prev,
          plays: woundPlay ? [...prev.plays, woundPlay, play] : [...prev.plays, play],
          usedCardIndices: usedCards,
          usedSkillIndices: newUsedSkills,
        }

        return autoAssignPlay(play, nextState)
      })
    },
    [skills, hand, nextPlayId, autoAssignPlay],
  )

  // ── playManaCardForCombat ─────────────────
  // Register a mana-generating card (e.g. Mana Draw) as played this phase so it
  // is consumed at combat end. The mana itself is applied separately by the
  // engine; this only adds a 0-value play + marks the hand index used. No
  // attack/block value, so it is NOT auto-assigned to an enemy.
  const playManaCardForCombat = useCallback(
    (handIndex: number) => {
      setState((prev) => {
        if (prev.usedCardIndices.has(handIndex)) return prev
        const card = hand[handIndex]
        if (!card) return prev
        const play: CombatCardPlay = {
          id: nextPlayId(),
          sourceType: 'card',
          cardIndex: handIndex,
          cardId: card.id,
          cardName: getCardName(card),
          effectType: 'basic',
          chosenAction: { type: 'mana', value: 0, description: 'mana generation' },
          value: 0,
          element: 'physical',
        }
        const used = new Set(prev.usedCardIndices)
        used.add(handIndex)
        return { ...prev, plays: [...prev.plays, play], usedCardIndices: used }
      })
    },
    [hand, nextPlayId, getCardName],
  )

  // ── setActiveTarget ───────────────────────

  const setActiveTarget = useCallback((enemyId: string | null) => {
    setState((prev) => ({ ...prev, activeTargetEnemyId: enemyId }))
  }, [])

  // ── startNewAttack ────────────────────────

  const startNewAttack = useCallback(
    (targetEnemyIds: string[]) => {
      setState((prev) => {
        const newAttack: PendingAttack = {
          id: nextAttackId(),
          targetEnemyIds,
          plays: [],
          totalValue: 0,
          element: 'physical',
          isSiege: false,
          isRanged: false,
        }

        return {
          ...prev,
          pendingAttacks: [...prev.pendingAttacks, newAttack],
          activeTargetEnemyId: targetEnemyIds[0] ?? null,
        }
      })
    },
    [nextAttackId],
  )

  // ── assignBlockToEnemy ────────────────────

  const assignBlockToEnemy = useCallback(
    (enemyInstanceId: string) => {
      setState((prev) => {
        const enemy = enemies.find((e) => e.instanceId === enemyInstanceId)
        if (!enemy) return prev

        const isSwift = enemy.appliedAbilities.includes('swift')
        const requiredValue = isSwift ? enemy.currentAttack * 2 : enemy.currentAttack

        const newBlock: PendingBlock = {
          enemyInstanceId,
          plays: [],
          totalValue: 0,
          element: 'physical',
          requiredValue,
          isSwift,
        }

        return {
          ...prev,
          pendingBlocks: [...prev.pendingBlocks, newBlock],
          activeTargetEnemyId: enemyInstanceId,
        }
      })
    },
    [enemies],
  )

  // ── removePlay ────────────────────────────

  const removePlay = useCallback((playId: string) => {
    setState((prev) => {
      const play = prev.plays.find((p) => p.id === playId)
      if (!play) return prev

      const newPlays = prev.plays.filter((p) => p.id !== playId)

      // Free up the card/unit/skill index
      const newUsedCards = new Set(prev.usedCardIndices)
      const newUsedUnits = new Set(prev.usedUnitIndices)
      const newUsedSkills = new Set(prev.usedSkillIndices)

      if (play.sourceType === 'card' && play.cardIndex !== undefined) {
        newUsedCards.delete(play.cardIndex)
      }
      if (play.sourceType === 'unit' && play.unitIndex !== undefined) {
        newUsedUnits.delete(play.unitIndex)
      }
      if (play.sourceType === 'skill' && play.skillIndex !== undefined) {
        newUsedSkills.delete(play.skillIndex)
      }

      // Remove from pending attacks
      const updatedAttacks = prev.pendingAttacks.map((pa) => {
        const filteredPlays = pa.plays.filter((p) => p.id !== playId)
        if (filteredPlays.length === pa.plays.length) return pa
        return {
          ...pa,
          plays: filteredPlays,
          totalValue: filteredPlays.reduce((sum, p) => sum + p.value, 0),
          element: combineElements(filteredPlays),
          isSiege: filteredPlays.some((p) => p.chosenAction !== null && isSiegeAction(p.chosenAction)),
          isRanged: filteredPlays.some((p) => p.chosenAction !== null && isRangedAction(p.chosenAction)),
        }
      })

      // Remove from pending blocks
      const updatedBlocks = prev.pendingBlocks.map((pb) => {
        const filteredPlays = pb.plays.filter((p) => p.id !== playId)
        if (filteredPlays.length === pb.plays.length) return pb
        return {
          ...pb,
          plays: filteredPlays,
          totalValue: filteredPlays.reduce((sum, p) => sum + p.value, 0),
          element: combineElements(filteredPlays),
        }
      })

      return {
        ...prev,
        plays: newPlays,
        usedCardIndices: newUsedCards,
        usedUnitIndices: newUsedUnits,
        usedSkillIndices: newUsedSkills,
        pendingAttacks: updatedAttacks,
        pendingBlocks: updatedBlocks,
      }
    })
  }, [])

  // ── undoLastPlay ──────────────────────────

  const undoLastPlay = useCallback(() => {
    setState((prev) => {
      if (prev.plays.length === 0) return prev

      const lastPlay = prev.plays[prev.plays.length - 1]
      const playId = lastPlay.id

      const newPlays = prev.plays.slice(0, -1)

      const newUsedCards = new Set(prev.usedCardIndices)
      const newUsedUnits = new Set(prev.usedUnitIndices)
      const newUsedSkills = new Set(prev.usedSkillIndices)

      if (lastPlay.sourceType === 'card' && lastPlay.cardIndex !== undefined) {
        newUsedCards.delete(lastPlay.cardIndex)
      }
      if (lastPlay.sourceType === 'unit' && lastPlay.unitIndex !== undefined) {
        newUsedUnits.delete(lastPlay.unitIndex)
      }
      if (lastPlay.sourceType === 'skill' && lastPlay.skillIndex !== undefined) {
        newUsedSkills.delete(lastPlay.skillIndex)
      }

      const updatedAttacks = prev.pendingAttacks.map((pa) => {
        const filteredPlays = pa.plays.filter((p) => p.id !== playId)
        if (filteredPlays.length === pa.plays.length) return pa
        return {
          ...pa,
          plays: filteredPlays,
          totalValue: filteredPlays.reduce((sum, p) => sum + p.value, 0),
          element: combineElements(filteredPlays),
          isSiege: filteredPlays.some((p) => p.chosenAction !== null && isSiegeAction(p.chosenAction)),
          isRanged: filteredPlays.some((p) => p.chosenAction !== null && isRangedAction(p.chosenAction)),
        }
      })

      const updatedBlocks = prev.pendingBlocks.map((pb) => {
        const filteredPlays = pb.plays.filter((p) => p.id !== playId)
        if (filteredPlays.length === pb.plays.length) return pb
        return {
          ...pb,
          plays: filteredPlays,
          totalValue: filteredPlays.reduce((sum, p) => sum + p.value, 0),
          element: combineElements(filteredPlays),
        }
      })

      return {
        ...prev,
        plays: newPlays,
        usedCardIndices: newUsedCards,
        usedUnitIndices: newUsedUnits,
        usedSkillIndices: newUsedSkills,
        pendingAttacks: updatedAttacks,
        pendingBlocks: updatedBlocks,
      }
    })
  }, [])

  // ── resetPhase ────────────────────────────

  const resetPhase = useCallback(() => {
    setState({
      ...INITIAL_COMBAT_CARDS_STATE,
      usedCardIndices: new Set(),
      usedUnitIndices: new Set(),
      usedSkillIndices: new Set(),
    })
    playCounterRef.current = 0
    attackCounterRef.current = 0
  }, [])

  // ── availableCards (computed) ──────────────

  const availableCards = useMemo(() => {
    const result: Array<{ card: AnyCard; index: number; isRelevant: boolean }> = []
    for (let i = 0; i < hand.length; i++) {
      if (state.usedCardIndices.has(i)) continue
      const card = hand[i]
      const isRelevant = isCardRelevantForPhase(card, phase)
      result.push({ card, index: i, isRelevant })
    }
    return result
  }, [hand, state.usedCardIndices, phase])

  // ── availableUnits (computed) ─────────────

  const availableUnits = useMemo(() => {
    const result: Array<{
      unit: UnitInstance
      index: number
      actions: Array<{ ability: UnitAbility; action: CardAction }>
    }> = []

    for (let i = 0; i < units.length; i++) {
      if (state.usedUnitIndices.has(i)) continue
      const unit = units[i]
      const actions = getUnitCombatActions(unit, phase)
      if (actions.length > 0) {
        result.push({ unit, index: i, actions })
      }
    }

    return result
  }, [units, state.usedUnitIndices, phase])

  // ── availableSkills (computed) ────────────

  const availableSkills = useMemo(() => {
    const result: Array<{ skill: HeroSkill; index: number; actions: CardAction[] }> = []
    for (let i = 0; i < skills.length; i++) {
      if (state.usedSkillIndices.has(i)) continue
      const skill = skills[i]
      if (skill.type === 'once_per_turn' && skill.isUsedThisTurn) continue
      if ((skill.type === 'once_per_round' || skill.type === 'interactive_once_per_round') && skill.isFlipped) continue
      // Day/Night-conditioned actions (e.g. Day Sharpshooting) must match the cycle
      const actions = filterActionsForPhase(skill.actions, phase).filter(
        (a) => !a.condition || a.condition === dayNight,
      )

      // Leadership (unit_boost): once a unit has been activated this phase,
      // the boost can be added to its contribution
      const unitBoost = skill.actions.find((a) => a.type === 'unit_boost')
      if (unitBoost && state.plays.some((pl) => pl.sourceType === 'unit')) {
        if (phase === 'ranged_siege' && typeof unitBoost.ranged_attack === 'number') {
          actions.push({ type: 'ranged_attack', value: unitBoost.ranged_attack, description: 'unit boost' })
        } else if (phase === 'attack' && typeof unitBoost.attack === 'number') {
          actions.push({ type: 'attack', value: unitBoost.attack, description: 'unit boost' })
        } else if (phase === 'block' && typeof unitBoost.block === 'number') {
          actions.push({ type: 'block', value: unitBoost.block, description: 'unit boost' })
        }
      }

      // Power of Pain (wound_as_card): synthesize Attack/Block +bonus when a
      // wound is available to play sideways
      const powerOfPain = skill.actions.find((a) => a.type === 'wound_as_card')
      if (powerOfPain) {
        const bonus = typeof powerOfPain.bonusValue === 'number' ? powerOfPain.bonusValue : 2
        const woundAvailable = hand.some(
          (c, idx) => c.type === 'wound' && !state.usedCardIndices.has(idx),
        )
        if (woundAvailable) {
          if (phase === 'attack') {
            actions.push({ type: 'attack', value: bonus, woundAsCard: true, description: 'wound sideways' })
          } else if (phase === 'block') {
            actions.push({ type: 'block', value: bonus, woundAsCard: true, description: 'wound sideways' })
          }
        }
      }

      if (actions.length > 0) {
        result.push({ skill, index: i, actions })
      }
    }
    return result
  }, [skills, hand, state.usedSkillIndices, state.usedCardIndices, state.plays, phase, dayNight])

  // ── totalPhaseValue (computed) ────────────

  const totalPhaseValue = useMemo(() => {
    return state.plays.reduce((sum, play) => sum + play.value, 0)
  }, [state.plays])

  // ── canConfirm (computed) ─────────────────

  const canConfirm = useMemo(() => {
    // Player can always confirm (skip phase with 0 plays) — Mage Knight rules
    return true
  }, [])

  // ── buildAttackDeclarations ───────────────

  const buildAttackDeclarations = useCallback((): AttackDeclaration[] => {
    return state.pendingAttacks.map((pa) => ({
      id: pa.id,
      targetEnemyIds: pa.targetEnemyIds,
      attackValue: pa.totalValue,
      attackElement: pa.element,
      isSiege: pa.isSiege,
      isRanged: pa.isRanged,
      cardIds: pa.plays.filter((p) => p.sourceType === 'card').map((p) => String(p.cardId)),
      unitIds: pa.plays.filter((p) => p.sourceType === 'unit').map((p) => String(p.cardId)),
    }))
  }, [state.pendingAttacks])

  // ── buildBlockDeclarations ────────────────

  const buildBlockDeclarations = useCallback((): BlockDeclaration[] => {
    return state.pendingBlocks.map((pb) => ({
      enemyInstanceId: pb.enemyInstanceId,
      blockValue: pb.totalValue,
      blockElement: pb.element,
      cardIds: pb.plays.filter((p) => p.sourceType === 'card').map((p) => String(p.cardId)),
      unitIds: pb.plays.filter((p) => p.sourceType === 'unit').map((p) => String(p.cardId)),
      isSuccessful: pb.totalValue >= pb.requiredValue,
    }))
  }, [state.pendingBlocks])

  // ── Return ────────────────────────────────

  return {
    // State
    plays: state.plays,
    pendingAttacks: state.pendingAttacks,
    pendingBlocks: state.pendingBlocks,
    usedCardIndices: state.usedCardIndices,
    usedUnitIndices: state.usedUnitIndices,
    activeTargetEnemyId: state.activeTargetEnemyId,

    // Computed
    availableCards,
    availableUnits,
    availableSkills,
    totalPhaseValue,
    canConfirm,

    // Actions
    playCardForPhase,
    playCardSideways,
    playConcentrationCombo,
    activateUnit,
    activateSkillForCombat,
    playManaCardForCombat,
    setActiveTarget,
    startNewAttack,
    assignBlockToEnemy,
    removePlay,
    undoLastPlay,
    resetPhase,

    // Builders
    buildAttackDeclarations,
    buildBlockDeclarations,
  }
}
