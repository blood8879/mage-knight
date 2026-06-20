import { useState, useRef, useEffect, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useSettingsStore } from '@/store/settingsStore'
import { LEARN_STEPS, LEARN_REACTIVE, type LearnContext, type GuideLang } from '@/data/learnGuide'

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
        left: rect.left - pad, top: rect.top - pad,
        width: rect.width + pad * 2, height: rect.height + pad * 2,
        animation: 'mkLearnPulse 1.4s ease-in-out infinite',
      }}
    />
  )
}

/**
 * Step-by-step teaching companion for "Learn by Playing". An ordered lesson
 * spine guides the opening (with UI spotlights, completion feedback and an
 * optional "Why?"), while just-in-time lessons interrupt once when a special
 * situation first appears (level-up, wounds, swift/fortified enemies, round
 * end). It never changes game state.
 */
export default function LearnByPlayingGuide({ ctx }: { ctx: LearnContext }) {
  const language = useSettingsStore((s) => s.language)
  const lang: GuideLang = language === 'ko' ? 'ko' : language === 'es' ? 'es' : 'en'

  const [index, setIndex] = useState(0)
  const [collapsed, setCollapsed] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [seenReactive, setSeenReactive] = useState<Set<string>>(() => new Set())
  const [activeReactiveId, setActiveReactiveId] = useState<string | null>(null)
  const [showWhy, setShowWhy] = useState(false)
  const baseRef = useRef<LearnContext>(ctx)
  const stepRef = useRef(0)

  const step = LEARN_STEPS[index] ?? LEARN_STEPS[LEARN_STEPS.length - 1]
  const reactive = activeReactiveId ? LEARN_REACTIVE.find((r) => r.id === activeReactiveId) ?? null : null

  // Reset baseline + collapse "why" when the ordered step changes.
  useEffect(() => {
    if (stepRef.current !== index) {
      stepRef.current = index
      baseRef.current = ctx
      setShowWhy(false)
    }
  }, [index, ctx])

  // Raise a just-in-time lesson the first time its situation appears.
  const firing = useMemo(() => {
    return LEARN_REACTIVE
      .filter((r) => !seenReactive.has(r.id) && r.trigger(ctx))
      .sort((a, b) => a.priority - b.priority)[0] ?? null
  }, [ctx, seenReactive])

  useEffect(() => {
    if (firing && !activeReactiveId && !feedback) {
      setActiveReactiveId(firing.id)
      setShowWhy(false)
    }
  }, [firing, activeReactiveId, feedback])

  // Auto-advance an ordered action step once done (showing a brief confirmation).
  useEffect(() => {
    if (activeReactiveId) return // don't advance under an interrupt
    if (step.kind === 'action' && step.done?.(ctx, baseRef.current)) {
      const fb = step.feedback?.[lang]
      if (fb) setFeedback(fb)
      const t = setTimeout(() => {
        setFeedback(null)
        setIndex((i) => Math.min(i + 1, LEARN_STEPS.length - 1))
      }, fb ? 1500 : 250)
      return () => clearTimeout(t)
    }
  }, [ctx, step, lang, activeReactiveId])

  const dismissReactive = () => {
    if (activeReactiveId) setSeenReactive((prev) => new Set(prev).add(activeReactiveId))
    setActiveReactiveId(null)
    setShowWhy(false)
  }
  const advance = () => { setFeedback(null); setShowWhy(false); setIndex((i) => Math.min(i + 1, LEARN_STEPS.length - 1)) }
  const isLast = index >= LEARN_STEPS.length - 1

  if (hidden) {
    return (
      <button type="button" onClick={() => setHidden(false)} aria-label="Open learning guide"
        className="pointer-events-auto absolute left-2 top-16 z-30 flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-slate-900/90 px-3 py-1.5 text-xs font-bold text-amber-300 shadow-lg backdrop-blur-sm transition-colors hover:bg-slate-800">
        📖 <span className="hidden sm:inline">{lang === 'ko' ? '배우기' : lang === 'es' ? 'Guía' : 'Learn'}</span>
      </button>
    )
  }

  // Resolve what to display: a reactive interrupt, otherwise the ordered step.
  const view = reactive
    ? { id: reactive.id, section: reactive.section[lang], title: reactive.text[lang].title, body: reactive.text[lang].body, why: reactive.why?.[lang], spotlight: reactive.spotlight, isReactive: true }
    : { id: step.id, section: step.section[lang], title: step.text[lang].title, body: step.text[lang].body, why: step.why?.[lang], spotlight: step.spotlight, isReactive: false }

  const whyLabel = lang === 'ko' ? '왜?' : lang === 'es' ? '¿Por qué?' : 'Why?'
  const nextLabel = step.kind === 'info' ? (lang === 'ko' ? '다음 ▶' : lang === 'es' ? 'Siguiente ▶' : 'Next ▶')
    : (lang === 'ko' ? '건너뛰기' : lang === 'es' ? 'Saltar' : 'Skip')
  const waitingHint = lang === 'ko' ? '완료하면 자동으로 넘어갑니다…' : lang === 'es' ? 'Avanza solo al completarlo…' : 'Advances on its own when done…'
  const gotIt = lang === 'ko' ? '확인' : lang === 'es' ? 'Entendido' : 'Got it'
  const stepLabel = reactive ? '!' : `${index + 1}/${LEARN_STEPS.length}`

  return (
    <>
      <style>{`@keyframes mkLearnPulse{0%,100%{box-shadow:0 0 0 3px rgba(245,158,11,0.55),0 0 0 9999px rgba(2,6,14,0.32)}50%{box-shadow:0 0 0 5px rgba(245,158,11,1),0 0 0 9999px rgba(2,6,14,0.32)}}`}</style>

      {!collapsed && view.spotlight && !feedback && <Spotlight selector={view.spotlight} />}

      <AnimatePresence mode="wait">
        <motion.div
          key={view.id + (feedback ? '-fb' : '') + (reactive ? '-r' : '')}
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.25 } }} exit={{ opacity: 0, y: 18, transition: { duration: 0.15 } }}
          className="pointer-events-auto absolute left-2 top-16 z-30 w-[min(92vw,22rem)]"
        >
          <div className={['overflow-hidden rounded-xl border bg-slate-900/95 shadow-2xl backdrop-blur-sm', reactive ? 'border-sky-400/50' : 'border-amber-500/40'].join(' ')}>
            <div className={['flex items-center justify-between gap-2 border-b px-3 py-2', reactive ? 'border-sky-400/20 bg-sky-400/10' : 'border-amber-500/20 bg-amber-500/10'].join(' ')}>
              <span className="flex min-w-0 flex-col">
                <span className={['text-[9px] font-bold uppercase tracking-widest', reactive ? 'text-sky-300/80' : 'text-amber-400/70'].join(' ')}>{view.section}</span>
                <span className={['flex items-center gap-1.5 text-sm font-black tracking-wide', reactive ? 'text-sky-200' : 'text-amber-200'].join(' ')}>
                  {reactive ? '💡' : '📖'} <span className="truncate">{view.title}</span>
                </span>
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <span className={['mr-1 font-mono text-[10px]', reactive ? 'text-sky-400/70' : 'text-amber-400/70'].join(' ')}>{stepLabel}</span>
                <button type="button" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Expand' : 'Collapse'}
                  className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:text-slate-200">{collapsed ? '▸' : '▾'}</button>
                <button type="button" onClick={() => setHidden(true)} aria-label="Hide guide"
                  className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:text-red-300">✕</button>
              </div>
            </div>
            {!collapsed && (
              <div className="px-3 py-2.5">
                {feedback && !reactive ? (
                  <p className="text-[12px] font-semibold leading-relaxed text-emerald-300">{feedback}</p>
                ) : (
                  <>
                    <p className="text-[12px] leading-relaxed text-slate-300">{view.body}</p>
                    {view.why && (
                      <div className="mt-2">
                        <button type="button" onClick={() => setShowWhy((w) => !w)}
                          className="text-[10px] font-bold text-sky-300/90 hover:text-sky-200">
                          {showWhy ? '▾ ' : '▸ '}{whyLabel}
                        </button>
                        {showWhy && <p className="mt-1 rounded bg-slate-800/60 px-2 py-1.5 text-[11px] leading-relaxed text-slate-400">{view.why}</p>}
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between gap-2">
                      {reactive ? (
                        <>
                          <span />
                          <button type="button" onClick={dismissReactive}
                            className="shrink-0 rounded-lg bg-sky-600/90 px-3 py-1.5 text-xs font-bold text-slate-950 transition-colors hover:bg-sky-500">{gotIt}</button>
                        </>
                      ) : (
                        <>
                          {step.kind === 'action'
                            ? <span className="text-[10px] italic text-emerald-400/80">⏳ {waitingHint}</span>
                            : <span />}
                          {!isLast ? (
                            <button type="button" onClick={advance}
                              className="shrink-0 rounded-lg bg-amber-600/90 px-3 py-1.5 text-xs font-bold text-slate-950 transition-colors hover:bg-amber-500">{nextLabel}</button>
                          ) : (
                            <button type="button" onClick={() => setHidden(true)}
                              className="shrink-0 rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-bold text-slate-200 transition-colors hover:bg-slate-600">
                              {lang === 'ko' ? '닫기' : lang === 'es' ? 'Cerrar' : 'Close'}
                            </button>
                          )}
                        </>
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
