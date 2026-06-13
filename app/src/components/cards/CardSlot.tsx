import type { AnyCard, CardColor } from '@/engine/types'
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

function renderSlotColorStrip(color: CardColor | undefined) {
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

function getSlotCardColor(card: AnyCard): CardColor | undefined {
  if (card.type === 'wound') return undefined
  return card.color
}

interface CardSlotProps {
  card: AnyCard | null
  label?: string
  onClick?: () => void
  highlighted?: boolean
}

export default function CardSlot({ card, label, onClick, highlighted }: CardSlotProps) {
  const { getCardName } = useCardTranslation()

  if (!card) {
    return (
      <button
        onClick={onClick}
        className={[
          'flex h-[88px] w-[66px] flex-col items-center justify-center rounded-lg sm:h-[96px] sm:w-[72px]',
          'border-2 border-dashed transition-all duration-200',
          highlighted
            ? 'border-violet-400/70 bg-violet-950/20 shadow-[0_0_16px_rgba(139,92,246,0.2)]'
            : 'border-slate-700/50 bg-slate-900/40',
          'hover:border-slate-600 hover:bg-slate-800/30',
        ].join(' ')}
      >
        {label && (
          <span className="text-[10px] font-medium text-slate-600 sm:text-xs">{label}</span>
        )}
        {!label && <span className="text-lg text-slate-700">+</span>}
      </button>
    )
  }

  const isWound = card.type === 'wound'
  const cardName = getCardName(card)

  return (
    <button
      onClick={onClick}
      className={[
        'group relative flex h-[88px] w-[66px] flex-col overflow-hidden rounded-lg sm:h-[96px] sm:w-[72px]',
        'border transition-all duration-200',
        isWound ? 'border-red-800/60 bg-red-950/60' : 'border-slate-700/60 bg-slate-800',
        highlighted
          ? 'ring-2 ring-violet-400 ring-offset-1 ring-offset-slate-900 shadow-lg shadow-violet-500/20'
          : 'hover:border-slate-500',
      ].join(' ')}
    >
      {renderSlotColorStrip(getSlotCardColor(card))}

      <div className="flex flex-1 flex-col items-center justify-center gap-1 px-1.5 py-1.5">
        <span className="text-base leading-none sm:text-lg">
          {CARD_TYPE_ICON[card.type] ?? '?'}
        </span>
        <span
          className={`w-full truncate text-center text-[9px] font-semibold leading-tight sm:text-[10px] ${
            isWound ? 'text-red-400' : 'text-slate-300'
          }`}
        >
          {cardName}
        </span>
      </div>

      {highlighted && (
        <div className="pointer-events-none absolute inset-0 animate-pulse rounded-lg shadow-[inset_0_0_10px_rgba(139,92,246,0.15)]" />
      )}
    </button>
  )
}
