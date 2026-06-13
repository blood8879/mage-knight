import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type {
  TutorialChapter,
  TutorialSnapshot,
  TutorialStepDef,
  SpotlightArea,
} from '@/engine/TutorialChapters'

// ── Props ────────────────────────────────────
interface InteractiveTutorialProps {
  chapter: TutorialChapter | null
  snapshot: TutorialSnapshot
  onComplete: () => void
  onChapterComplete: (chapterId: number) => void
}

// ── Rect type for element bounds ─────────────
interface ElementRect {
  top: number
  left: number
  width: number
  height: number
}

// ── Element Highlight (SVG mask cutout + pulsing ring) ──
function ElementHighlight({ target }: { target: string }) {
  const [rect, setRect] = useState<ElementRect | null>(null)
  const padding = 8

  const measure = useCallback(() => {
    const el = document.querySelector<HTMLElement>(`[data-tutorial="${target}"]`)
    if (!el) {
      setRect(null)
      return
    }
    const r = el.getBoundingClientRect()
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [target])

  useEffect(() => {
    measure()

    // Re-measure on resize / scroll
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)

    // ResizeObserver for layout shifts
    const el = document.querySelector<HTMLElement>(`[data-tutorial="${target}"]`)
    let observer: ResizeObserver | null = null
    if (el) {
      observer = new ResizeObserver(measure)
      observer.observe(el)
    }

    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
      observer?.disconnect()
    }
  }, [target, measure])

  if (!rect) return null

  const vw = window.innerWidth
  const vh = window.innerHeight

  const cutX = rect.left - padding
  const cutY = rect.top - padding
  const cutW = rect.width + padding * 2
  const cutH = rect.height + padding * 2
  const cutRx = 12

  return createPortal(
    <>
      {/* SVG mask overlay — blue-tinted for visibility on dark theme */}
      <svg
        className="pointer-events-none fixed inset-0 z-[92]"
        width={vw}
        height={vh}
        style={{ width: vw, height: vh }}
      >
        <defs>
          <mask id="tutorial-mask">
            <rect x={0} y={0} width={vw} height={vh} fill="white" />
            <rect
              x={cutX}
              y={cutY}
              width={cutW}
              height={cutH}
              rx={cutRx}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x={0}
          y={0}
          width={vw}
          height={vh}
          fill="rgba(15,10,40,0.75)"
          mask="url(#tutorial-mask)"
        />
      </svg>

      {/* Glowing ring around the target */}
      <motion.div
        className="pointer-events-none fixed z-[93] rounded-xl border-[3px] border-amber-400 shadow-[0_0_16px_4px_rgba(251,191,36,0.5),inset_0_0_8px_2px_rgba(251,191,36,0.15)]"
        style={{
          top: cutY,
          left: cutX,
          width: cutW,
          height: cutH,
        }}
        animate={{ opacity: [0.7, 1, 0.7], boxShadow: ['0 0 16px 4px rgba(251,191,36,0.5), inset 0 0 8px 2px rgba(251,191,36,0.15)', '0 0 24px 8px rgba(251,191,36,0.7), inset 0 0 12px 4px rgba(251,191,36,0.25)', '0 0 16px 4px rgba(251,191,36,0.5), inset 0 0 8px 2px rgba(251,191,36,0.15)'] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
    </>,
    document.body,
  )
}

// ── Gradient Spotlight overlay (legacy fallback) ──
function SpotlightOverlay({ area }: { area: Exclude<SpotlightArea, 'none' | 'combat' | 'full'> }) {
  const regions: Record<string, { top: string; bottom: string }> = {
    bottom: { top: '0', bottom: '75%' },
    center: { top: '0', bottom: '70%' },
    top: { top: '12%', bottom: '0' },
    'top-right': { top: '0', bottom: '70%' },
    side: { top: '0', bottom: '0' },
    'mana-area': { top: '0', bottom: '70%' },
    interaction: { top: '20%', bottom: '25%' },
  }

  const r = regions[area] ?? { top: '0', bottom: '0' }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[91]"
      style={{
        background: `linear-gradient(to bottom, rgba(0,0,0,0.55) ${r.bottom}, transparent ${r.bottom}, transparent calc(100% - ${r.top === '0' ? '0%' : r.top}), rgba(0,0,0,0.55) calc(100% - ${r.top === '0' ? '0%' : r.top}))`,
      }}
    />
  )
}

