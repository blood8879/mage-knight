import { createPortal } from 'react-dom'
import type { AnyCard, CardColor } from '@/engine/types'

const CARD_COLOR_BG: Record<string, string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  white: 'bg-slate-200',
}

const CARD_TYPE_ICON: Record<string, string> = {
  basic_action: '⚔',
  advanced_action: '🗡',
  spell: '✦',
  artifact: '◆',
  wound: '⚡',
}

function getCardName(card: AnyCard): string {
  return card.type === 'wound' ? 'Wound' : card.name
}

function getCardColor(card: AnyCard): CardColor | undefined {
  if (card.type === 'wound') return undefined
  return card.color
}

function renderColorStrip(color: CardColor | undefined) {
  if (!color) return <div className="h-1.5 w-full rounded-t bg-red-800/80" />

  if (Array.isArray(color)) {
    return (
      <div className="flex h-1.5 w-full overflow-hidden rounded-t">
        {color.map((c, i) => (
          <div
            key={`${c}-${i}`}
            className={`flex-1 ${CARD_COLOR_BG[c] ?? 'bg-slate-600'}`}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={`h-1.5 w-full rounded-t ${CARD_COLOR_BG[color] ?? 'bg-slate-600'}`}
    />
  )
}

interface DragPreviewProps {
  card: AnyCard
  x: number
  y: number
}

export default function DragPreview({ card, x, y }: DragPreviewProps) {
  const isWound = card.type === 'wound'

  return createPortal(
    <div
      className="pointer-events-none fixed z-[9999]"
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -60%) rotate(3deg) scale(1.12)',
      }}
    >
      <div
        className={[
          'flex w-[56px] flex-col overflow-hidden rounded-md shadow-2xl shadow-black/60 sm:w-[62px]',
          'border',
          isWound
            ? 'border-red-700/80 bg-red-950/90'
            : 'border-violet-400/60 bg-slate-800/95',
          'ring-2 ring-violet-400/50',
          'opacity-90',
        ].join(' ')}
      >
        {renderColorStrip(getCardColor(card))}

        <div className="flex flex-1 flex-col items-center justify-center px-1 py-1.5">
          <span className="text-sm leading-none">
            {CARD_TYPE_ICON[card.type] ?? '?'}
          </span>
          <span
            className={`mt-1 w-full truncate text-center text-[9px] font-medium leading-tight sm:text-[10px] ${
              isWound ? 'text-red-400' : 'text-slate-200'
            }`}
          >
            {getCardName(card)}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
