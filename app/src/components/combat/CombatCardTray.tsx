import { useState, useCallback, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useCardTranslation } from '@/hooks/useCardTranslation'
import { useGameStore } from '@/store/gameStore'
import { useGameEngine } from '@/hooks/useGameEngine'
import CardDetail from '@/components/cards/CardDetail'
import ManaStrip from '@/components/common/ManaStrip'
import { validateCardPlay } from '@/engine/CardPlayValidator'
import type { CardPlayValidation } from '@/engine/CardPlayValidator'
import { translateValidationReason } from '@/utils/validationReason'
import type { UseCombatCardsReturn } from '@/hooks/useCombatCards'
import type { AnyCard, CombatPhase, CardAction, UnitAbility, DeedCard, ManaColor, ExtendedManaColor } from '@/engine/types'
import type { GameState } from '@/engine/GameState'
import type { CombatCardPlay } from '@/engine/combatCardTypes'
import {
  getCardEffect, filterActionsForPhase, getManaCost, getActionValue,
  getConcentrationBonus, getStrongComboAction,
} from '@/utils/combatCardUtils'

// ── Constants ────────────────────────────────

const PHASE_LABEL_KEY: Record<CombatPhase, string> = {
  ranged_siege: 'combat.phaseRangedSiege',
  block: 'combat.phaseBlock',
  assign_damage: 'combat.phaseAssignDamage',
  attack: 'combat.phaseMeleeAttack',
  combat_end: 'combat.phaseCombatEnd',
}

const ELEM: Record<string, { text: string; bg: string }> = {
  physical: { text: 'text-slate-300', bg: 'bg-slate-700/50' },
  fire: { text: 'text-orange-400', bg: 'bg-orange-900/40' },
  ice: { text: 'text-cyan-400', bg: 'bg-cyan-900/40' },
  cold_fire: { text: 'text-purple-400', bg: 'bg-purple-900/40' },
}

const TYPE_ICON: Record<string, string> = {
  basic_action: '⚔', advanced_action: '🗡', spell: '✦', artifact: '◆', wound: '⚡',
}

const ACT_ICON: Record<string, string> = {
  attack: '⚔', block: '🛡', ranged_attack: '🏹', siege_attack: '💥',
}

const STRIP: Record<string, string> = {
  red: 'bg-red-500', blue: 'bg-blue-500', green: 'bg-emerald-500', white: 'bg-slate-200',
}

const bodyVariants = {
  // overflow is hidden only while the height animates; once expanded it switches
  // to visible so the upward action-picker popover isn't clipped (it sits above
  // the card with `bottom-full`).
  collapsed: { height: 0, opacity: 0, overflow: 'hidden' },
  expanded: {
    height: 'auto', opacity: 1,
    transition: { type: 'spring' as const, damping: 28, stiffness: 320, opacity: { duration: 0.2 } },
    transitionEnd: { overflow: 'visible' },
  },
}

const pickerVariants = {
  hidden: { opacity: 0, y: -4, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.12 } },
  exit: { opacity: 0, y: -4, scale: 0.95, transition: { duration: 0.08 } },
}

// ── Helpers ──────────────────────────────────

function renderStrip(card: AnyCard) {
  if (card.type === 'wound') return <div className="h-1 w-full rounded-t bg-red-800/80" />
  const c = card.color
  if (!c) return null
  if (Array.isArray(c)) {
    return (
      <div className="flex h-1 w-full overflow-hidden rounded-t">
        {c.map((v, i) => <div key={`${v}-${i}`} className={`flex-1 ${STRIP[v] ?? 'bg-slate-600'}`} />)}
      </div>
    )
  }
  return <div className={`h-1 w-full rounded-t ${STRIP[c] ?? 'bg-slate-600'}`} />
}

function fmtAction(a: CardAction): string {
  const d = a.description ?? a.type.replace(/_/g, ' ')
  return a.value != null ? `${d} ${a.value}` : d
}

// ── CardActionPicker ─────────────────────────

function PickerRow({ label, icon, amber, mana, onClick }: {
  label: string; icon: string; amber?: boolean; mana?: string | string[]; onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className={[
      'flex min-h-[40px] w-full items-center gap-1.5 rounded-md px-2 py-2 text-left text-[10px] transition-colors sm:min-h-0 sm:py-1.5',
      amber ? 'hover:bg-amber-900/30' : 'hover:bg-slate-700/80',
    ].join(' ')}>
      <span className="shrink-0 text-xs">{icon}</span>
      <span className={`flex-1 truncate font-medium ${amber ? 'text-amber-200' : 'text-slate-200'}`}>{label}</span>
      {mana && (
        <span className="shrink-0 rounded-full bg-amber-700/50 px-1.5 py-0.5 text-[8px] font-bold text-amber-300">
          {Array.isArray(mana) ? mana.join('/') : mana}
        </span>
      )}
    </button>
  )
}

