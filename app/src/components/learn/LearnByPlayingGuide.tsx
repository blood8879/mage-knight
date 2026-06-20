import { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useSettingsStore } from '@/store/settingsStore'
import { LEARN_STEPS, type LearnContext, type GuideLang } from '@/data/learnGuide'

/** A non-blocking pulsing ring drawn around the UI element matching `selector`. */
function Spotlight({ selector }: { selector: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const el = document.querySelector(selector)
      setRect(el ? el.getBoundingClientRect() : null)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [selector])
  if (!rect || rect.width === 0) return null
  const pad = 6
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-20 rounded-xl"
      style={{
        left: rect.left - pad,
        top: rect.top - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
        boxShadow: '0 0 0 3px rgba(245,158,11,0.9), 0 0 0 9999px rgba(2,6,14,0.35)',
        animation: 'mkLearnPulse 1.4s ease-in-out infinite',
      }}
    />
  )
}

/**
 * Step-by-step teaching companion for "Learn by Playing". It walks the player
 * through the First Reconnaissance opening in order: each step states exactly
 * what to do next, spotlights the relevant UI, and auto-advances (with a short
 * confirmation) once the game state shows it was done. Manual Next/Skip is
 * always available. It never changes game state.
 */
export default function LearnByPlayingGuide({ ctx }: { ctx: LearnContext }) {
  const language = useSettingsStore((s) => s.language)
  const lang: GuideLang = language === 'ko' ? 'ko' : language === 'es' ? 'es' : 'en'

  const [index, setIndex] = useState(0)
  const [collapsed, setCollapsed] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
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

  // Auto-advance an action step once its completion check fires (showing a brief
  // confirmation first).
  useEffect(() => {
    if (step.kind === 'action' && step.done?.(ctx, baseRef.current)) {
      const fb = step.feedback?.[lang]
      if (fb) setFeedback(fb)
      const t = setTimeout(() => {
        setFeedback(null)
        setIndex((i) => Math.min(i + 1, LEARN_STEPS.length - 1))
      }, fb ? 1500 : 250)
      return () => clearTimeout(t)
    }
  }, [ctx, step, lang])

  const advance = () => { setFeedback(null); setIndex((i) => Math.min(i + 1, LEARN_STEPS.length - 1)) }
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
    <>
      {/* Pulsing keyframes (scoped, harmless if duplicated). */}
      <style>{`@keyframes mkLearnPulse{0%,100%{box-shadow:0 0 0 3px rgba(245,158,11,0.55),0 0 0 9999px rgba(2,6,14,0.32)}50%{box-shadow:0 0 0 5px rgba(245,158,11,1),0 0 0 9999px rgba(2,6,14,0.32)}}`}</style>

      {!collapsed && step.spotlight && !feedback && <Spotlight selector={step.spotlight} />}

      <AnimatePresence mode="wait">
        <motion.div
          key={step.id + (feedback ? '-fb' : '')}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.25 } }}
          exit={{ opacity: 0, y: 18, transition: { duration: 0.15 } }}
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
                {feedback ? (
                  <p className="text-[12px] font-semibold leading-relaxed text-emerald-300">{feedback}</p>
                ) : (
                  <>
                    <p className="text-[12px] leading-relaxed text-slate-300">{step.text[lang].body}</p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      {step.kind === 'action'
                        ? <span className="text-[10px] italic text-emerald-400/80">⏳ {waitingHint}</span>
                        : <span />}
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
                  </>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  )
}
