import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

// ── Fame level thresholds ────────────────
const THRESHOLDS = [0, 3, 8, 15, 24, 35, 48, 63, 80, 99] as const

interface FameTrackProps {
  fame: number
  level: number
}

function getFameToNext(fame: number, level: number): number | null {
  const nextIdx = level
  if (nextIdx >= THRESHOLDS.length) return null
  return THRESHOLDS[nextIdx] - fame
}

export default function FameTrack({ fame, level }: FameTrackProps) {
  const { t } = useTranslation('ui')
  const [hovered, setHovered] = useState(false)

  const maxFame = THRESHOLDS[THRESHOLDS.length - 1]
  const fillPercent = Math.min((fame / maxFame) * 100, 100)
  const fameToNext = useMemo(() => getFameToNext(fame, level), [fame, level])

  return (
    <div
      className="relative w-full max-w-[220px]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Header row ────────────── */}
      <div className="mb-1.5 flex items-baseline justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-500/80">
            {t('track.fame', 'Fame')}
          </span>
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-xs font-bold text-amber-400 shadow-sm shadow-amber-500/10">
            {t('track.level', 'Lv')} {level}
          </span>
        </div>
        <span className="font-mono text-xs font-medium text-yellow-400/90">
          {fame}
        </span>
      </div>

      {/* ── Track bar ─────────────── */}
      <div className="relative h-3.5 overflow-hidden rounded-full bg-slate-800 shadow-inner shadow-black/50 ring-1 ring-slate-700/60">
        {/* Fill gradient */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-400 shadow-[0_0_8px_rgba(245,158,11,0.35)] transition-all duration-500 ease-out"
          style={{ width: `${fillPercent}%` }}
        />

        {/* Shimmer overlay on fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-all duration-500 ease-out"
          style={{ width: `${fillPercent}%` }}
        />

        {/* Level milestone markers */}
        {THRESHOLDS.map((threshold, idx) => {
          const markerPercent = (threshold / maxFame) * 100
          const isCurrentOrPast = fame >= threshold
          const isCurrentLevel = idx === level - 1
          return (
            <div
              key={idx}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${markerPercent}%` }}
            >
              <div
                className={[
                  'rounded-full border transition-all duration-300',
                  isCurrentLevel
                    ? 'h-3 w-3 border-amber-300 bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]'
                    : isCurrentOrPast
                      ? 'h-2 w-2 border-amber-500/60 bg-amber-500/80'
                      : 'h-2 w-2 border-slate-600 bg-slate-700',
                ].join(' ')}
              />
            </div>
          )
        })}
      </div>

      {/* ── Level number ticks below ── */}
      <div className="relative mt-1 h-3">
        {THRESHOLDS.map((threshold, idx) => {
          const markerPercent = (threshold / maxFame) * 100
          const isCurrentLevel = idx === level - 1
          return (
            <span
              key={idx}
              className={[
                'absolute -translate-x-1/2 text-[8px] font-bold',
                isCurrentLevel
                  ? 'text-amber-400'
                  : idx < level
                    ? 'text-slate-500'
                    : 'text-slate-600',
              ].join(' ')}
              style={{ left: `${markerPercent}%` }}
            >
              {idx + 1}
            </span>
          )
        })}
      </div>

      {/* ── Tooltip on hover ──────── */}
      {hovered && (
        <div className="absolute -top-8 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-600/40 bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-200 shadow-lg shadow-black/30">
          {fameToNext !== null
            ? t('track.fameToNext', '{{count}} fame to level {{level}}', { count: fameToNext, level: level + 1 })
            : t('track.maxLevelReached', 'Max level reached')}
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-x-transparent border-b-transparent border-t-slate-700" />
        </div>
      )}
    </div>
  )
}
