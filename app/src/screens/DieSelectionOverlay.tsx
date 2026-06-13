import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ManaDie, ExtendedManaColor } from '@/engine/types'

const MANA_DIE_BG: Record<ExtendedManaColor, string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  white: 'bg-slate-200',
  gold: 'bg-amber-400',
  black: 'bg-neutral-900 ring-1 ring-neutral-600',
}

const MANA_DIE_RING: Record<ExtendedManaColor, string> = {
  red: 'ring-red-300',
  blue: 'ring-blue-300',
  green: 'ring-green-300',
  white: 'ring-slate-400',
  gold: 'ring-amber-300',
  black: 'ring-neutral-400',
}

const BASIC_COLORS: ReadonlySet<ExtendedManaColor> = new Set(['red', 'blue', 'green', 'white'])

interface DieSelectionOverlayProps {
  dice: ManaDie[]
  maxSelectable: number
  minSelectable?: number
  title: string
  subtitle?: string
  confirmLabel?: string
  filterBasicOnly?: boolean
  onConfirm: (selectedDieIds: string[]) => void
  onCancel?: () => void
}

export default function DieSelectionOverlay({
  dice,
  maxSelectable,
  minSelectable = 1,
  title,
  subtitle,
  confirmLabel,
  filterBasicOnly = false,
  onConfirm,
  onCancel,
}: DieSelectionOverlayProps) {
  const { t } = useTranslation('ui')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const visibleDice = filterBasicOnly
    ? dice.filter((d) => BASIC_COLORS.has(d.color))
    : dice

  const toggleDie = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < maxSelectable) {
        next.add(id)
      }
      return next
    })
  }

  const canConfirm = selectedIds.size >= minSelectable

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-slate-950/80 backdrop-blur-sm">
      <div className="mx-4 my-4 w-full max-w-md rounded-2xl border border-slate-700/50 bg-slate-900 p-4 shadow-2xl shadow-violet-950/30 sm:p-6">
        <h2 className="mb-1 text-center text-lg font-black tracking-wide text-slate-100">
          {title}
        </h2>
        {subtitle && (
          <p className="mb-2 text-center text-xs text-slate-500">
            {subtitle}
          </p>
        )}

        <p className="mb-4 text-center text-sm font-semibold text-violet-400">
          {t('game.selectedCount', 'Selected')}: {selectedIds.size}/{maxSelectable}
        </p>

        {visibleDice.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-600 italic">
            {t('game.noDiceAvailable', 'No dice available')}
          </p>
        ) : (
          <div className="flex flex-wrap justify-center gap-3">
            {visibleDice.map((die) => {
              const isSelected = selectedIds.has(die.id)
              return (
                <button
                  key={die.id}
                  type="button"
                  onClick={() => toggleDie(die.id)}
                  className={[
                    'flex h-14 w-14 items-center justify-center rounded-lg shadow-md transition-all active:scale-90',
                    MANA_DIE_BG[die.color],
                    isSelected
                      ? `ring-3 ${MANA_DIE_RING[die.color]} scale-110 shadow-lg`
                      : 'opacity-80 hover:opacity-100 hover:scale-105',
                  ].join(' ')}
                  aria-label={die.color}
                  aria-pressed={isSelected}
                />
              )
            })}
          </div>
        )}

        <div className="mt-4 flex justify-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[44px] rounded-lg bg-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-300 shadow-lg transition-all hover:bg-slate-600 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              {t('game.skip', 'Skip')}
            </button>
          )}
          <button
            type="button"
            onClick={() => onConfirm(Array.from(selectedIds))}
            disabled={!canConfirm}
            className={[
              'min-h-[44px] rounded-lg px-8 py-2.5 text-sm font-bold shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400',
              canConfirm
                ? 'bg-violet-600 text-white shadow-violet-900/40 hover:bg-violet-500 active:scale-95'
                : 'cursor-not-allowed bg-slate-800 text-slate-600',
            ].join(' ')}
          >
            {confirmLabel ?? t('game.confirm', 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
