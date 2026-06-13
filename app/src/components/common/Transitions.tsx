import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'

// ── RoundTransition ─────────────────────────

interface RoundTransitionProps {
  round: number
  dayNight: 'day' | 'night'
  onComplete: () => void
}

const roundOverlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4 } },
  exit: { opacity: 0, transition: { duration: 0.35, delay: 0.1 } },
}

const roundTextVariants = {
  hidden: { opacity: 0, scale: 0.7, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring' as const, damping: 20, stiffness: 260, delay: 0.15 },
  },
  exit: {
    opacity: 0,
    scale: 1.08,
    y: -12,
    transition: { duration: 0.3 },
  },
}

const roundSubtitleVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: 0.4 },
  },
  exit: { opacity: 0, transition: { duration: 0.2 } },
}

export function RoundTransition({ round, dayNight, onComplete }: RoundTransitionProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2000)
    return () => clearTimeout(timer)
  }, [onComplete])

  const isDay = dayNight === 'day'

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      variants={roundOverlayVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Backdrop glow */}
      <div
        className={[
          'absolute inset-0',
          isDay
            ? 'bg-gradient-to-br from-amber-950/95 via-orange-950/90 to-yellow-950/95'
            : 'bg-gradient-to-br from-indigo-950/95 via-slate-950/95 to-blue-950/95',
        ].join(' ')}
      />

      {/* Radial glow accent */}
      <div
        className={[
          'absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl',
          isDay ? 'bg-amber-500/20' : 'bg-indigo-500/15',
        ].join(' ')}
      />

      {/* Text content */}
      <motion.h1
        className={[
          'relative z-10 text-4xl font-black tracking-widest sm:text-5xl',
          isDay ? 'text-amber-300' : 'text-indigo-300',
        ].join(' ')}
        variants={roundTextVariants}
      >
        Round {round}
      </motion.h1>

      <motion.p
        className={[
          'relative z-10 mt-3 text-sm font-semibold uppercase tracking-[0.3em]',
          isDay ? 'text-amber-400/70' : 'text-indigo-400/70',
        ].join(' ')}
        variants={roundSubtitleVariants}
      >
        {isDay ? '☀ Day Phase' : '☾ Night Phase'}
      </motion.p>

      {/* Decorative bar */}
      <motion.div
        className={[
          'relative z-10 mt-6 h-px w-32',
          isDay ? 'bg-gradient-to-r from-transparent via-amber-500/50 to-transparent' : 'bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent',
        ].join(' ')}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1, transition: { duration: 0.6, delay: 0.5 } }}
        exit={{ scaleX: 0, transition: { duration: 0.2 } }}
      />
    </motion.div>
  )
}

// ── TurnTransition ──────────────────────────

interface TurnTransitionProps {
  text: string
  onComplete: () => void
}

const turnBannerVariants = {
  hidden: { y: -60, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring' as const, damping: 22, stiffness: 300 },
  },
  exit: {
    y: -60,
    opacity: 0,
    transition: { duration: 0.25 },
  },
}

export function TurnTransition({ text, onComplete }: TurnTransitionProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 1000)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <motion.div
      className="fixed left-0 right-0 top-0 z-50 flex justify-center px-4 pt-3"
      variants={turnBannerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <div className="flex items-center gap-2.5 rounded-xl border border-slate-700/50 bg-slate-900/95 px-6 py-2.5 shadow-2xl shadow-black/40 backdrop-blur-sm">
        <div className="h-2 w-2 rounded-full bg-violet-400 shadow-sm shadow-violet-400/50" />
        <span className="text-sm font-bold tracking-wide text-slate-200">{text}</span>
      </div>
    </motion.div>
  )
}

// ── LevelUpEffect ───────────────────────────

interface LevelUpEffectProps {
  newLevel: number
  onComplete: () => void
}

const celebrationOverlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.4 } },
}

const celebrationCardVariants = {
  hidden: { opacity: 0, scale: 0.6, rotate: -5 },
  visible: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: { type: 'spring' as const, damping: 14, stiffness: 200, delay: 0.15 },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: -20,
    transition: { duration: 0.3 },
  },
}

const PARTICLES = [
  { x: -80, y: -60, delay: 0.2, size: 6 },
  { x: 90, y: -45, delay: 0.3, size: 4 },
  { x: -55, y: 55, delay: 0.25, size: 5 },
  { x: 70, y: 60, delay: 0.35, size: 3 },
  { x: -30, y: -80, delay: 0.4, size: 4 },
  { x: 40, y: -75, delay: 0.45, size: 5 },
  { x: -90, y: 10, delay: 0.3, size: 3 },
  { x: 95, y: 15, delay: 0.5, size: 4 },
] as const

export function LevelUpEffect({ newLevel, onComplete }: LevelUpEffectProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2500)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      variants={celebrationOverlayVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm" />

      {/* Radial gold glow */}
      <div className="absolute left-1/2 top-1/2 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/15 blur-3xl" />

      {/* Particles (CSS-only decorative dots) */}
      {PARTICLES.map((p, i) => (
        <motion.div
          key={i}
          className="absolute left-1/2 top-1/2 rounded-full bg-amber-400/60"
          style={{ width: p.size, height: p.size }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
          animate={{
            x: p.x,
            y: p.y,
            opacity: [0, 1, 1, 0],
            scale: [0, 1.2, 1, 0],
          }}
          transition={{
            duration: 1.6,
            delay: p.delay,
            ease: 'easeOut',
          }}
        />
      ))}

      {/* Card */}
      <motion.div
        className="relative z-10 flex flex-col items-center gap-3 rounded-2xl border border-amber-600/30 bg-gradient-to-b from-amber-950/80 to-slate-900/90 px-10 py-8 shadow-2xl shadow-amber-900/30"
        variants={celebrationCardVariants}
      >
        <span className="text-3xl">⭐</span>

        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400/70">
          Level Up!
        </p>

        <div className="flex items-baseline gap-2">
          <span className="text-lg text-amber-500/50">→</span>
          <span className="text-4xl font-black tracking-tight text-amber-300">
            Level {newLevel}
          </span>
        </div>

        {/* Decorative bottom bar */}
        <motion.div
          className="mt-2 h-px w-24 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1, transition: { duration: 0.5, delay: 0.5 } }}
        />
      </motion.div>
    </motion.div>
  )
}

// ── TransitionPresence ──────────────────────

interface TransitionPresenceProps {
  children: ReactNode
}

export function TransitionPresence({ children }: TransitionPresenceProps) {
  return <AnimatePresence mode="wait">{children}</AnimatePresence>
}
