import type { WoundCard as WoundCardType } from '@/engine/types'

interface WoundCardProps {
  wound: WoundCardType
  isSelected?: boolean
  onClick?: () => void
}

export default function WoundCard({ wound, isSelected, onClick }: WoundCardProps) {
  return (
    <button
      onClick={onClick}
      data-wound-id={wound.id}
      className={[
        'group relative flex w-[52px] shrink-0 flex-col items-center overflow-hidden rounded-md sm:w-[58px]',
        'border transition-all duration-200',
        'border-red-800/60 bg-red-950/60',
        isSelected
          ? 'ring-2 ring-red-400 ring-offset-1 ring-offset-slate-900 -translate-y-1 shadow-lg shadow-red-500/30'
          : 'hover:-translate-y-0.5 hover:border-red-700',
      ].join(' ')}
    >
      <div className="h-1.5 w-full rounded-t bg-red-800/80" />

      <div className="relative flex flex-1 flex-col items-center justify-center px-1 py-2">
        <span
          className={[
            'text-lg leading-none',
            'animate-pulse text-red-500',
          ].join(' ')}
        >
          ⚡
        </span>
        <span className="mt-1.5 text-[9px] font-bold uppercase tracking-wider text-red-400 sm:text-[10px]">
          Wound
        </span>
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-md bg-red-500/5 opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="pointer-events-none absolute inset-0 animate-pulse rounded-md shadow-[inset_0_0_12px_rgba(239,68,68,0.15)]" />
    </button>
  )
}
