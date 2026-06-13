import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { adService } from '@/services/adService'

interface AdRewardedProps {
  show: boolean
  rewardType: 'retry' | 'hint'
  onReward: () => void
  onClose: () => void
}

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
}

const modalVariants = {
  hidden: { opacity: 0, scale: 0.88, y: 24 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring' as const, damping: 24, stiffness: 340, delay: 0.05 },
  },
  exit: { opacity: 0, scale: 0.94, y: 12, transition: { duration: 0.18 } },
}

export default function AdRewarded({ show, rewardType, onReward, onClose }: AdRewardedProps) {
  const { t } = useTranslation('ui')
  const [loading, setLoading] = useState(false)
  const [online, setOnline] = useState(() => adService.isOnline())

  useEffect(() => {
    const checkOnline = () => setOnline(adService.isOnline())
    window.addEventListener('online', checkOnline)
    window.addEventListener('offline', checkOnline)
    return () => {
      window.removeEventListener('online', checkOnline)
      window.removeEventListener('offline', checkOnline)
    }
  }, [])

  useEffect(() => {
    if (!show) {
      setLoading(false)
    }
  }, [show])

  const promptMessage = rewardType === 'retry'
    ? t('ad.rewardRetryPrompt', 'Watch a short video to get a retry?')
    : t('ad.rewardHintPrompt', 'Watch a short video to see a hint?')

  const handleWatch = useCallback(async () => {
    setLoading(true)
    const completed = await adService.showRewarded()
    setLoading(false)

    if (completed) {
      adService.onRewardEarned?.({ type: rewardType, amount: 1 })
      onReward()
    } else {
      setOnline(adService.isOnline())
    }
  }, [rewardType, onReward])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t('ad.rewardDialog', 'Reward video')}
            className={[
              'relative z-10 w-full max-w-xs',
              'rounded-xl bg-slate-800',
              'border border-slate-700/60',
              'shadow-2xl shadow-black/50',
              'ring-1 ring-white/5',
              'px-6 py-6',
            ].join(' ')}
            variants={modalVariants}
          >
            <div className="flex flex-col items-center gap-4 text-center">
              <span className="text-2xl">{rewardType === 'retry' ? '🔄' : '💡'}</span>

              <p className="text-sm font-medium leading-relaxed text-slate-200">
                {promptMessage}
              </p>

              {!online && (
                <p className="text-xs font-medium text-red-400/80">
                  {t('ad.unavailableOffline', 'Unavailable offline')}
                </p>
              )}

              <div className="flex w-full gap-3 pt-1">
                <button
                  onClick={onClose}
                  className={[
                    'flex-1 rounded-lg px-4 py-2.5',
                    'text-sm font-semibold text-slate-300',
                    'bg-slate-700 border border-slate-600/30',
                    'hover:bg-slate-600 active:bg-slate-800',
                    'transition-colors duration-150',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400',
                  ].join(' ')}
                >
                  {t('ad.noThanks', 'No Thanks')}
                </button>

                <button
                  onClick={handleWatch}
                  disabled={!online || loading}
                  className={[
                    'flex-1 rounded-lg px-4 py-2.5',
                    'text-sm font-semibold text-white',
                    'bg-violet-600 border border-violet-500/20',
                    'shadow-lg shadow-violet-900/30',
                    'hover:bg-violet-500 active:bg-violet-700',
                    'disabled:bg-violet-600/40 disabled:shadow-none disabled:cursor-not-allowed',
                    'transition-colors duration-150',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400',
                  ].join(' ')}
                >
                  {loading ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    t('ad.watchVideo', 'Watch Video')
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
