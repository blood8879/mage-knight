import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import CardSlot from '@/components/cards/CardSlot'
import type { AnyCard } from '@/engine/types'

interface CardSelectionOverlayProps {
  cards: AnyCard[]
  maxSelectable: number
  minSelectable?: number
  title: string
  subtitle?: string
  confirmLabel?: string
  onConfirm: (selectedIndices: number[]) => void
  onCancel?: () => void
}

export default function CardSelectionOverlay({
  cards,
  maxSelectable,
  minSelectable = 0,
  title,
  subtitle,
  confirmLabel,
  onConfirm,
  onCancel,
}: CardSelectionOverlayProps) {
  const { t } = useTranslation('ui')
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())

  const toggleCard = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else if (next.size < maxSelectable) {
        next.add(index)
      }
      return next
    })
  }

  const canConfirm = selectedIndices.size >= minSelectable

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
          {t('game.selectedCount', 'Selected')}: {selectedIndices.size}/{maxSelectable}
        </p>

        {cards.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-600 italic">
            {t('game.noCardsAvailable', 'No cards available')}
          </p>
        ) : (
          <div className="flex flex-wrap justify-center gap-2">
            {cards.map((card, index) => (
              <CardSlot
                key={card.type === 'wound' ? card.id : `card-${card.id}`}
                card={card}
                highlighted={selectedIndices.has(index)}
                onClick={() => toggleCard(index)}
              />
            ))}
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
            onClick={() => onConfirm(Array.from(selectedIndices))}
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