// ── Determine if a spotlight area should render ──
function shouldRenderSpotlight(area: SpotlightArea): area is Exclude<SpotlightArea, 'none' | 'combat' | 'full'> {
  return area !== 'none' && area !== 'combat' && area !== 'full'
}

// ── Compute card position: avoid covering the target ──
function useCardPosition(target: string | undefined): 'top' | 'bottom' {
  const [position, setPosition] = useState<'top' | 'bottom'>('top')

  useEffect(() => {
    if (!target) {
      setPosition('top')
      return
    }

    const el = document.querySelector<HTMLElement>(`[data-tutorial="${target}"]`)
    if (!el) {
      setPosition('top')
      return
    }

    const r = el.getBoundingClientRect()
    const midY = r.top + r.height / 2
    // If target is in upper half, put the card at the bottom; otherwise top
    setPosition(midY < window.innerHeight / 2 ? 'bottom' : 'top')
  }, [target])

  return position
}

// ── Main component ───────────────────────────
export default function InteractiveTutorial({
  chapter,
  snapshot,
  onComplete,
  onChapterComplete,
}: InteractiveTutorialProps) {
  const { t } = useTranslation('ui')
  const [stepIdx, setStepIdx] = useState(0)
  const prevSnapshotRef = useRef<TutorialSnapshot>(snapshot)

  // Reset step index when chapter changes
  useEffect(() => {
    setStepIdx(0)
  }, [chapter?.id])

  const steps: TutorialStepDef[] = chapter?.steps ?? []
  const step = steps[stepIdx]

  // ── Auto-advance when player performs the action ──
  useEffect(() => {
    if (!chapter || !step?.requiresAction || !step.advanceWhen) return

    const prev = prevSnapshotRef.current
    const shouldAdvance = step.advanceWhen(prev, snapshot)

    if (shouldAdvance) {
      // Cascade past any following action steps whose (monotonic) conditions
      // are ALREADY satisfied — fast play can complete several expected
      // transitions inside a single state update, and waiting for another
      // snapshot change would strand the tutorial on a stale step.
      setStepIdx((i) => {
        let next = Math.min(i + 1, steps.length - 1)
        while (next < steps.length - 1) {
          const candidate = steps[next]
          if (
            candidate.requiresAction &&
            candidate.advanceWhen &&
            candidate.advanceWhen(snapshot, snapshot)
          ) {
            next += 1
          } else {
            break
          }
        }
        return next
      })
    }

    prevSnapshotRef.current = snapshot
  }, [chapter, step, snapshot, steps.length])

  // Update prev snapshot ref even for non-action steps
  useEffect(() => {
    prevSnapshotRef.current = snapshot
  }, [snapshot])

  // Watchdog: re-evaluate the current action step every 700ms with the latest
  // snapshot (prev = curr). Step conditions are written monotonically, so this
  // is safe — it recovers the rare race where several engine updates batch
  // into one commit and the advance effect lands on an already-satisfied step.
  const snapshotRef = useRef(snapshot)
  snapshotRef.current = snapshot
  useEffect(() => {
    if (!chapter || !step?.requiresAction || !step.advanceWhen) return
    const id = setInterval(() => {
      const snap = snapshotRef.current
      if (step.advanceWhen!(snap, snap)) {
        setStepIdx((i) => Math.min(i + 1, steps.length - 1))
      }
    }, 700)
    return () => clearInterval(id)
  }, [chapter, step, steps.length])

  const cardPosition = useCardPosition(step?.highlightTarget)

  if (!chapter || !step) return null

  const isLastStep = stepIdx >= steps.length - 1
  const hasHighlightTarget = Boolean(step.highlightTarget)

  const handleNext = () => {
    if (isLastStep) {
      onChapterComplete(chapter.id)
      onComplete()
    } else {
      // Functional guard: a stale Next button can still be clicked while the
      // card is exit-animating (AnimatePresence). Never advance past a step
      // that requires a player action — double-taps would skip it entirely.
      setStepIdx((i) => (steps[i]?.requiresAction ? i : Math.min(i + 1, steps.length - 1)))
    }
  }

  const title = t(`interactiveTutorial.${step.i18nKey}.title`, step.id)
  const desc = t(`interactiveTutorial.${step.i18nKey}.desc`, '')

  // Card CSS: position depends on whether we have a highlight target
  const cardPositionClass = step.requiresAction
    ? 'fixed right-4 bottom-20 z-[95] w-72 px-2'
    : hasHighlightTarget
      ? cardPosition === 'bottom'
        ? 'fixed left-1/2 bottom-8 z-[95] w-full max-w-sm -translate-x-1/2 px-4'
        : 'fixed left-1/2 top-20 z-[95] w-full max-w-sm -translate-x-1/2 px-4'
      : 'fixed left-1/2 top-20 z-[95] w-full max-w-sm -translate-x-1/2 px-4'

  return createPortal(
    <AnimatePresence mode="wait">
      <motion.div
        key={step.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="pointer-events-none fixed inset-0 z-[90]"
      >
        {/* Element Highlight (for steps with highlightTarget) */}
        {step.highlightTarget && (
          <ElementHighlight target={step.highlightTarget} />
        )}

        {/* Gradient Spotlight fallback (for steps without highlightTarget) */}
        {!step.highlightTarget && shouldRenderSpotlight(step.spotlight) && (
          <SpotlightOverlay area={step.spotlight} />
        )}

        {/* Instruction card */}
        <motion.div
          initial={{ y: cardPosition === 'bottom' ? 20 : -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: cardPosition === 'bottom' ? 20 : -20, opacity: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className={`pointer-events-auto ${cardPositionClass}`}
        >
          <div className="rounded-2xl border border-amber-600/50 bg-gradient-to-br from-amber-900/95 to-amber-950/95 px-7 py-6 shadow-2xl backdrop-blur-sm">
            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
              <span className="rounded-full border border-amber-600/30 bg-amber-950/50 px-3.5 py-1 text-xs font-semibold text-amber-400">
                {t('interactiveTutorial.step', 'Step')} {stepIdx + 1}/{steps.length}
              </span>
              <button
                type="button"
                onClick={onComplete}
                className="rounded px-2 py-1 text-xs text-amber-400/60 transition-colors hover:bg-amber-800/30 hover:text-amber-300"
              >
                {t('interactiveTutorial.skip', 'Skip Tutorial')}
              </button>
            </div>

            {/* Content */}
            <div className="flex items-start gap-4">
              <span className="mt-0.5 shrink-0 text-4xl">{step.icon}</span>
              <div className="min-w-0 flex-1">
                <h3 className="mb-2 text-xl font-bold text-amber-100">{title}</h3>
                <p className="text-sm leading-relaxed text-amber-200/80">{desc}</p>
              </div>
            </div>

            {/* Next / Finish button for non-action steps */}
            {!step.requiresAction && (
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={handleNext}
                  className="rounded-lg bg-amber-600 px-7 py-2.5 text-sm font-bold text-white shadow-lg transition-colors hover:bg-amber-500 active:scale-95"
                >
                  {isLastStep
                    ? t('interactiveTutorial.finish', 'Start Playing!')
                    : t('interactiveTutorial.next', 'Next')}
                </button>
              </div>
            )}

            {/* Pulsing arrow — suppressed when highlightTarget is present */}
            {step.arrow && !hasHighlightTarget && (
              <div className={`mt-4 flex ${step.arrow === 'down-left' ? 'justify-start pl-4' : 'justify-center'}`}>
                <motion.span
                  animate={
                    step.arrow === 'down-left'
                      ? { x: [0, -6, 0], y: [0, 6, 0] }
                      : step.arrow === 'left'
                        ? { x: [0, -8, 0] }
                        : step.arrow === 'right'
                          ? { x: [0, 8, 0] }
                          : { y: [0, 8, 0] }
                  }
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="text-2xl text-amber-400"
                >
                  {step.arrow === 'down' && '▼'}
                  {step.arrow === 'down-left' && '↙️'}
                  {step.arrow === 'up' && '▲'}
                  {step.arrow === 'left' && '◀'}
                  {step.arrow === 'right' && '▶'}
                </motion.span>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
