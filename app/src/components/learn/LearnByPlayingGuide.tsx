import { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useSettingsStore } from '@/store/settingsStore'
import { LEARN_STEPS, type LearnContext, type GuideLang } from '@/data/learnGuide'

/**
 * Step-by-step teaching companion for "Learn by Playing". It walks the player
 * through the First Reconnaissance opening in order: each step states exactly
 * what to do next and auto-advances once the game state shows it was done; a
 * manual "Next" is always available. It never changes game state.
 */
export default function LearnByPlayingGuide({ ctx }: { ctx: LearnContext }) {
  const language = useSettingsStore((s) => s.language)
  const lang: GuideLang = language === 'ko' ? 'ko' : language === 'es' ? 'es' : 'en'

  const [index, setIndex] = useState(0)
  const [collapsed, setCollapsed] = useState(false)
  const [hidden, setHidden] = useState(false)
  // Context snapshot taken when the current step became active (for change checks).
  const baseRef = useRef<LearnContext>(ctx)
  const stepRef = useRef(0)

  const step = LEARN_STEPS[index] ?? LEARN_STEPS[LEARN_STEPS.length - 1]

  // Reset the baseline whenever the active step changes.
  useEffect(() => {
    if (stepRef.current !== index) {
      stepRef.current = index
      baseRef.current = ctx
    }
  }, [index, ctx])

  // Auto-advance an action step once its completion check fires.
  useEffect(() => {
    if (step.kind === 'action' && step.done?.(ctx, baseRef.current)) {
      setIndex((i) => Math.min(i + 1, LEARN_STEPS.length - 1))
    }
  }, [ctx, step])

  const advance = () => setIndex((i) => Math.min(i + 1, LEARN_STEPS.length - 1))
  const isLast = index >= LEARN_STEPS.length - 1

  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => setHidden(false)}
        aria-label="Open learning guide"
        className="pointer-events-auto absolute left-2 top-16 z-30 flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-slate-900/90 px-3 py-1.5 text-xs font-bold text-amber-300 shadow-lg backdrop-blur-sm transition-colors hover:bg-slate-800"
      >
        📖 <span className="hidden sm:inline">{lang === 'ko' ? '배우기' : lang === 'es' ? 'Guía' : 'Learn'}</span>
      </button>
    )
  }

  const nextLabel = step.kind === 'info' ? (lang === 'ko' ? '다음 ▶' : lang === 'es' ? 'Siguiente ▶' : 'Next ▶')
    : (lang === 'ko' ? '건너뛰기' : lang === 'es' ? 'Saltar' : 'Skip')
  const waitingHint = lang === 'ko' ? '완료하면 자동으로 넘어갑니다…' : lang === 'es' ? 'Avanza solo al completarlo…' : 'Advances on its own when done…'
  const stepLabel = `${index + 1}/${LEARN_STEPS.length}`

  return (
    <AnimatePresence>
      <motion.div
        key={step.id}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.28 } }}
        exit={{ opacity: 0, y: 18, transition: { duration: 0.18 } }}
        className="pointer-events-auto absolute left-2 top-16 z-30 w-[min(92vw,22rem)]"
      >
        <div className="overflow-hidden rounded-xl border border-amber-500/40 bg-slate-900/95 shadow-2xl backdrop-blur-sm">
          <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 bg-amber-500/10 px-3 py-2">
            <span className="flex min-w-0 items-center gap-1.5 text-sm font-black tracking-wide text-amber-200">
              📖 <span className="truncate">{step.text[lang].title}</span>
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <span className="mr-1 font-mono text-[10px] text-amber-400/70">{stepLabel}</span>
              <button type="button" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Expand' : 'Collapse'}
                className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:text-slate-200">{collapsed ? '▸' : '▾'}</button>
              <button type="button" onClick={() => setHidden(true)} aria-label="Hide guide"
                className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:text-red-300">✕</button>
            </div>
          </div>
          {!collapsed && (
            <div className="px-3 py-2.5">
              <p className="text-[12px] leading-relaxed text-slate-300">{step.text[lang].body}</p>
              <div className="mt-3 flex items-center justify-between gap-2">
                {step.kind === 'action' && (
                  <span className="text-[10px] italic text-emerald-400/80">⏳ {waitingHint}</span>
                )}
                {step.kind !== 'action' && <span />}
                {!isLast ? (
                  <button type="button" onClick={advance}
                    className="shrink-0 rounded-lg bg-amber-600/90 px-3 py-1.5 text-xs font-bold text-slate-950 transition-colors hover:bg-amber-500">
                    {nextLabel}
                  </button>
                ) : (
                  <button type="button" onClick={() => setHidden(true)}
                    className="shrink-0 rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-bold text-slate-200 transition-colors hover:bg-slate-600">
                    {lang === 'ko' ? '닫기' : lang === 'es' ? 'Cerrar' : 'Close'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
