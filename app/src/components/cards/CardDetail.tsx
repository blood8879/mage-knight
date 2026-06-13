import { useTranslation } from 'react-i18next'
import Modal from '@/components/common/Modal'
import type { DeedCard, CardColor, CardEffect, CardAction } from '@/engine/types'
import { useCardTranslation } from '@/hooks/useCardTranslation'

// ── Color mappings ──────────────────────────
const COLOR_HEADER_TINT: Record<string, string> = {
  red: 'from-red-900/60 to-slate-800/0',
  blue: 'from-blue-900/60 to-slate-800/0',
  green: 'from-emerald-900/60 to-slate-800/0',
  white: 'from-slate-400/20 to-slate-800/0',
}

const COLOR_STRIP: Record<string, string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
  white: 'bg-slate-200',
}

const COLOR_ACCENT: Record<string, string> = {
  red: 'text-red-400',
  blue: 'text-blue-400',
  green: 'text-emerald-400',
  white: 'text-slate-200',
}

const TYPE_BADGE_DEFAULT: Record<string, string> = {
  basic_action: 'Basic Action',
  advanced_action: 'Advanced Action',
  spell: 'Spell',
  artifact: 'Artifact',
}

const TYPE_BADGE_STYLE: Record<string, string> = {
  basic_action: 'bg-amber-500/20 text-amber-300 ring-amber-500/30',
  advanced_action: 'bg-violet-500/20 text-violet-300 ring-violet-500/30',
  spell: 'bg-cyan-500/20 text-cyan-300 ring-cyan-500/30',
  artifact: 'bg-orange-500/20 text-orange-300 ring-orange-500/30',
}

const SET_DEFAULT: Record<string, string> = {
  base: 'Base',
  expansion: 'Expansion',
  ultimate: 'Ultimate',
  lost_legion: 'Lost Legion',
}

const ACTION_TYPE_ICON: Record<string, string> = {
  move: '🏃',
  attack: '⚔',
  block: '🛡',
  influence: '🤝',
  heal: '💚',
  mana: '💎',
  draw: '🃏',
  ranged_attack: '🏹',
  siege_attack: '💥',
  default: '◈',
}

// ── Helpers ──────────────────────────────────
function getPrimaryColor(color: CardColor | undefined): string {
  if (!color) return 'white'
  if (Array.isArray(color)) return color[0] ?? 'white'
  return color
}

function renderColorBar(color: CardColor | undefined) {
  if (!color) return null

  if (Array.isArray(color)) {
    return (
      <div className="flex h-1 w-full overflow-hidden rounded-full">
        {color.map((c, i) => (
          <div key={`${c}-${i}`} className={`flex-1 ${COLOR_STRIP[c] ?? 'bg-slate-600'}`} />
        ))}
      </div>
    )
  }

  return <div className={`h-1 w-full rounded-full ${COLOR_STRIP[color] ?? 'bg-slate-600'}`} />
}

type Translator = (key: string, options?: Record<string, unknown>) => string

function renderActionItem(action: CardAction, idx: number, t: Translator) {
  const icon = ACTION_TYPE_ICON[action.type] ?? ACTION_TYPE_ICON.default
  const typeLabel = t(`game.actionType.${action.type}`, { defaultValue: action.type.replace(/_/g, ' ') })
  // Detailed English descriptions stay as supplementary text — the localized
  // effect text above already carries the full translated wording.
  const detail = action.description && action.description !== typeLabel ? action.description : null

  return (
    <li key={idx} className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 shrink-0 text-base leading-none">{icon}</span>
      <span className="text-slate-300">
        <span className="font-medium capitalize text-slate-100">{typeLabel}</span>
        {action.value != null && (
          <span className="ml-1.5 font-mono text-amber-400">{action.value}</span>
        )}
        {action.element && (
          <span className="ml-1.5 text-xs text-slate-500">({t(`game.element.${action.element}`, { defaultValue: action.element })})</span>
        )}
        {action.condition && (
          <span className="ml-1.5 text-xs italic text-slate-500">{t(`game.actionCondition.${action.condition}`, { defaultValue: action.condition })}</span>
        )}
        {detail && (
          <span className="ml-1.5 text-xs text-slate-500">— {detail}</span>
        )}
      </span>
    </li>
  )
}

