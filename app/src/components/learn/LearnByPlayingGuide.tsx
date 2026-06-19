import { useState, useMemo, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useSettingsStore } from '@/store/settingsStore'
import { LEARN_TOPICS, type LearnContext, type GuideLang, type GuideTopic } from '@/data/learnGuide'

/**
 * The teaching companion for "Learn by Playing". It watches the live game
 * context and surfaces the relevant walkthrough topic the first time each
 * situation appears, as a dismissable card. A persistent button reopens the
 * last topic. It never changes game state — purely explanatory.
 */
export default function LearnByPlayingGuide({ ctx }: { ctx: LearnContext }) {
  const language = useSettingsStore((s) => s.language)
  const lang: GuideLang = language === 'ko' ? 'ko' : language === 'es' ? 'es' : 'en'

  const [seen, setSeen] = useState<Set<string>>(() => new Set())
  const [current, setCurrent] = useState<GuideTopic | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const lastShownRef = useRef<GuideTopic | null>(null)

  // Pick the highest-priority not-yet-seen topic whose trigger currently fires.
  const candidate = useMemo(() => {
    const firing = LEARN_TOPICS.filter((t) => !seen.has(t.id) && t.trigger(ctx))
    firing.sort((a, b) => a.priority - b.priority)
    return firing[0] ?? null
  }, [ctx, seen])

  useEffect(() => {
    if (candidate && candidate.id !== current?.id) {
      setCurrent(candidate)
      lastShownRef.current = candidate
      setCollapsed(false)
    }
  }, [candidate, current])

  const dismiss = () => {
    if (current) setSeen((prev) => new Set(prev).add(current.id))
    setCurrent(null)
  }

  const reopen = () => {
    const t = lastShownRef.current ?? LEARN_TOPICS[0]
    setCurrent(t)
    setCollapsed(false)
  }

  return (
    <>
      {/* Persistent reopen button (top-left, out of the way of the card tray). */}
      {!current && (
        <button
          type="button"
          onClick={reopen}
          aria-label="Open learning guide"
          className="pointer-events-auto absolute left-2 top-16 z-30 flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-slate-900/90 px-3 py-1.5 text-xs font-bold text-amber-300 shadow-lg backdrop-blur-sm transition-colors hover:bg-slate-800"
        >
          📖 <span className="hidden sm:inline">{lang === 'ko' ? '배우기' : lang === 'es' ? 'Guía' : 'Learn'}</span>
        </button>
      )}

      <AnimatePresence>
        {current && (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.28 } }}
            exit={{ opacity: 0, y: 20, transition: { duration: 0.2 } }}
            className="pointer-events-auto absolute left-2 top-16 z-30 w-[min(92vw,22rem)]"
          >
            <div className="overflow-hidden rounded-xl border border-amber-500/40 bg-slate-900/95 shadow-2xl backdrop-blur-sm">
              <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 bg-amber-500/10 px-3 py-2">
                <span className="flex items-center gap-1.5 text-sm font-black tracking-wide text-amber-200">
                  📖 {current.text[lang].title}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCollapsed((c) => !c)}
                    aria-label={collapsed ? 'Expand' : 'Collapse'}
                    className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:text-slate-200"
                  >
                    {collapsed ? '▸' : '▾'}
                  </button>
                  <button
                    type="button"
                    onClick={dismiss}
                    aria-label="Dismiss tip"
                    className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:text-red-300"
                  >
                    ✕
                  </button>
                </div>
              </div>
              {!collapsed && (
                <div className="px-3 py-2.5">
                  <p className="text-[12px] leading-relaxed text-slate-300">{current.text[lang].body}</p>
                  <button
                    type="button"
                    onClick={dismiss}
                    className="mt-3 w-full rounded-lg bg-amber-600/90 px-3 py-1.5 text-xs font-bold text-slate-950 transition-colors hover:bg-amber-500"
                  >
                    {lang === 'ko' ? '알겠어요' : lang === 'es' ? 'Entendido' : 'Got it'}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