interface PickerProps {
  card: AnyCard; handIndex: number; phase: CombatPhase
  onSelect: (idx: number, eff: 'basic' | 'strong', a: CardAction) => void
  onSideways: (idx: number) => void; onClose: () => void
  onViewDetail: (card: AnyCard) => void
  onImprovisation?: (idx: number, eff: 'basic' | 'strong', action: CardAction) => void
  onConcentration?: (idx: number, bonus: number) => void
  onPlayMana?: (idx: number, mode: 'basic' | 'strong', color?: ExtendedManaColor) => void
  dayNight?: 'day' | 'night'
  canPlayBasic: boolean
  /** Localized reason why the basic effect can't be played (spells need their colour mana) */
  basicReason?: string
  canPlayStrong: boolean
  /** Localized reason why strong can't be played (e.g. "needs black mana at night") */
  strongReason?: string
}

/** Cards that generate mana and may be played during combat (rulebook special effects). */
function isManaCard(card: AnyCard): boolean {
  return card.type !== 'wound' && 'name' in card && card.name === 'Mana Draw'
}

/** Check if a card is Improvisation (special discard-to-choose card) */
function isImprovisationCard(card: AnyCard): boolean {
  return card.type !== 'wound' && 'name' in card && card.name === 'Improvisation'
}

/** Generate synthetic combat actions for Improvisation based on phase */
function getImprovisationActionsForPhase(phase: CombatPhase, value: number): CardAction[] {
  switch (phase) {
    case 'ranged_siege':
      return [] // Improvisation doesn't provide ranged/siege
    case 'block':
      return [{ type: 'block', value, choice: true }]
    case 'attack':
      return [{ type: 'attack', value, choice: true }]
    default:
      return []
  }
}

