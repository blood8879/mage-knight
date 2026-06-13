import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { AnyCard, CardColor, DeedCard } from '@/engine/types'
import CardDetail from '@/components/cards/CardDetail'
import { useCardTranslation } from '@/hooks/useCardTranslation'

const COLOR_STRIP: Record<string, string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
  white: 'bg-slate-200',
}

const CARD_TYPE_ICON: Record<string, string> = {
  basic_action: '⚔',
  advanced_action: '🗡',
  spell: '✦',
  artifact: '◆',
  wound: '⚡',
}

function getHandCardId(card: AnyCard): string | number {
  return card.type === 'wound' ? card.id : card.id
}

function getHandCardColor(card: AnyCard): CardColor | undefined {
  if (card.type === 'wound') return undefined
  return card.color
}

function renderHandColorStrip(color: CardColor | undefined) {
  if (!color) return <div className="h-1.5 w-full rounded-t bg-red-800/80" />

  if (Array.isArray(color)) {
    return (
      <div className="flex h-1.5 w-full overflow-hidden rounded-t">
        {color.map((c, i) => (
          <div key={`${c}-${i}`} className={`flex-1 ${COLOR_STRIP[c] ?? 'bg-slate-600'}`} />
        ))}
      </div>
    )
  }

  return <div className={`h-1.5 w-full rounded-t ${COLOR_STRIP[color] ?? 'bg-slate-600'}`} />
}

function getFanRotation(index: number, total: number): string {
  if (total <= 1) return ''
  const mid = (total - 1) / 2
  const offset = index - mid
  const deg = offset * 2.5
  const yShift = Math.abs(offset) * 2
  return `rotate(${deg}deg) translateY(${yShift}px)`
}

interface CardHandProps {
  hand: AnyCard[]
  selectedCardId: number | string | null
  onCardSelect?: (id: number | string) => void
  onCardPlay?: (index: number) => void
  onCardDiscard?: (index: number) => void
}

export default function CardHand({
  hand,
  selectedCardId,
  onCardSelect,
  onCardPlay,
  onCardDiscard,
}: CardHandProps) {
  const { t } = useTranslation('ui')
  const { getCardName } = useCardTranslation()
  const [detailCard, setDetailCard] = useState<DeedCard | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, card: AnyCard) => {
      e.preventDefault()
      if (card.type !== 'wound') {
        setDetailCard(card)
        setDetailOpen(true)
      }
    },
    [],
  )

  const closeDetail = useCallback(() => {
    setDetailOpen(false)
    setDetailCard(null)
  }, [])

  const selectedIdx = hand.findIndex((c) => getHandCardId(c) === selectedCardId)

  return (
    <>
      <div className="relative flex items-end gap-1.5 overflow-x-auto px-2 pt-2 pb-1.5 sm:gap-2 sm:px-3">
        {hand.length === 0 && (
          <span className="py-4 text-xs text-slate-600 italic">{t('game.noCardsInHand', { defaultValue: 'No cards in hand' })}</span>
        )}

        {hand.map((card, idx) => {
          const id = getHandCardId(card)
          const isWound = card.type === 'wound'
          const isSelected = selectedCardId === id

          return (
            <button
              key={`${id}-${idx}`}
              onClick={() => onCardSelect?.(isSelected ? (null as unknown as number) : id)}
              onContextMenu={(e) => handleContextMenu(e, card)}
              style={{
                transform: hand.length > 3 ? getFanRotation(idx, hand.length) : undefined,
              }}
              className={[
                'group relative flex w-[52px] shrink-0 flex-col overflow-hidden rounded-md sm:w-[58px]',
                'border transition-all duration-150 origin-bottom',
                isWound
                  ? 'border-red-800/60 bg-red-950/60'
                  : 'border-slate-700/70 bg-slate-800',
                isSelected
                  ? 'ring-2 ring-violet-400 ring-offset-1 ring-offset-slate-900 -translate-y-2 shadow-lg shadow-violet-500/20 z-10'
                  : 'hover:-translate-y-1 hover:border-slate-600 hover:z-[5]',
              ].join(' ')}
            >
              {renderHandColorStrip(getHandCardColor(card))}

              <div className="flex flex-1 flex-col items-center justify-center px-1 py-1.5">
                <span
                  className={`text-sm leading-none ${isWound ? 'animate-pulse text-red-500' : ''}`}
                >
                  {CARD_TYPE_ICON[card.type] ?? '?'}
                </span>
                <span
                  className={`mt-1 w-full truncate text-center text-[9px] font-medium leading-tight sm:text-[10px] ${
                    isWound ? 'text-red-400' : 'text-slate-300'
                  }`}
                >
                  {getCardName(card)}
                </span>
              </div>

              {isWound && (
                <div className="pointer-events-none absolute inset-0 animate-pulse rounded-md shadow-[inset_0_0_8px_rgba(239,68,68,0.12)]" />
              )}
            </button>
          )
        })}

        {selectedIdx !== -1 && (
          <div className="sticky right-0 ml-auto flex shrink-0 flex-col gap-1 pl-2">
            {onCardPlay && (
              <button
                onClick={() => onCardPlay(selectedIdx)}
                className="rounded bg-violet-600 px-2 py-1 text-[10px] font-semibold text-white shadow transition-colors hover:bg-violet-500 sm:text-xs"
              >
                Play
              </button>
            )}
            {onCardDiscard && (
              <button
                onClick={() => onCardDiscard(selectedIdx)}
                className="rounded bg-slate-700 px-2 py-1 text-[10px] font-semibold text-slate-300 shadow transition-colors hover:bg-slate-600 sm:text-xs"
              >
                Discard
              </button>
            )}
          </div>
        )}
      </div>

      <CardDetail card={detailCard} isOpen={detailOpen} onClose={closeDetail} />
    </>
  )
}
