import { useTranslation } from 'react-i18next'
import { useGameStore } from '@/store/gameStore'
import TopBar from './TopBar'
import BottomPanel from './BottomPanel'

export default function GameBoard() {
  const { t } = useTranslation('ui')
  const isGameActive = useGameStore((s) => s.isGameActive)

  if (!isGameActive) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-violet-500" />
          <span className="text-sm text-slate-500">{t('game.loading', 'Loading...')}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-slate-950">
      <TopBar />

      <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-slate-900/50">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(148,163,184,0.8) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }} />

        <div className="relative flex flex-col items-center gap-3 text-center">
          <span className="text-4xl animate-[pulse_3s_ease-in-out_infinite] sm:text-5xl">🗺️</span>
          <p className="text-sm font-medium tracking-wide text-slate-500 sm:text-base">
            {t('game.hexMapPlaceholder', 'Hex Map — Coming Soon')}
          </p>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-slate-600 animate-pulse"
                style={{ animationDelay: `${i * 300}ms` }}
              />
            ))}
          </div>
        </div>
      </main>

      <BottomPanel />
    </div>
  )
}
