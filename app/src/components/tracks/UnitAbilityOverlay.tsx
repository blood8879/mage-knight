import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { CardAction, UnitInstance } from '@/engine/types'
import { useCardTranslation } from '@/hooks/useCardTranslation'

const ACT_ICON: Record<string, string> = {
  move: '👣',
  influence: '💬',
  heal: '✚',
  attack: '⚔',
  block: '🛡',
  ranged_attack: '🏹',
  siege_attack: '💥',
}

const COMBAT_ACTIONS = new Set(['attack', 'block', 'ranged_attack', 'siege_attack'])

interface UnitAbilityOverlayProps {
  unit: UnitInstance | null
  unitIndex: number | null
  combatActive: boolean
  interactionActive: boolean
  onActivate: (unitIndex: number, action: CardAction) => void
  onClose: () => void
}

export default function UnitAbilityOverlay({
  unit,
  unitIndex,
  combatActive,
  interactionActive,
  onActivate,
  onClose,
}: UnitAbilityOverlayProps) {
  const { t } = useTranslation('ui')
  const { getUnitName } = useCardTranslation()

  const open = unit != null && unitIndex != null
  const isReady = unit?.status === 'ready' && (unit?.woundCount ?? 0) === 0

  function actionLabel(a: CardAction): string {
    const base = t(`unitAbility.act.${a.type}`, { defaultValue: a.type.replace(/_/g, ' ') })
    return a.value != null ? `${base} ${a.value}` : base
  }

  /** Why an action can't be used right now, or null if it can. */
  function disabledReason(a: CardAction): string | null {
    if (!isReady) {
      return unit?.status === 'wounded'
        ? t('unitAbility.woundedHint', { defaultValue: 'Wounded units cannot act' })
        : t('unitAbility.spentHint', { defaultValue: 'Already used this round' })
    }
    if (COMBAT_ACTIONS.has(a.type)) {
      return t('unitAbility.combatOnly', { defaultValue: 'Use during combat' })
    }
    if (a.type === 'influence' && !interactionActive) {
      return t('unitAbility.interactionOnly', { defaultValue: 'Use during an interaction' })
    }
    if (combatActive) {
      return t('unitAbility.combatBusy', { defaultValue: 'Resolve combat first' })
    }
    return null
  }

  return (
    <AnimatePresence>
      {open && unit && unitIndex != null && (
        <motion.div
          key="unit-ability-overlay"
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
          <motion.div
            role="dialog"
            aria-label={t('unitAbility.title', { defaultValue: 'Unit Abilities' })}
            className="relative w-full max-w-sm overflow-hidden rounded-t-2xl border-t border-slate-700/60 bg-slate-900 shadow-2xl sm:rounded-2xl sm:border"
            initial={{ y: 40, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 40, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-100">{getUnitName(unit.unit)}</span>
                <span className="text-[10px] text-slate-500">
                  {t(`game.unitStatus.${unit.status}`, { defaultValue: unit.status })}
                  {' · '}
                  {t('unitAbility.oncePerRound', { defaultValue: 'Once per round' })}
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                aria-label={t('game.close', { defaultValue: 'Close' })}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>

            <div className="max-h-[60vh] space-y-2.5 overflow-y-auto px-4 py-3">
              {unit.unit.abilities.map((ability, ai) => (
                <div key={`ab-${ai}`} className="rounded-lg border border-slate-700/50 bg-slate-800/50 p-2.5">
                  <div className="mb-1.5 text-[11px] font-semibold text-slate-300">{ability.name}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {ability.actions.map((action, idx) => {
                      const reason = disabledReason(action)
                      const disabled = reason != null
                      return (
                        <button
                          key={`act-${ai}-${idx}`}
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            if (disabled) return
                            onActivate(unitIndex, action)
                            onClose()
                          }}
                          title={reason ?? undefined}
                          className={[
                            'flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors',
                            disabled
                              ? 'cursor-not-allowed bg-slate-800/60 text-slate-600'
                              : 'bg-violet-700/40 text-violet-100 hover:bg-violet-600/60',
                          ].join(' ')}
                        >
                          <span>{ACT_ICON[action.type] ?? '◈'}</span>
                          <span>{actionLabel(action)}</span>
                        </button>
                      )
                    })}
                  </div>
                  {ability.actions.some((a) => disabledReason(a)) && (
                    <p className="mt-1.5 text-[9px] italic text-slate-500">
                      {disabledReason(ability.actions[0]) ?? ''}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
