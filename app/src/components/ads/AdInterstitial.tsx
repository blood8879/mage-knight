import { useEffect, useRef, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { adService } from '@/services/adService'

interface AdInterstitialProps {
  show: boolean
  onComplete: () => void
  onSkip: () => void
}

const SKIP_TIMEOUT_MS = 2000

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.25 } },
}

const contentVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring' as const, damping: 26, stiffness: 320, delay: 0.1 },
  },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.2 } },
}

export default function AdInterstitial({ show, onComplete, onSkip }: AdInterstitialProps) {
  const { t } = useTranslation('ui')
  const skipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attemptedRef = useRef(false)

  // Use refs for callbacks so the effect doesn't re-run (and kill the timer)
  // when parent re-renders with new callback references
  const onCompleteRef = useRef(onComplete)
  const onSkipRef = useRef(onSkip)
  onCompleteRef.current = onComplete
  onSkipRef.current = onSkip

  const cleanup = useCallback(() => {
    if (skipTimerRef.current) {
      clearTimeout(skipTimerRef.current)
      skipTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!show) {
      attemptedRef.current = false
      cleanup()
      return
    }

    if (attemptedRef.current) return
    attemptedRef.current = true

    if (!adService.isOnline()) {
      skipTimerRef.current = setTimeout(() => onSkipRef.current(), SKIP_TIMEOUT_MS)
      return cleanup
    }

    adService.showInterstitial().then((shown) => {
      if (shown) {
        onCompleteRef.current()
      } else {
        skipTimerRef.current = setTimeout(() => onSkipRef.current(), SKIP_TIMEOUT_MS)
      }
    })

    return cleanup
  }, [show, cleanup])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm" />

          <motion.div
            className="relative z-10 flex flex-col items-center gap-5"
            variants={contentVariants}
          >
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-violet-400" />

            <p className="text-sm font-semibold tracking-wide text-slate-300">
              {t('ad.loadingNextRound', 'Loading next round...')}
            </p>

            <div className="mt-1 h-px w-24 bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