function renderEffectSection(
  label: string,
  effect: CardEffect,
  accentClass: string,
  isStrong: boolean,
  manaLabel: string,
  t: Translator,
) {
  const formatMana = (cost: string) => t(`colors.${cost}`, { defaultValue: cost })
  return (
    <div
      className={[
        'rounded-lg border px-4 py-3',
        isStrong
          ? 'border-amber-700/40 bg-amber-950/20'
          : 'border-slate-700/50 bg-slate-800/50',
      ].join(' ')}
    >
      <div className="mb-2 flex items-center justify-between">
        <h4
          className={`text-xs font-bold uppercase tracking-wider ${
            isStrong ? 'text-amber-400' : accentClass
          }`}
        >
          {label}
        </h4>
        {effect.manaCost && (
          <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
            {manaLabel}: {Array.isArray(effect.manaCost) ? effect.manaCost.map(formatMana).join(' / ') : formatMana(effect.manaCost)}
          </span>
        )}
      </div>

      {effect.name && (
        <p className="mb-1.5 text-sm font-semibold italic text-slate-200">{effect.name}</p>
      )}

      <p className="text-sm leading-relaxed text-slate-300">{effect.text}</p>

      {effect.actions.length > 0 && (
        <ul className="mt-2.5 flex flex-col gap-1.5 border-t border-slate-700/40 pt-2.5">
          {effect.actions.map((action, idx) => renderActionItem(action, idx, t))}
        </ul>
      )}
    </div>
  )
}

// ── Props ────────────────────────────────────
interface CardDetailProps {
  card: DeedCard | null
  isOpen: boolean
  onClose: () => void
  onPlayBasic?: () => void
  onPlayStrong?: () => void
  canPlayBasic?: boolean
  basicDisabledReason?: string
  canPlayStrong?: boolean
  strongDisabledReason?: string
  onDiscard?: () => void
  onPlaySideways?: (type: 'move' | 'attack' | 'block' | 'influence') => void
}

