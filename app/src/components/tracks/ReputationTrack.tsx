const POSITIONS = [-7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7] as const

import { useTranslation } from 'react-i18next'

const MODIFIERS: Record<number, number> = {
  '-7': 0, '-6': 0, '-5': 0,
  '-4': -5, '-3': -3, '-2': -1, '-1': 0,
  '0': 0,
  '1': 0, '2': 1, '3': 2, '4': 3, '5': 5, '6': 5, '7': 5,
}

const CANNOT_INTERACT_THRESHOLD = -5

interface ReputationTrackProps {
  reputation: number
}

function cellColor(pos: number, current: number): string {
  if (pos <= CANNOT_INTERACT_THRESHOLD) {
    return pos === current
      ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
      : 'bg-red-900/50'
  }
  if (pos === current) {
    if (pos < 0) return 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]'
    if (pos === 0) return 'bg-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.4)]'
    return 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
  }
  if (pos < 0) return 'bg-red-950/40'
  if (pos === 0) return 'bg-slate-800/60'
  return 'bg-emerald-950/40'
}

function borderColor(pos: number, current: number): string {
  if (pos === current) {
    if (pos <= CANNOT_INTERACT_THRESHOLD) return 'border-red-400'
    if (pos < 0) return 'border-red-300'
    if (pos === 0) return 'border-slate-300'
    return 'border-emerald-300'
  }
  return 'border-slate-700/40'
}

export default function ReputationTrack({ reputation }: ReputationTrackProps) {
  const { t } = useTranslation('ui')
  const clamped = Math.max(-7, Math.min(7, reputation))
  const modifier = MODIFIERS[clamped] ?? 0
  const canInteract = clamped > CANNOT_INTERACT_THRESHOLD

  return (
    <div className="w-full max-w-[260px]">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-cyan-500/80">
          {t('track.reputation', 'Reputation')}
        </span>
        <div className="flex items-center gap-2">
          {!canInteract && (
            <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-400">
              {t('track.noInteraction', 'No Interaction')}
            </span>
          )}
          <span className="font-mono text-xs font-medium text-cyan-400/90">
            {modifier >= 0 ? `+${modifier}` : modifier}
          </span>
        </div>
      </div>

      <div className="flex gap-px">
        {POSITIONS.map((pos) => {
          const isCurrent = pos === clamped
          return (
            <div
              key={pos}
              className={[
                'relative flex h-6 flex-1 items-center justify-center rounded-sm border transition-all duration-300',
                cellColor(pos, clamped),
                borderColor(pos, clamped),
                isCurrent ? 'z-10 scale-110' : '',
              ].join(' ')}
            >
              {isCurrent && (
                <div className="h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.6)]" />
              )}
            </div>
          )
        })}
      </div>

      <div className="relative mt-1 flex gap-px">
        {POSITIONS.map((pos) => (
          <span
            key={pos}
            className={[
              'flex-1 text-center text-[7px] font-bold',
              pos === clamped
                ? pos < 0
                  ? 'text-red-400'
                  : pos === 0
                    ? 'text-slate-300'
                    : 'text-emerald-400'
                : 'text-slate-600',
            ].join(' ')}
          >
            {pos > 0 ? `+${pos}` : pos}
          </span>
        ))}
      </div>

      {clamped <= CANNOT_INTERACT_THRESHOLD && (
        <div className="mt-1.5 flex items-center justify-center gap-1 rounded bg-red-500/10 px-2 py-0.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="h-3 w-3 text-red-400"
          >
            <path
              fillRule="evenodd"
              d="M6.701 2.25c.577-1 2.02-1 2.598 0l5.196 9a1.5 1.5 0 0 1-1.299 2.25H2.804a1.5 1.5 0 0 1-1.3-2.25l5.197-9ZM8 5a.75.75 0 0 1 .75.75v2a.75.75 0 0 1-1.5 0v-2A.75.75 0 0 1 8 5Zm0 6.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-[9px] font-semibold text-red-400">
            {t('track.cannotInteractWithInhabitants', 'Cannot interact with inhabitants')}
          </span>
        </div>
      )}
    </div>
  )
}