function CardActionPicker({ card, handIndex, phase, onSelect, onSideways, onClose, onViewDetail, onImprovisation, onConcentration, onPlayMana, dayNight, canPlayBasic, basicReason, canPlayStrong, strongReason }: PickerProps) {
  const { t } = useTranslation('ui')
  if (card.type === 'wound') return null
  const manaCard = isManaCard(card)
  const basic = getCardEffect(card, 'basic')
  const strong = getCardEffect(card, 'strong')
  const mana = getManaCost(card)

  // Special handling for Improvisation
  const isImprov = isImprovisationCard(card)

  // Concentration / Will Focus combo (boosts another Action card's strong effect)
  const comboBonus = getConcentrationBonus(card)

  // Spells cost their colour mana even for the basic effect — show it as a badge
  const spellBasicMana = card.type === 'spell' ? card.basicSpell.manaCost : undefined

  const bActs = isImprov
    ? getImprovisationActionsForPhase(phase, 3)
    : (basic ? filterActionsForPhase(basic.actions, phase) : [])
  const sActs = isImprov
    ? getImprovisationActionsForPhase(phase, 5)
    : (strong ? filterActionsForPhase(strong.actions, phase) : [])
  const bChoice = bActs.filter((a) => a.choice), bNon = bActs.filter((a) => !a.choice)
  const sChoice = sActs.filter((a) => a.choice), sNon = sActs.filter((a) => !a.choice)

  const pick = (eff: 'basic' | 'strong', a: CardAction) => {
    if (eff === 'strong' && !canPlayStrong) return // mana check
    if (eff === 'basic' && !canPlayBasic) return // spells need their colour mana
    if (isImprov && onImprovisation) {
      onImprovisation(handIndex, eff, a)
      onClose()
    } else {
      onSelect(handIndex, eff, a)
      onClose()
    }
  }
  const side = () => { onSideways(handIndex); onClose() }

  return (
    <motion.div
      className="absolute bottom-full left-1/2 z-30 mb-1.5 w-44 -translate-x-1/2 rounded-lg border border-slate-600/60 bg-slate-800 p-1.5 shadow-xl shadow-black/40"
      variants={pickerVariants} initial="hidden" animate="visible" exit="exit"
    >
      <PickerRow label={t('combat.viewCardDetail')} icon="🔍" onClick={() => { onViewDetail(card); onClose() }} />
      <div className="my-1 h-px bg-slate-700/60" />
      {manaCard && onPlayMana && (
        <>
          <PickerRow
            label={t('combat.manaDrawBasic', { defaultValue: 'Mana Draw: +1 Source die' })}
            icon="🎲"
            onClick={() => { onPlayMana(handIndex, 'basic'); onClose() }}
          />
          {(['red', 'blue', 'green', 'white', 'black'] as ExtendedManaColor[])
            .filter((c) => c !== 'black' || dayNight === 'night')
            .map((c) => (
              <PickerRow
                key={`md-${c}`}
                label={t('combat.manaDrawStrong', { defaultValue: 'Mana Draw: +2 {{color}} mana', color: t(`colors.${c}`, { defaultValue: c }) })}
                icon="✦"
                amber
                onClick={() => { onPlayMana(handIndex, 'strong', c); onClose() }}
              />
            ))}
          <div className="my-1 h-px bg-slate-700/60" />
        </>
      )}
      {bNon.length > 0 && (
        <PickerRow
          label={canPlayBasic
            ? `${t('combat.basicEffect')}: ${bNon.map(fmtAction).join(', ')}`
            : `${t('combat.basicEffect')}: ${bNon.map(fmtAction).join(', ')} (${basicReason ?? t('combat.noMana', 'No Mana')})`}
          icon={ACT_ICON[bNon[0].type] ?? '◈'}
          mana={spellBasicMana}
          onClick={() => pick('basic', bNon[0])} />
      )}
      {/* Blood Rage: optional "take a Wound for a bigger Attack" variants. */}
      {'name' in card && card.name === 'Blood Rage' && (phase === 'attack' || phase === 'ranged_siege') && (
        <>
          <PickerRow
            label={t('combat.bloodRageBasic', { defaultValue: 'Take a Wound → Attack 5' })}
            icon="🩸"
            onClick={() => pick('basic', { type: 'special', value: 0 })} />
          {canPlayStrong && (
            <PickerRow
              label={t('combat.bloodRageStrong', { defaultValue: 'Take a Wound → Attack 9' })}
              icon="🩸" amber mana={mana}
              onClick={() => pick('strong', { type: 'special', value: 0 })} />
          )}
        </>
      )}
      {/* Diplomacy: "you may use Influence as Block this turn" — in the block
          phase offer the card's Influence value (2/4) as Block. Strong picks an
          element (Ice/Fire) for the elemental Block. */}
      {'name' in card && card.name === 'Diplomacy' && phase === 'block' && (
        <>
          <PickerRow
            label={t('combat.diplomacyBlock', { defaultValue: 'Influence → Block 2' })}
            icon="🛡"
            onClick={() => pick('basic', { type: 'block', value: 2 })} />
          {canPlayStrong && (
            <>
              <PickerRow
                label={t('combat.diplomacyFireBlock', { defaultValue: 'Influence → Fire Block 4' })}
                icon="🔥" amber mana={mana}
                onClick={() => pick('strong', { type: 'fire_block', value: 4 })} />
              <PickerRow
                label={t('combat.diplomacyIceBlock', { defaultValue: 'Influence → Ice Block 4' })}
                icon="❄" amber mana={mana}
                onClick={() => pick('strong', { type: 'ice_block', value: 4 })} />
            </>
          )}
        </>
      )}
      {bChoice.map((a, i) => (
        <PickerRow key={`bc-${i}`}
          label={canPlayBasic
            ? `${t('combat.basicEffect')}: ${fmtAction(a)}`
            : `${t('combat.basicEffect')}: ${fmtAction(a)} (${basicReason ?? t('combat.noMana', 'No Mana')})`}
          icon={ACT_ICON[a.type] ?? '◈'}
          mana={spellBasicMana}
          onClick={() => pick('basic', a)} />
      ))}
      {sNon.length > 0 && (
        <PickerRow
          label={canPlayStrong
            ? `${t('combat.strongEffect')}: ${sNon.map(fmtAction).join(', ')}`
            : `${t('combat.strongEffect')}: ${sNon.map(fmtAction).join(', ')} (${strongReason ?? t('combat.noMana', 'No Mana')})`}
          icon={ACT_ICON[sNon[0].type] ?? '◈'}
          amber={canPlayStrong} mana={mana}
          onClick={() => pick('strong', sNon[0])} />
      )}
      {sChoice.map((a, i) => (
        <PickerRow key={`sc-${i}`}
          label={canPlayStrong
            ? `${t('combat.strongEffect')}: ${fmtAction(a)}`
            : `${t('combat.strongEffect')}: ${fmtAction(a)} (${strongReason ?? t('combat.noMana', 'No Mana')})`}
          icon={ACT_ICON[a.type] ?? '◈'}
          amber={canPlayStrong} mana={mana}
          onClick={() => pick('strong', a)} />
      ))}
      {/* Concentration / Will Focus combo: play another Action card's strong
          effect for free with +bonus. Needs the green mana (canPlayStrong). */}
      {comboBonus != null && onConcentration && (
        <PickerRow
          label={canPlayStrong
            ? `${t('combat.comboPlay', 'Combo')}: +${comboBonus} (${t('combat.comboPickCard', 'pick a card')})`
            : `${t('combat.comboPlay', 'Combo')}: +${comboBonus} (${strongReason ?? t('combat.noMana', 'No Mana')})`}
          icon="✶"
          amber={canPlayStrong} mana={mana}
          onClick={() => { if (canPlayStrong) { onConcentration(handIndex, comboBonus); onClose() } }} />
      )}
      {/* Sideways play is forbidden in the Ranged/Siege phase (rulebook p.7):
          cards cannot be played sideways to contribute to Ranged or Siege Attacks. */}
      {phase !== 'ranged_siege' && (
        <>
          <div className="my-1 h-px bg-slate-700/60" />
          <PickerRow label={t('combat.playSideways')} icon="↗" amber onClick={side} />
        </>
      )}
    </motion.div>
  )
}

