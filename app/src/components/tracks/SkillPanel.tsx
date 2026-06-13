import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCardTranslation } from '@/hooks/useCardTranslation'
import type { HeroSkill, CardAction, ManaColor, UnitInstance, DayNight, AnyCard, ManaToken } from '@/engine/types'

/**
 * Lists acquired skills and lets the player activate their non-combat
 * actions (move / influence / healing / crystals / mana / ready-a-unit /
 * wound-sideways / mana conversion / discard-for-mana).
 * Combat actions are used from the combat card tray instead.
 */

export interface SkillActivateOptions {
  actionIndex?: number
  color?: ManaColor | 'black'
  unitIndex?: number
  cardIndex?: number
  tokenIndex?: number
  sidewaysEffect?: 'move' | 'influence'
}

interface SkillPanelProps {
  skills: HeroSkill[]
  units: UnitInstance[]
  hand: AnyCard[]
  playerMana: ManaToken[]
  dayNight: DayNight
  interactionActive: boolean
  combatActive: boolean
  onActivate: (skillIndex: number, options?: SkillActivateOptions) => void
}

const ACTION_ICON: Record<string, string> = {
  move: '🏃',
  move_per_ready_unit: '🏃',
  heal_unit_wound: '💚',
  influence: '🤝',
  healing: '💚',
  heal_wounds: '💚',
  gain_crystal: '💎',
  gain_mana_token: '✨',
  free_unit_activation: '🔄',
  wound_as_card: '🩸',
  mana_conversion: '🔀',
  discard_wound_for_mana: '🩸',
  discard_card_for_mana: '🃏',
  attack: '⚔',
  siege_attack: '💥',
  ranged_attack: '🏹',
  block: '🛡',
}

const SUPPORTED_TYPES = new Set([
  'move', 'influence', 'healing', 'heal_wounds',
  'gain_crystal', 'gain_mana_token', 'free_unit_activation',
  'wound_as_card', 'mana_conversion', 'discard_wound_for_mana', 'discard_card_for_mana',
  'move_per_ready_unit', 'heal_unit_wound',
])

const COMBAT_TYPES = new Set(['attack', 'siege_attack', 'ranged_attack', 'block'])

type ChoiceKind = 'color' | 'unit' | 'wounded_unit' | 'sideways' | 'token' | 'card_then_color'

interface PendingChoice {
  skillIndex: number
  actionIndex: number
  kind: ChoiceKind
  colors?: string[]
  cardIndex?: number // for card_then_color after the card pick
}

function actionLabel(action: CardAction): string {
  switch (action.type) {
    case 'wound_as_card':
      return `wound sideways +${typeof action.bonusValue === 'number' ? action.bonusValue : 2}`
    case 'mana_conversion':
      return 'convert mana'
    case 'discard_wound_for_mana':
      return 'wound → mana'
    case 'discard_card_for_mana':
      return 'card → mana'
    case 'move_per_ready_unit':
      return `move (per ready unit, max ${typeof action.maxValue === 'number' ? action.maxValue : 3})`
    case 'heal_unit_wound':
      return 'heal a unit'
    default: {
      const base = action.type.replace(/_/g, ' ')
      const value = action.value != null ? ` ${action.value}` : ''
      const element = action.element ? ` (${action.element})` : ''
      const color = action.color ? ` ${String(action.color).replace(/_/g, ' ')}` : ''
      return `${base}${value}${element}${color}`
    }
  }
}

