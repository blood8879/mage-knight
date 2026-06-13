import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'

interface GameTipsProps {
  phase: string
  isFirstCombat?: boolean
  isLevelUp?: boolean
}

interface TipConfig {
  key: string
  icon: string
  color: string
}

const PHASE_TO_TIP: Record<string, TipConfig> = {
  tactic_selection: { key: 'tipTactic', icon: '\uD83C\uDFAF', color: 'text-blue-400' },
  player_turn_start: { key: 'tipTurn', icon: '\u23F0', color: 'text-green-400' },
  movement: { key: 'tipMove', icon: '\uD83D\uDDFA\uFE0F', color: 'text-amber-400' },
  combat_ranged_siege: { key: 'tipCombat', icon: '\u2694\uFE0F', color: 'text-red-400' },
  combat_assign_damage: { key: 'tipDamage', icon: '\uD83D\uDEE1\uFE0F', color: 'text-orange-400' },
  level_up: { key: 'tipLevelUp', icon: '\u2B06\uFE0F', color: 'text-purple-400' },
  interaction: { key: 'tipSite', icon: '\uD83C\uDFF0', color: 'text-cyan-400' },
  end_of_turn: { key: 'tipEndTurn', icon: '\uD83D\uDCA1', color: 'text-slate-400' },
}

const AUTO_DISMISS_MS = 8000

export default function GameTips({ phase, isFirstCombat = false, isLevelUp = false }: GameTipsProps) {
  const { t } = useTranslation('ui')
  const [currentTip, setCurrentTip] = useState<TipConfig | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [progress, setProgress] = useState(100)

  const hasSeen = useCallback((key: string) => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem(`gameTips_seen_${key}`) === '1'
  }, [])

  const markSeen = useCallback((key: string) => {
    if (typeof window !== 'undefined') localStorage.setItem(`gameTips_seen_${key}`, '1')
  }, [])

  const dismiss = useCallback(() => {
    if (currentTip) {
      markSeen(currentTip.key)
      setIsVisible(false)
      setCurrentTip(null)
      setProgress(100)
    }
  }, [currentTip, markSeen])

  useEffect(() => {
    let tip: TipConfig | null = null

    if (isLevelUp && phase === 'level_up') {
      tip = PHASE_TO_TIP.level_up
    } else if (isFirstCombat && phase === 'combat_ranged_siege') {
      tip = PHASE_TO_TIP.combat_ranged_siege
    } else if (PHASE_TO_TIP[phase]) {
      tip = PHASE_TO_TIP[phase]
    }

    if (tip && !hasSeen(tip.key)) {
      setCurrentTip(tip)
      setIsVisible(true)
      setProgress(100)
    }
  }, [phase, isFirstCombat, isLevelUp, hasSeen])

  useEffect(() => {
    if (!isVisible || !currentTip) { setProgress(100); return }

    const start = Date.now()
    const id = setInterval(() => {
      const rem = Math.max(0, 100 - ((Date.now() - start) / AUTO_DISMISS_MS) * 100)
      setProgress(rem)
      if (rem === 0) dismiss()
    }, 50)

    return () => clearInterval(id)
  }, [isVisible, currentTip, dismiss])

  if (typeof window === 'undefined' || !currentTip) return null

  return createPortal(
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2"
        >
          <div className="max-w-sm overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/95 shadow-2xl backdrop-blur-sm">
            <div className="flex gap-3 p-4">
              <span className="shrink-0 text-xl leading-none">{currentTip.icon}</span>
              <div className="min-w-0 flex-1">
                <h3 className="mb-0.5 text-sm font-semibold text-slate-100">
                  {t(`tips.${currentTip.key}.title`)}
                </h3>
                <p className="text-xs leading-relaxed text-slate-400">
                  {t(`tips.${currentTip.key}.desc`)}
                </p>
              </div>
            </div>
            <div className="flex justify-end px-4 pb-3">
              <button
                type="button"
                onClick={dismiss}
                className="text-xs font-medium text-violet-400 transition-colors hover:text-violet-300"
              >
                {t('tips.gotIt', 'Got it')}
              </button>
            </div>
            <div className="h-1 bg-slate-800/50">
              <div
                className="h-full bg-violet-500 transition-[width] duration-75 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