// ── PlayChip ─────────────────────────────────

function PlayChip({ play, onRemove }: { play: CombatCardPlay; onRemove: (id: string) => void }) {
  const { t } = useTranslation('ui')
  const el = ELEM[play.element] ?? ELEM.physical
  const sw = play.effectType === 'sideways'
  const st = play.effectType === 'strong'

  return (
    <div className={[
      'group flex items-center gap-1 rounded-md border px-2 py-1 text-[10px]',
      sw ? 'border-amber-700/30 bg-amber-950/20' : st ? 'border-amber-600/30 bg-amber-950/30' : 'border-slate-700/40 bg-slate-800/60',
    ].join(' ')}>
      <span className={`font-semibold ${sw ? 'text-amber-300/80' : el.text}`}>{play.cardName}</span>
      {sw
        ? <span className="rounded bg-amber-800/40 px-1 py-px text-[8px] font-bold text-amber-400">+1</span>
        : <span className={`rounded px-1 py-px text-[8px] font-bold ${el.bg} ${el.text}`}>{play.value}</span>}
      {st && play.manaCost && (
        <span className="rounded-full bg-amber-700/40 px-1 py-px text-[8px] font-bold text-amber-300">
          {Array.isArray(play.manaCost) ? play.manaCost.join('/') : play.manaCost}
        </span>
      )}
      <button type="button" onClick={() => onRemove(play.id)} aria-label={t('combat.removePlay', { defaultValue: 'Remove play' })}
        className="ml-0.5 rounded text-[9px] text-slate-500 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100">
        ✕
      </button>
    </div>
  )
}

// ── Main Component ───────────────────────────

interface CombatCardTrayProps {
  phase: CombatPhase
  combatCards: UseCombatCardsReturn
}

/** Check if a card's strong effect can be played given current mana */
function evaluateStrongPlay(
  card: AnyCard,
  engineState: GameState | null,
  dayNight: 'day' | 'night',
): CardPlayValidation | null {
  if (!engineState || card.type === 'wound') return null
  if (card.type === 'artifact') {
    return { canPlayBasic: true, canPlayStrong: true, requiredMana: null, requiresBlackMana: false }
  }
  const manaState = engineState.player.mana
  const hasColor = (c: ManaColor) =>
    manaState.playerMana.some((t) => t.color === c) || manaState.crystals[c] > 0
  const hasGold = manaState.playerMana.some((t) => t.color === 'gold') && dayNight === 'day'
  const hasBlack = manaState.playerMana.some((t) => t.color === 'black') && dayNight === 'night'
  return validateCardPlay(card as DeedCard, dayNight, { hasColor, hasBlack, hasGold })
}