export default function SkillPanel({
  skills,
  units,
  hand,
  playerMana,
  dayNight,
  interactionActive,
  combatActive,
  onActivate,
}: SkillPanelProps) {
  const { t } = useTranslation('ui')
  const { t: tSkills } = useTranslation('heroSkills')
  const { getCardName, getUnitName } = useCardTranslation()
  const [pendingChoice, setPendingChoice] = useState<PendingChoice | null>(null)

  if (skills.length === 0) return null

  const woundsInHand = hand.filter((c) => c.type === 'wound').length
  const nonWoundsInHand = hand.filter((c) => c.type !== 'wound').length

  const canUse = (skill: HeroSkill): boolean => {
    if (skill.type === 'once_per_turn') return !skill.isUsedThisTurn
    if (skill.type === 'once_per_round' || skill.type === 'interactive_once_per_round') return !skill.isFlipped
    return false
  }

  const isActionUsable = (action: CardAction): { usable: boolean; reason?: string } => {
    if (COMBAT_TYPES.has(action.type)) {
      return { usable: false, reason: t('skills.combatOnly', 'Use in combat') }
    }
    if (!SUPPORTED_TYPES.has(action.type)) {
      return { usable: false, reason: t('skills.notSupported', 'Not yet supported') }
    }
    if (action.condition === 'day' && dayNight !== 'day') return { usable: false, reason: t('skills.dayOnly', 'Day only') }
    if (action.condition === 'night' && dayNight !== 'night') return { usable: false, reason: t('skills.nightOnly', 'Night only') }
    if (combatActive) return { usable: false, reason: t('skills.notInCombat', 'Not during combat') }
    if (action.type === 'influence' && !interactionActive) {
      return { usable: false, reason: t('skills.interactionOnly', 'During interaction') }
    }
    if (action.type === 'free_unit_activation' && !units.some((u) => u.status === 'spent')) {
      return { usable: false, reason: t('skills.noSpentUnits', 'No spent units') }
    }
    if (action.type === 'move_per_ready_unit' && !units.some((u) => u.status === 'ready' && u.woundCount === 0)) {
      return { usable: false, reason: t('skills.noReadyUnits', 'No ready units') }
    }
    if (action.type === 'heal_unit_wound' && !units.some((u) => u.woundCount > 0)) {
      return { usable: false, reason: t('skills.noWoundedUnits', 'No wounded units') }
    }
    if ((action.type === 'wound_as_card' || action.type === 'discard_wound_for_mana') && woundsInHand === 0) {
      return { usable: false, reason: t('skills.noWounds', 'No wounds in hand') }
    }
    if (action.type === 'discard_card_for_mana' && nonWoundsInHand === 0) {
      return { usable: false, reason: t('skills.noCards', 'No cards in hand') }
    }
    if (action.type === 'mana_conversion' && playerMana.length === 0) {
      return { usable: false, reason: t('skills.noManaTokens', 'No mana tokens') }
    }
    return { usable: true }
  }

  const handleActionClick = (skillIndex: number, actionIndex: number, action: CardAction) => {
    switch (action.type) {
      case 'gain_mana_token': {
        const colors = String(action.color ?? '').split('_or_').filter(Boolean)
        if (colors.length > 1) {
          setPendingChoice({ skillIndex, actionIndex, kind: 'color', colors })
          return
        }
        break
      }
      case 'discard_wound_for_mana': {
        const colors = String(action.color ?? 'red_or_black').split('_or_').filter(Boolean)
        setPendingChoice({ skillIndex, actionIndex, kind: 'color', colors })
        return
      }
      case 'discard_card_for_mana': {
        const colors = String(action.color ?? 'white_or_green').split('_or_').filter(Boolean)
        setPendingChoice({ skillIndex, actionIndex, kind: 'card_then_color', colors })
        return
      }
      case 'free_unit_activation':
        setPendingChoice({ skillIndex, actionIndex, kind: 'unit' })
        return
      case 'heal_unit_wound':
        setPendingChoice({ skillIndex, actionIndex, kind: 'wounded_unit' })
        return
      case 'wound_as_card':
        setPendingChoice({ skillIndex, actionIndex, kind: 'sideways' })
        return
      case 'mana_conversion':
        setPendingChoice({ skillIndex, actionIndex, kind: 'token' })
        return
    }
    onActivate(skillIndex, { actionIndex })
  }

  const fire = (options: SkillActivateOptions) => {
    if (!pendingChoice) return
    onActivate(pendingChoice.skillIndex, { actionIndex: pendingChoice.actionIndex, ...options })
    setPendingChoice(null)
  }

  const CancelButton = (
    <button
      type="button"
      onClick={() => setPendingChoice(null)}
      className="rounded bg-slate-800 px-2 py-1 text-[9px] text-slate-500"
    >
      ✕
    </button>
  )

  const renderChoice = (skillIndex: number) => {
    if (!pendingChoice || pendingChoice.skillIndex !== skillIndex) return null

    switch (pendingChoice.kind) {
      case 'color':
        return (
          <div className="mt-1.5 flex gap-1">
            {pendingChoice.colors?.map((c) => {
              const blocked = c === 'black' && dayNight !== 'night'
              return (
                <button
                  key={c}
                  type="button"
                  disabled={blocked}
                  title={blocked ? t('skills.nightOnly', 'Night only') : undefined}
                  onClick={() => fire({ color: c as ManaColor | 'black' })}
                  className={[
                    'rounded px-2 py-1 text-[9px] font-bold uppercase',
                    blocked
                      ? 'cursor-not-allowed bg-slate-800/60 text-slate-600'
                      : 'bg-slate-700 text-slate-200 hover:bg-slate-600',
                  ].join(' ')}
                >
                  {c}
                </button>
              )
            })}
            {CancelButton}
          </div>
        )

      case 'wounded_unit':
        return (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {units.map((u, unitIndex) =>
              u.woundCount > 0 ? (
                <button
                  key={unitIndex}
                  type="button"
                  onClick={() => fire({ unitIndex })}
                  className="rounded bg-slate-700 px-2 py-1 text-[9px] font-bold text-slate-200 hover:bg-slate-600"
                >
                  {getUnitName(u.unit)} ×{u.woundCount}
                </button>
              ) : null,
            )}
            {CancelButton}
          </div>
        )

      case 'unit':
        return (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {units.map((u, unitIndex) =>
              u.status === 'spent' ? (
                <button
                  key={unitIndex}
                  type="button"
                  onClick={() => fire({ unitIndex })}
                  className="rounded bg-slate-700 px-2 py-1 text-[9px] font-bold text-slate-200 hover:bg-slate-600"
                >
                  {getUnitName(u.unit)}
                </button>
              ) : null,
            )}
            {CancelButton}
          </div>
        )

      case 'sideways':
        return (
          <div className="mt-1.5 flex gap-1">
            <button
              type="button"
              onClick={() => fire({ sidewaysEffect: 'move' })}
              className="rounded bg-slate-700 px-2 py-1 text-[9px] font-bold text-slate-200 hover:bg-slate-600"
            >
              🏃 {t('game.move', 'Move')}
            </button>
            <button
              type="button"
              disabled={!interactionActive}
              title={!interactionActive ? t('skills.interactionOnly', 'During interaction') : undefined}
              onClick={() => fire({ sidewaysEffect: 'influence' })}
              className={[
                'rounded px-2 py-1 text-[9px] font-bold',
                interactionActive
                  ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                  : 'cursor-not-allowed bg-slate-800/60 text-slate-600',
              ].join(' ')}
            >
              🤝 {t('game.influence', 'Influence')}
            </button>
            {CancelButton}
          </div>
        )

      case 'token':
        return (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {playerMana.map((token, tokenIndex) => (
              <button
                key={tokenIndex}
                type="button"
                onClick={() => fire({ tokenIndex })}
                className="rounded bg-slate-700 px-2 py-1 text-[9px] font-bold uppercase text-slate-200 hover:bg-slate-600"
              >
                {token.color} →
              </button>
            ))}
            {CancelButton}
          </div>
        )

      case 'card_then_color':
        if (pendingChoice.cardIndex === undefined) {
          return (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {hand.map((card, cardIndex) =>
                card.type !== 'wound' ? (
                  <button
                    key={cardIndex}
                    type="button"
                    onClick={() => setPendingChoice({ ...pendingChoice, cardIndex })}
                    className="rounded bg-slate-700 px-2 py-1 text-[9px] font-bold text-slate-200 hover:bg-slate-600"
                  >
                    {getCardName(card)}
                  </button>
                ) : null,
              )}
              {CancelButton}
            </div>
          )
        }
        return (
          <div className="mt-1.5 flex gap-1">
            {pendingChoice.colors?.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => fire({ cardIndex: pendingChoice.cardIndex, color: c as ManaColor | 'black' })}
                className="rounded bg-slate-700 px-2 py-1 text-[9px] font-bold uppercase text-slate-200 hover:bg-slate-600"
              >
                {c}
              </button>
            ))}
            {CancelButton}
          </div>
        )
    }
  }

  return (
    <div data-tutorial="skills" className="w-full space-y-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/80">
        {t('skills.title', 'Skills')}
      </span>

      {skills.map((skill, skillIndex) => {
        const usable = canUse(skill)
        const visuallyActive = usable || skill.type === 'passive'
        return (
          <div
            key={skill.id}
            className={[
              'rounded-lg border px-2.5 py-2',
              visuallyActive ? 'border-amber-700/40 bg-amber-950/20' : 'border-slate-800 bg-slate-900/40 opacity-60',
            ].join(' ')}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-200">✨ {tSkills(`${skill.id}.name`, { defaultValue: skill.name })}</span>
              <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-slate-400">
                {skill.type === 'passive'
                  ? t('skills.passive', 'Passive')
                  : usable
                    ? skill.type.replace(/_/g, ' ')
                    : t('skills.used', 'Used')}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{tSkills(`${skill.id}.effect`, { defaultValue: skill.effect })}</p>

            {usable && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {skill.actions.map((action, actionIndex) => {
                  const { usable: actionOk, reason } = isActionUsable(action)
                  return (
                    <button
                      key={actionIndex}
                      type="button"
                      disabled={!actionOk}
                      onClick={() => handleActionClick(skillIndex, actionIndex, action)}
                      title={reason}
                      className={[
                        'rounded px-1.5 py-1 text-[9px] font-semibold capitalize transition-colors',
                        actionOk
                          ? 'bg-amber-800/50 text-amber-100 hover:bg-amber-700/60 active:scale-95'
                          : 'cursor-not-allowed bg-slate-800/60 text-slate-600',
                      ].join(' ')}
                    >
                      {ACTION_ICON[action.type] ?? '◈'} {actionLabel(action)}
                      {!actionOk && reason && <span className="ml-1 normal-case">· {reason}</span>}
                    </button>
                  )
                })}
              </div>
            )}

            {usable && renderChoice(skillIndex)}
          </div>
        )
      })}
    </div>
  )
}
