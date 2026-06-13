import { useMemo, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '@/store/gameStore'
import { useUIStore } from '@/store/uiStore'
import { ScoringCalculator } from '@/engine/ScoringCalculator'
import AdBanner from '@/components/ads/AdBanner'
import AdRewarded from '@/components/ads/AdRewarded'

export default function ScoreScreen() {
  const { t } = useTranslation('ui')
  const { fame, level, finalScore } = useGameStore()
  const navigate = useUIStore((s) => s.navigate)
  const reset = useGameStore((s) => s.reset)

  const [showRewarded, setShowRewarded] = useState(false)

  const rating = useMemo(() => {
    const calculator = new ScoringCalculator()
    return calculator.getScoreRating(finalScore?.totalScore ?? fame)
  }, [finalScore, fame])

  const handlePlayAgain = () => {
    reset()
    navigate('main_menu')
  }

  const handleRewardEarned = useCallback(() => {
    setShowRewarded(false)
  }, [])

  const handleRewardDismiss = useCallback(() => {
    setShowRewarded(false)
  }, [])

  const totalScore = finalScore?.totalScore ?? fame
  const achievements = finalScore?.achievements ?? []

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 px-4" aria-label={t('score.title', 'Game Over')}>
      <h1 className="font-display text-gold-foil text-4xl font-bold">
        {t('score.title', 'Game Over')}
      </h1>

      <div className="w-full max-w-md space-y-6">
        <div className="rounded-xl border border-slate-700/60 bg-slate-800 p-8 text-center shadow-xl shadow-amber-900/10">
          <p className="font-mono text-6xl font-extrabold text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.3)]">
            {totalScore}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {t('score.totalScore', 'Total Score')}
          </p>

          <div className="mt-4 inline-block rounded-full bg-amber-500/15 px-4 py-1.5 text-sm font-bold text-amber-300 ring-1 ring-amber-500/30">
            {t(`score.rating.${rating.toLowerCase()}`, { defaultValue: rating })}
          </div>

          <div className="mt-4 flex items-center justify-center gap-6 text-sm">
            <div className="text-center">
              <span className="block font-mono text-lg font-bold text-yellow-400">{fame}</span>
              <span className="text-[10px] uppercase tracking-wider text-slate-500">
                {t('score.baseFame', 'Base Fame')}
              </span>
            </div>
            <div className="h-8 w-px bg-slate-700" />
            <div className="text-center">
              <span className="block font-mono text-lg font-bold text-emerald-400">{level}</span>
              <span className="text-[10px] uppercase tracking-wider text-slate-500">
                {t('score.level', 'Level')}
              </span>
            </div>
          </div>
        </div>

        {achievements.length > 0 && (
          <div className="rounded-xl border border-slate-700/60 bg-slate-800/60 p-5">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
              {t('score.achievements', 'Achievements')}
            </h3>
            <div className="flex flex-col gap-2">
              {achievements.map((entry, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg bg-slate-700/30 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-200">
                      {entry.id ? t(`score.entryTitle.${entry.id}`, { defaultValue: entry.category }) : entry.category}
                    </span>
                    <span className="block truncate text-[10px] text-slate-500">
                      {entry.id ? t(`score.entryDesc.${entry.id}`, { defaultValue: entry.description, ...entry.params }) : entry.description}
                    </span>
                  </div>
                  <span className={`ml-3 shrink-0 font-mono text-sm font-bold ${entry.points >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                    {entry.points >= 0 ? '+' : ''}{entry.points}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => setShowRewarded(true)}
          aria-label={t('ads.retryTitle', 'Try Again?')}
          className="rounded-lg bg-amber-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          {t('ads.retryTitle', 'Try Again?')}
        </button>
        <button
          type="button"
          onClick={handlePlayAgain}
          aria-label={t('menu.playAgain', 'Play Again')}
          className="rounded-lg bg-violet-600 px-6 py-3 text-lg font-semibold text-white transition-colors hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          {t('menu.playAgain', 'Play Again')}
        </button>
      </div>

      <AdBanner slotId="mk-score-banner" />

      <AdRewarded
        show={showRewarded}
        rewardType="retry"
        onReward={handleRewardEarned}
        onClose={handleRewardDismiss}
      />
    </div>
  )
}
