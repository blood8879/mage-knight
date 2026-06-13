// ═══════════════════════════════════════════
// Map Controls — Zoom / Pan overlay buttons
// ═══════════════════════════════════════════

import { useTranslation } from 'react-i18next'

interface MapControlsProps {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
}

export default function MapControls({ zoom, onZoomIn, onZoomOut, onReset }: MapControlsProps) {
  const { t } = useTranslation('ui')
  const pct = Math.round(zoom * 100)

  return (
    <div className="absolute right-3 top-3 z-10 flex flex-col items-center gap-1.5">
      {/* ── Zoom In ─────────────────── */}
      <button
        onClick={onZoomIn}
        aria-label={t('game.zoomIn', { defaultValue: 'Zoom in' })}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800/80 text-sm font-bold text-slate-200 shadow-lg shadow-black/20 backdrop-blur-sm transition-all hover:bg-slate-700/90 hover:text-white active:scale-95"
      >
        +
      </button>

      {/* ── Zoom Level ─────────────── */}
      <div className="flex h-7 min-w-[2.75rem] items-center justify-center rounded-md bg-slate-800/60 px-1.5 backdrop-blur-sm">
        <span className="text-[10px] font-semibold tabular-nums text-slate-400">
          {pct}%
        </span>
      </div>

      {/* ── Zoom Out ────────────────── */}
      <button
        onClick={onZoomOut}
        aria-label={t('game.zoomOut', { defaultValue: 'Zoom out' })}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800/80 text-sm font-bold text-slate-200 shadow-lg shadow-black/20 backdrop-blur-sm transition-all hover:bg-slate-700/90 hover:text-white active:scale-95"
      >
        −
      </button>

      {/* ── Spacer ──────────────────── */}
      <div className="my-0.5 h-px w-5 bg-slate-600/40" />

      {/* ── Reset ───────────────────── */}
      <button
        onClick={onReset}
        aria-label={t('game.resetView', { defaultValue: 'Reset view' })}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800/80 text-xs text-slate-400 shadow-lg shadow-black/20 backdrop-blur-sm transition-all hover:bg-slate-700/90 hover:text-slate-200 active:scale-95"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
        >
          <path
            fillRule="evenodd"
            d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H4.598a.75.75 0 0 0-.75.75v3.634a.75.75 0 0 0 1.5 0v-2.033l.312.311a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm-10.625-2.85a5.5 5.5 0 0 1 9.201-2.465l.312.311H11.767a.75.75 0 0 0 0 1.5h3.634a.75.75 0 0 0 .75-.75V3.536a.75.75 0 0 0-1.5 0v2.033l-.312-.311A7 7 0 0 0 2.627 8.396a.75.75 0 0 0 1.449.39l.611-.212Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  )
}