// ── Component ────────────────────────────────
export default function CardDetail({ card, isOpen, onClose, onPlayBasic, onPlayStrong, canPlayBasic = true, basicDisabledReason, canPlayStrong, strongDisabledReason, onDiscard, onPlaySideways }: CardDetailProps) {
  const { getCardName, getCardBasicEffect, getCardStrongEffect } = useCardTranslation()

  const { t } = useTranslation('ui')
  if (!card) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="md">
        <div className="py-8 text-center text-slate-500">{t('game.noCardSelected', { defaultValue: 'No card selected' })}</div>
      </Modal>
    )
  }

  const color = 'color' in card ? card.color : undefined
  const primary = getPrimaryColor(color)
  const headerTint = COLOR_HEADER_TINT[primary] ?? COLOR_HEADER_TINT.white
  const accentClass = COLOR_ACCENT[primary] ?? 'text-slate-300'

  const isSpell = card.type === 'spell'
  const basicEffect = isSpell ? card.basicSpell : card.basicEffect
  const strongEffect = isSpell ? card.strongSpell : card.strongEffect

  const basicLabel = isSpell
    ? t('game.basicSpellLabel', { defaultValue: 'Basic Spell' })
    : t('game.basicEffectLabel', { defaultValue: 'Basic Effect' })
  const strongLabel = isSpell
    ? t('game.strongSpellLabel', { defaultValue: 'Strong Spell' })
    : t('game.strongEffectLabel', { defaultValue: 'Strong Effect' })
  const manaLabel = t('game.manaLabel', { defaultValue: 'Mana' })

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <div className="flex flex-col gap-5">
        {/* ── Header ── */}
        <div className={`-mx-6 -mt-5 bg-gradient-to-b ${headerTint} px-6 pt-5 pb-4`}>
          {renderColorBar(color)}

          <div className="mt-3 flex items-start justify-between gap-3">
            <h3 className="text-xl font-extrabold tracking-tight text-slate-50">{getCardName(card)}</h3>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${
                TYPE_BADGE_STYLE[card.type] ?? ''
              }`}
            >
              {t(`game.cardType.${card.type}`, { defaultValue: TYPE_BADGE_DEFAULT[card.type] ?? card.type })}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className="rounded bg-slate-700/50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
              {t(`game.cardSet.${card.set}`, { defaultValue: SET_DEFAULT[card.set] ?? card.set })}
            </span>
            {card.type === 'basic_action' && card.heroSpecific && (
              <span className="rounded bg-violet-800/40 px-1.5 py-0.5 text-[10px] font-medium text-violet-300">
                {card.heroSpecific}
              </span>
            )}
          </div>
        </div>

        {/* ── Basic Effect ── */}
        {renderEffectSection(basicLabel, { ...basicEffect, text: getCardBasicEffect(card) }, accentClass, false, manaLabel, t)}

        {/* ── Strong Effect ── */}
        {renderEffectSection(strongLabel, { ...strongEffect, text: getCardStrongEffect(card) }, accentClass, true, manaLabel, t)}


        {/* ── Sideways play ── */}
        {onPlaySideways && (
          <div className="rounded-lg border border-amber-700/30 bg-amber-950/10 px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
              {t('game.playSideways', 'Play Sideways')}
            </p>
            <p className="mb-3 text-xs text-slate-400">{t('game.sidewaysHint', 'Use this card for a generic +1 bonus')}</p>
            <div className="grid grid-cols-2 gap-2">
              {(['move', 'attack', 'block', 'influence'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => { onPlaySideways(type); onClose() }}
                  className="min-h-[44px] rounded-md bg-amber-700/30 px-3 py-2 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-700/50 active:bg-amber-700/70"
                >
                  {t(`game.sideways${type.charAt(0).toUpperCase() + type.slice(1)}` as const, `+1 ${type}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Action buttons ── */}
        {(onPlayBasic || onPlayStrong !== undefined || onDiscard) && (
          <div className="flex flex-col gap-2 border-t border-slate-700/40 pt-4">
            {/* Basic / Strong play buttons */}
            {(onPlayBasic || onPlayStrong !== undefined) && (
              <div className="flex gap-2">
                {onPlayBasic && (
                  <button
                    onClick={() => { if (canPlayBasic) { onPlayBasic(); onClose() } }}
                    disabled={!canPlayBasic}
                    className={[
                      'min-h-[44px] flex-1 rounded-lg py-2.5 text-sm font-bold shadow-lg transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2',
                      canPlayBasic
                        ? 'bg-violet-600 text-white shadow-violet-900/30 hover:bg-violet-500 focus-visible:ring-violet-400'
                        : 'cursor-not-allowed bg-slate-700 text-slate-500 shadow-none',
                    ].join(' ')}
                    title={!canPlayBasic ? (basicDisabledReason ?? t('game.manaRequired', { defaultValue: 'Mana required' })) : undefined}
                  >
                    {t('game.basicEffectLabel', { defaultValue: 'Basic Effect' })}
                    {!canPlayBasic && (
                      <span className="ml-1 text-[10px] text-slate-500">({t('game.noMana', { defaultValue: 'No mana' })})</span>
                    )}
                  </button>
                )}
                {onPlayStrong !== undefined && (
                  <button
                    onClick={() => { if (canPlayStrong && onPlayStrong) { onPlayStrong(); onClose() } }}
                    disabled={!canPlayStrong}
                    className={[
                      'min-h-[44px] flex-1 rounded-lg py-2.5 text-sm font-bold shadow-lg transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2',
                      canPlayStrong
                        ? 'bg-amber-600 text-white shadow-amber-900/30 hover:bg-amber-500 focus-visible:ring-amber-400'
                        : 'cursor-not-allowed bg-slate-700 text-slate-500 shadow-none',
                    ].join(' ')}
                    title={!canPlayStrong ? (strongDisabledReason ?? t('game.manaRequired', { defaultValue: 'Mana required' })) : undefined}
                  >
                    {t('game.strongEffectLabel', { defaultValue: 'Strong Effect' })}
                    {!canPlayStrong && (
                      <span className="ml-1 text-[10px] text-slate-500">({strongDisabledReason ?? t('game.noMana', { defaultValue: 'No mana' })})</span>
                    )}
                  </button>
                )}
              </div>
            )}
            {/* Discard button */}
            {onDiscard && (
              <button
                onClick={() => { onDiscard(); onClose() }}
                className="min-h-[44px] w-full rounded-lg bg-slate-700 py-2.5 text-sm font-semibold text-slate-300 shadow transition-all hover:bg-slate-600 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                {t('game.discard', { defaultValue: 'Discard' })}
              </button>
            )}
          </div>
        )}
        {/* ── Footer meta ── */}
        <div className="flex items-center justify-between border-t border-slate-700/40 pt-3 text-[10px] text-slate-500">
          <span>ID: {card.id}</span>
          {card.type === 'spell' && card.competitive && (
            <span className="rounded bg-rose-900/30 px-1.5 py-0.5 text-rose-400">{t('game.competitive', { defaultValue: 'Competitive' })}</span>
          )}
        </div>
      </div>
    </Modal>
  )
}
