import { useTranslation } from 'react-i18next'
import type { UnitInstance, UnitStatus } from '@/engine/types'
import { useCardTranslation } from '@/hooks/useCardTranslation'

const STATUS_RING: Record<UnitStatus, string> = {
  ready: 'ring-emerald-400/60 shadow-emerald-500/20',
  spent: 'ring-slate-500/40 shadow-none',
  wounded: 'ring-red-400/60 shadow-red-500/20',
}

const STATUS_DOT: Record<UnitStatus, string> = {
  ready: 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.6)]',
  spent: 'bg-slate-500',
  wounded: 'bg-red-400 shadow-[0_0_4px_rgba(248,113,113,0.6)]',
}

const STATUS_LABEL: Record<UnitStatus, string> = {
  ready: 'Ready',
  spent: 'Spent',
  wounded: 'Wounded',
}

const TIER_BADGE: Record<string, string> = {
  regular: 'bg-slate-600 text-slate-300',
  elite: 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30',
}

interface UnitSlotsProps {
  units: UnitInstance[]
  unitLimit: number
  onUnitClick?: (index: number) => void
}

export default function UnitSlots({ units, unitLimit, onUnitClick }: UnitSlotsProps) {
  const { t } = useTranslation('ui')
  const { getUnitName } = useCardTranslation()
  const emptySlots = Math.max(0, unitLimit - units.length)

  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-teal-400/80">
          {t('game.unitsLabel', { defaultValue: 'Units' })}
        </span>
        <span className="font-mono text-[10px] text-slate-500">
          {units.length}/{unitLimit}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {units.map((inst, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onUnitClick?.(idx)}
            className={[
              'group relative flex w-[100px] flex-col rounded-lg border border-slate-700/60 bg-slate-800/80 p-2 ring-2 shadow-md transition-all duration-200',
              STATUS_RING[inst.status],
              inst.status === 'spent' ? 'opacity-60' : '',
              'cursor-pointer hover:border-slate-600 hover:bg-slate-700/80 active:scale-95',
            ].join(' ')}
            title={`${getUnitName(inst.unit)} — ${t(`game.unitStatus.${inst.status}`, { defaultValue: STATUS_LABEL[inst.status] })}`}
          >
            <div className="mb-1 flex items-start justify-between">
              <span
                className={[
                  'rounded px-1 py-0.5 text-[8px] font-bold uppercase',
                  TIER_BADGE[inst.unit.tier],
                ].join(' ')}
              >
                {inst.unit.tier === 'elite' ? '★' : '●'} Lv{inst.unit.level}
              </span>
              <div className="flex items-center gap-1">
                <div className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[inst.status]}`} />
              </div>
            </div>

            <span className="mb-1.5 truncate text-left text-[11px] font-semibold leading-tight text-slate-200 group-hover:text-white">
              {getUnitName(inst.unit)}
            </span>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="h-3 w-3 text-slate-400"
                >
                  <path
                    fillRule="evenodd"
                    d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="font-mono text-[10px] font-bold text-slate-300">
                  {inst.unit.armor}
                </span>
              </div>

              {inst.status === 'wounded' && inst.woundCount > 0 && (
                <div className="flex items-center gap-0.5 rounded bg-red-500/15 px-1 py-0.5">
                  <span className="text-[9px] text-red-400">✕</span>
                  <span className="font-mono text-[9px] font-bold text-red-400">
                    {inst.woundCount}
                  </span>
                </div>
              )}
            </div>
          </button>
        ))}

        {Array.from({ length: emptySlots }).map((_, idx) => (
          <div
            key={`empty-${idx}`}
            className="flex h-[76px] w-[100px] items-center justify-center rounded-lg border-2 border-dashed border-slate-700/40 bg-slate-800/20"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="h-4 w-4 text-slate-700"
            >
              <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
            </svg>
          </div>
        ))}

        {units.length === 0 && emptySlots === 0 && (
          <span className="text-xs italic text-slate-600">{t('game.noUnitSlots', { defaultValue: 'No unit slots' })}</span>
        )}
      </div>
    </div>
  )
}
