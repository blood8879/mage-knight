import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '@/store/gameStore'
import type { GameLogType } from '@/engine/GameState'

/**
 * Animated toasts for key game events (fame, crystals, wounds, conquests…).
 * Watches the engine log and surfaces the entries a board-game player would
 * see happen physically on the table.
 */

interface Toast {
  id: number
  icon: string
  message: string
  tone: string
}

const EVENT_STYLE: Partial<Record<GameLogType, { icon: string; tone: string }>> = {
  fame_gain: { icon: '⭐', tone: 'border-amber-500/50 bg-amber-950/90 text-amber-200' },
  crystal_gain: { icon: '💎', tone: 'border-violet-500/50 bg-violet-950/90 text-violet-200' },
  wound_gain: { icon: '🩸', tone: 'border-red-500/50 bg-red-950/90 text-red-200' },
  wound_heal: { icon: '💚', tone: 'border-emerald-500/50 bg-emerald-950/90 text-emerald-200' },
  site_conquer: { icon: '🚩', tone: 'border-amber-500/50 bg-amber-950/90 text-amber-200' },
  skill_gain: { icon: '✨', tone: 'border-cyan-500/50 bg-cyan-950/90 text-cyan-200' },
  card_acquire: { icon: '🃏', tone: 'border-violet-500/50 bg-violet-950/90 text-violet-200' },
  unit_recruit: { icon: '🛡️', tone: 'border-emerald-500/50 bg-emerald-950/90 text-emerald-200' },
  level_up: { icon: '⬆️', tone: 'border-amber-500/50 bg-amber-950/90 text-amber-200' },
}

let toastCounter = 0

export default function EventToasts() {
  const { t } = useTranslation('ui')
  const log = useGameStore((s) => s.engineState?.log)
  const [toasts, setToasts] = useState<Toast[]>([])
  const seenCountRef = useRef<number | null>(null)

  useEffect(() => {
    if (!log) return
    // First sync: don't replay history
    if (seenCountRef.current === null) {
      seenCountRef.current = log.length
      return
    }
    if (log.length <= seenCountRef.current) {
      seenCountRef.current = log.length
      return
    }
    const fresh = log.slice(seenCountRef.current)
    seenCountRef.current = log.length

    const newToasts: Toast[] = []
    for (const entry of fresh) {
      const style = EVENT_STYLE[entry.type]
      if (!style) continue
      // Keyed messages ('logmsg.*') are translated with their data as params;
      // legacy free-text messages fall through via defaultValue.
      const params: Record<string, unknown> = { ...entry.data, defaultValue: entry.message }
      if (typeof params.color === 'string') {
        params.color = t(`colors.${params.color}`, { defaultValue: params.color as string })
      }
      newToasts.push({
        id: ++toastCounter,
        icon: style.icon,
        message: t(entry.message, params),
        tone: style.tone,
      })
    }
    if (newToasts.length === 0) return

    setToasts((prev) => [...prev, ...newToasts].slice(-4))
    for (const toast of newToasts) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id))
      }, 3200)
    }
  }, [log, t])

  return (
    <div className="pointer-events-none fixed left-1/2 top-14 z-[60] flex w-full max-w-xs -translate-x-1/2 flex-col items-center gap-1.5 px-3">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -12, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', damping: 22, stiffness: 380 }}
            className={`flex w-full items-center gap-2 rounded-lg border px-3 py-1.5 shadow-lg backdrop-blur ${toast.tone}`}
          >
            <span className="text-base leading-none">{toast.icon}</span>
            <span className="min-w-0 flex-1 truncate text-xs font-semibold">{toast.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