export default function CombatCardTray({ phase, combatCards }: CombatCardTrayProps) {
  const { t } = useTranslation('ui')
  const { getCardName } = useCardTranslation()
  const engineState = useGameStore((s) => s.engineState)
  const dayNight = useGameStore((s) => s.dayNight) ?? 'day'
  const [isExpanded, setIsExpanded] = useState(true)
  const [pickerIdx, setPickerIdx] = useState<number | null>(null)
  const [detailCard, setDetailCard] = useState<DeedCard | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [improvMode, setImprovMode] = useState<{
    cardIndex: number
    effectType: 'basic' | 'strong'
    action: CardAction
  } | null>(null)
  const [concentrationMode, setConcentrationMode] = useState<{
    cardIndex: number
    bonus: number
    manaCost: string | string[] | undefined
  } | null>(null)

  const engine = useGameEngine()
  const {
    plays, availableCards, availableUnits, availableSkills, usedCardIndices, totalPhaseValue, activeTargetEnemyId,
    playCardForPhase, playCardSideways, playConcentrationCombo, activateUnit, activateSkillForCombat, playManaCardForCombat, playAgilityMove, removePlay, undoLastPlay, resetPhase,
  } = combatCards

  // Mana Draw (and other mana-generating specials) played in combat: apply the
  // mana to the pool now, and register the card so it's consumed at combat end.
  const handlePlayMana = useCallback((idx: number, mode: 'basic' | 'strong', color?: ExtendedManaColor) => {
    engine.applyManaDrawInCombat(mode, color)
    playManaCardForCombat(idx)
    setPickerIdx(null)
  }, [engine, playManaCardForCombat])

  const unitsWithActions = useMemo(() => availableUnits.filter((u) => u.actions.length > 0), [availableUnits])

  const toggleExpand = useCallback(() => setIsExpanded((p) => !p), [])

  const handleCardClick = useCallback((idx: number, card: AnyCard) => {
    if (card.type === 'wound' || usedCardIndices.has(idx)) return
    setPickerIdx((p) => (p === idx ? null : idx))
  }, [usedCardIndices])

  const handleSelect = useCallback((idx: number, eff: 'basic' | 'strong', a: CardAction) => {
    playCardForPhase(idx, eff, a); setPickerIdx(null)
  }, [playCardForPhase])

  const handleSideways = useCallback((idx: number) => {
    playCardSideways(idx); setPickerIdx(null)
  }, [playCardSideways])

  // Improvisation: step 1 — user picked an effect, now needs to discard a card
  const handleImprovisation = useCallback((cardIndex: number, effectType: 'basic' | 'strong', action: CardAction) => {
    setImprovMode({ cardIndex, effectType, action })
    setPickerIdx(null)
  }, [])

  // Improvisation: step 2 — user picked a card to discard
  const handleImprovDiscard = useCallback((discardIdx: number) => {
    if (!improvMode) return
    // First: play the Improvisation card with the chosen combat action (Attack 3 / Block 3 etc.)
    playCardForPhase(improvMode.cardIndex, improvMode.effectType, improvMode.action)
    // Then: mark the discarded card as used with a zero-value action (discard cost, no combat contribution)
    playCardForPhase(discardIdx, 'basic', { type: 'discard_cost', value: 0, description: 'Improvisation discard' })
    setImprovMode(null)
  }, [improvMode, playCardForPhase])

  // Concentration / Will Focus: step 1 — chose the combo, now pick a target card
  const handleConcentration = useCallback((cardIndex: number, bonus: number) => {
    const card = availableCards.find((c) => c.index === cardIndex)?.card
    setConcentrationMode({ cardIndex, bonus, manaCost: card && card.type !== 'wound' ? getManaCost(card) : undefined })
    setPickerIdx(null)
  }, [availableCards])

  // Concentration / Will Focus: step 2 — picked the target Action card
  const handleConcentrationTarget = useCallback((targetIndex: number) => {
    if (!concentrationMode) return
    const targetCard = availableCards.find((c) => c.index === targetIndex)?.card
    if (!targetCard) return
    const action = getStrongComboAction(targetCard, phase)
    if (!action) return
    playConcentrationCombo(concentrationMode.cardIndex, targetIndex, action, concentrationMode.bonus, concentrationMode.manaCost)
    setConcentrationMode(null)
  }, [concentrationMode, availableCards, phase, playConcentrationCombo])

  const closePicker = useCallback(() => setPickerIdx(null), [])

  // Agility: leftover Move points spendable as Attack this combat.
  const agility = engineState?.player.turn.agility
  const remainingMove = useMemo(() => {
    if (!engineState) return 0
    const base = engineState.player.turn.movePointsAvailable - engineState.player.turn.movePointsSpent
    const usedByAgility = plays.reduce((s, p) => s + (p.sourceType === 'agility' ? (p.moveCost ?? 0) : 0), 0)
    return Math.max(0, base - usedByAgility)
  }, [engineState, plays])
  // attack-type in melee phase (1:1); ranged-type in ranged/siege phase (2:1, strong only)
  const agilityKind: 'attack' | 'ranged' | null =
    !agility ? null
      : phase === 'attack' ? 'attack'
      : phase === 'ranged_siege' && agility.ranged ? 'ranged'
      : null
  const agilityCost = agilityKind === 'ranged' ? 2 : 1
  const showAgility = !!agilityKind && remainingMove >= agilityCost

  const handleViewDetail = useCallback((card: AnyCard) => {
    if (card.type !== 'wound') {
      setDetailCard(card as DeedCard)
      setDetailOpen(true)
    }
  }, [])

  const closeDetail = useCallback(() => {
    setDetailOpen(false)
    setDetailCard(null)
  }, [])

  const handleUnit = useCallback((ui: number, a: CardAction, ab: UnitAbility) => {
    activateUnit(ui, a, ab)
  }, [activateUnit])

  const handleSkill = useCallback((si: number, a: CardAction) => {
    activateSkillForCombat(si, a)
  }, [activateSkillForCombat])

  return (
    <div className="sticky bottom-0 z-40 w-full border-t border-slate-700/50 bg-slate-900/95 shadow-[0_-4px_24px_rgba(0,0,0,0.4)] backdrop-blur-sm">
      {/* Header */}
      <button type="button" onClick={toggleExpand}
        className="flex w-full items-center justify-between px-4 py-2 transition-colors hover:bg-slate-800/60">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {t('combat.cardTray', 'Card Tray')}
          </span>
          <motion.span className="text-[10px] text-slate-500"
            animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>▼</motion.span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold text-slate-500">
            {t('combat.phase', 'Phase')}: {t(PHASE_LABEL_KEY[phase])}
          </span>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-400">
            {t('combat.total', 'Total')}: {totalPhaseValue}
          </span>
        </div>
      </button>

      {/* Expandable body */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div key="tray-body" variants={bodyVariants}
            initial="collapsed" animate="expanded" exit="collapsed">
            <div className="space-y-3 px-4 pb-3 pt-2">

              {/* Mana pool — take Source dice / spend crystals mid-combat */}
              <ManaStrip />

              {/* Agility — spend leftover Move points as Attack (this turn) */}
              {showAgility && agilityKind && (
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-700/40 bg-emerald-950/30 px-3 py-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                    {t('combat.agility', 'Agility')}
                  </span>
                  <button
                    type="button"
                    disabled={!activeTargetEnemyId}
                    onClick={() => playAgilityMove(agilityKind)}
                    className={[
                      'rounded px-2 py-1 text-[10px] font-semibold transition-colors',
                      activeTargetEnemyId
                        ? 'bg-emerald-700 text-emerald-50 hover:bg-emerald-600'
                        : 'cursor-not-allowed bg-slate-800/60 text-slate-600',
                    ].join(' ')}
                  >
                    {agilityKind === 'ranged'
                      ? t('combat.agilityRanged', '2 Move → Ranged 1')
                      : t('combat.agilityAttack', '1 Move → Attack 1')}
                  </button>
                  <span className="text-[10px] text-emerald-400/80">
                    {t('combat.moveLeft', 'Move left')}: {remainingMove}
                  </span>
                  {!activeTargetEnemyId && (
                    <span className="text-[9px] text-slate-500 italic">
                      {t('combat.selectTargetFirst', 'select a target first')}
                    </span>
                  )}
                </div>
              )}

              {/* Plays summary & undo controls */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    {t('combat.plays', 'Plays')} ({plays.length})
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={undoLastPlay}
                      disabled={plays.length === 0}
                      className={[
                        'rounded px-2 py-0.5 text-[9px] font-semibold transition-colors',
                        plays.length > 0
                          ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                          : 'cursor-not-allowed bg-slate-800/50 text-slate-600',
                      ].join(' ')}>
                      ↩ {t('combat.undo', 'Undo')}
                    </button>
                    <button type="button" onClick={resetPhase}
                      disabled={plays.length === 0}
                      className={[
                        'rounded px-2 py-0.5 text-[9px] font-semibold transition-colors',
                        plays.length > 0
                          ? 'bg-slate-800 text-red-400/70 hover:bg-red-900/30 hover:text-red-300'
                          : 'cursor-not-allowed bg-slate-800/50 text-slate-600',
                      ].join(' ')}>
                      ✕ {t('combat.clearAll', 'Clear All')}
                    </button>
                  </div>
                </div>
                {plays.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {plays.map((p) => <PlayChip key={p.id} play={p} onRemove={removePlay} />)}
                  </div>
                )}
              </div>

              {/* Hand cards */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  {t('combat.handCards', 'Hand Cards')}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {availableCards.length === 0 && (
                    <span className="py-2 text-[10px] text-slate-600 italic">
                      {t('combat.noCards', 'No cards available')}
                    </span>
                  )}
                  {availableCards.map(({ card, index, isRelevant }) => {
                    const w = card.type === 'wound'
                    const used = usedCardIndices.has(index)
                    const sel = pickerIdx === index
                    return (
                      <div key={`${card.id}-${index}`} className="relative">
                        <div className={[
                          'relative flex w-[72px] flex-col overflow-hidden rounded-md border transition-all duration-150 sm:w-[80px]',
                          w ? 'border-red-800/40 bg-red-950/40 opacity-30'
                            : used ? 'border-slate-700/30 bg-slate-800/40 opacity-30'
                            : sel ? 'border-violet-500/60 bg-slate-800 ring-2 ring-violet-400/50 ring-offset-1 ring-offset-slate-900'
                            : isRelevant ? 'border-slate-600/60 bg-slate-800 ring-1 ring-amber-500/40'
                            : 'border-slate-700/50 bg-slate-800/70',
                        ].join(' ')}>
                          {renderStrip(card)}
                          {/* Info button — opens CardDetail directly */}
                          {!w && !used && (
                            <button
                              type="button"
                              aria-label={`View ${getCardName(card)} details`}
                              onClick={() => handleViewDetail(card)}
                              className="absolute top-1 right-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-slate-700/80 text-[8px] text-slate-400 transition-colors hover:bg-violet-700/80 hover:text-white"
                            >
                              i
                            </button>
                          )}
                          {/* Main tap area — opens action picker */}
                          <button
                            type="button"
                            disabled={w || used}
                            onClick={() => handleCardClick(index, card)}
                            className="flex min-h-[64px] w-full flex-col items-center justify-center px-1 py-2 disabled:cursor-not-allowed"
                          >
                            <span className={`text-base leading-none sm:text-lg ${w ? 'text-red-500' : ''}`}>
                              {TYPE_ICON[card.type] ?? '?'}
                            </span>
                            <span className={`mt-1 w-full truncate text-center text-[9px] font-medium leading-tight sm:text-[10px] ${w ? 'text-red-400' : 'text-slate-300'}`}>
                              {getCardName(card)}
                            </span>
                            {!w && !used && (
                              <span className="mt-1 text-[8px] text-slate-600">
                                {sel ? t('combat.tapToClose', 'tap to close') : t('combat.tapToPlay', 'tap to play')}
                              </span>
                            )}
                          </button>
                          {isRelevant && !w && !used && (
                            <div className="pointer-events-none absolute inset-0 rounded-md shadow-[inset_0_0_6px_rgba(245,158,11,0.08)]" />
                          )}
                        </div>
                        <AnimatePresence>
                          {sel && !w && !used && (() => {
                            const strongEval = evaluateStrongPlay(card, engineState, dayNight)
                            return (
                              <CardActionPicker card={card} handIndex={index} phase={phase}
                                onSelect={handleSelect} onSideways={handleSideways} onClose={closePicker} onViewDetail={handleViewDetail}
                                onImprovisation={handleImprovisation}
                                onConcentration={handleConcentration}
                                onPlayMana={handlePlayMana}
                                dayNight={dayNight}
                                canPlayBasic={strongEval?.canPlayBasic ?? true}
                                basicReason={strongEval && !strongEval.canPlayBasic ? translateValidationReason(strongEval, t) : undefined}
                                canPlayStrong={strongEval?.canPlayStrong ?? false}
                                strongReason={strongEval && !strongEval.canPlayStrong ? translateValidationReason(strongEval, t) : undefined} />
                            )
                          })()}
                        </AnimatePresence>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Skills (UNIT-09-B) */}
              {availableSkills.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500/80">
                    {t('combat.skills', 'Skills')}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {availableSkills.map(({ skill, index, actions }) => (
                      <div key={`skill-${index}`}
                        className="flex items-center gap-1.5 rounded-md border border-amber-700/40 bg-amber-950/30 px-2 py-1.5">
                        <span className="text-[10px] font-semibold text-amber-200">✨ {skill.name}</span>
                        <div className="flex gap-1">
                          {actions.map((action, i) => (
                            <button key={`sa-${i}`} type="button"
                              onClick={() => handleSkill(index, action)}
                              className="rounded bg-amber-900/40 px-1.5 py-0.5 text-[9px] font-medium text-amber-100 transition-colors hover:bg-amber-700/50">
                              {ACT_ICON[action.type] ?? '◈'} {fmtAction(action)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Units */}
              {unitsWithActions.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    {t('combat.units', 'Units')}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {unitsWithActions.map(({ unit, index, actions }) => (
                      <div key={`unit-${index}`}
                        className="flex items-center gap-1.5 rounded-md border border-slate-700/50 bg-slate-800/70 px-2 py-1.5">
                        <span className="text-[10px] font-semibold text-slate-200">{unit.unit.name}</span>
                        <div className="flex gap-1">
                          {actions.map(({ ability, action }, i) => (
                            <button key={`ua-${i}`} type="button"
                              onClick={() => handleUnit(index, action, ability)}
                              className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[9px] font-medium text-slate-300 transition-colors hover:bg-violet-800/40 hover:text-violet-200">
                              {ACT_ICON[action.type] ?? '◈'} {fmtAction(action)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <CardDetail card={detailCard} isOpen={detailOpen} onClose={closeDetail} />

      {/* Improvisation: discard selection overlay */}
      <AnimatePresence>
        {improvMode && (
          <motion.div
            key="improv-discard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <div className="w-full max-w-sm rounded-xl border border-violet-600/40 bg-slate-900 p-4 shadow-2xl">
              <h3 className="mb-1 text-center text-sm font-black text-violet-300">
                {t('game.improvisationDiscardTitle', 'Improvisation')}
              </h3>
              <p className="mb-3 text-center text-[10px] text-slate-400">
                {t('game.improvisationDiscardSubtitle', 'Discard a card from your hand to activate the effect.')}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {availableCards
                  .filter(({ index }) => index !== improvMode.cardIndex && !usedCardIndices.has(index))
                  .map(({ card: c, index: idx }) => {
                    const isWound = c.type === 'wound'
                    return (
                      <button
                        key={`improv-${c.id}-${idx}`}
                        type="button"
                        disabled={isWound}
                        onClick={() => handleImprovDiscard(idx)}
                        className={[
                          'flex w-[72px] flex-col items-center rounded-md border px-1 py-2 transition-all',
                          isWound
                            ? 'cursor-not-allowed border-red-800/40 bg-red-950/40 opacity-30'
                            : 'border-slate-600/60 bg-slate-800 hover:border-violet-500/60 hover:ring-2 hover:ring-violet-400/50 active:scale-95',
                        ].join(' ')}
                      >
                        <span className="text-base">{TYPE_ICON[c.type] ?? '?'}</span>
                        <span className="mt-1 w-full truncate text-center text-[9px] font-medium text-slate-300">
                          {getCardName(c)}
                        </span>
                      </button>
                    )
                  })}
              </div>
              <button
                type="button"
                onClick={() => setImprovMode(null)}
                className="mt-3 w-full rounded-lg bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 transition-all hover:bg-slate-600 active:scale-95"
              >
                {t('game.cancel', 'Cancel')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Concentration / Will Focus: pick the Action card to boost */}
      <AnimatePresence>
        {concentrationMode && (() => {
          const targets = availableCards.filter(
            ({ card: c, index }) =>
              index !== concentrationMode.cardIndex &&
              !usedCardIndices.has(index) &&
              getConcentrationBonus(c) == null &&
              getStrongComboAction(c, phase) != null,
          )
          return (
            <motion.div
              key="concentration-pick"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
            >
              <div className="w-full max-w-sm rounded-xl border border-emerald-600/40 bg-slate-900 p-4 shadow-2xl">
                <h3 className="mb-1 text-center text-sm font-black text-emerald-300">
                  {t('combat.comboTitle', 'Concentration Combo')} (+{concentrationMode.bonus})
                </h3>
                <p className="mb-3 text-center text-[10px] text-slate-400">
                  {t('combat.comboSubtitle', 'Pick an Action card — its strong effect is played for free with the bonus added.')}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {targets.map(({ card: c, index: idx }) => {
                    const action = getStrongComboAction(c, phase)
                    const boosted = action ? getActionValue(action) + concentrationMode.bonus : 0
                    return (
                      <button
                        key={`combo-${c.id}-${idx}`}
                        type="button"
                        onClick={() => handleConcentrationTarget(idx)}
                        className="flex w-[80px] flex-col items-center rounded-md border border-slate-600/60 bg-slate-800 px-1 py-2 transition-all hover:border-emerald-500/60 hover:ring-2 hover:ring-emerald-400/50 active:scale-95"
                      >
                        <span className="text-base">{TYPE_ICON[c.type] ?? '?'}</span>
                        <span className="mt-1 w-full truncate text-center text-[9px] font-medium text-slate-300">
                          {getCardName(c)}
                        </span>
                        <span className="mt-0.5 rounded bg-emerald-900/50 px-1 text-[8px] font-bold text-emerald-300">
                          {ACT_ICON[action?.type ?? ''] ?? '⚔'} {boosted}
                        </span>
                      </button>
                    )
                  })}
                  {targets.length === 0 && (
                    <p className="py-3 text-center text-[10px] italic text-slate-500">
                      {t('combat.comboNoTarget', 'No Action card with a usable strong effect this phase.')}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setConcentrationMode(null)}
                  className="mt-3 w-full rounded-lg bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 transition-all hover:bg-slate-600 active:scale-95"
                >
                  {t('game.cancel', 'Cancel')}
                </button>
              </div>
            </motion.div>
          )
        })()}
      </AnimatePresence>
    </div>
  )
}
