import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { TUTORIAL_CHAPTERS } from '@/engine/TutorialChapters'

// ── Props ────────────────────────────────────
interface TutorialChapterSelectProps {
  completedChapters: number[]
  onSelectChapter: (chapterId: number) => void
  onClose: () => void
}

// ── Chapter card ─────────────────────────────
function ChapterCard({
  chapterId,
  icon,
  titleKey,
  descriptionKey,
  estimatedMinutes,
  isComplete,
  index,
  onSelect,
}: {
  chapterId: number
  icon: string
  titleKey: string
  descriptionKey: string
  estimatedMinutes: number
  isComplete: boolean
  index: number
  onSelect: () => void
}) {
  const { t } = useTranslation('ui')

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.08 * index, ease: 'easeOut' }}
      onClick={onSelect}
      className="group relative flex flex-col items-start gap-3 rounded-2xl border border-slate-700/50 bg-slate-800/70 px-5 py-5 text-left shadow-lg transition-all hover:border-amber-500/40 hover:bg-slate-800 hover:shadow-amber-950/20 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
    >
      {/* Completion badge */}
      {isComplete && (
        <span className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-sm shadow-lg shadow-emerald-900/40">
          ✓
        </span>
      )}

      {/* Icon + title row */}
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900/80 text-2xl ring-1 ring-slate-700/60 transition-colors group-hover:ring-amber-500/30">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-slate-100 group-hover:text-amber-200">
            {t(titleKey, `Chapter ${chapterId}`)}
          </h3>
          <span className="text-[11px] font-medium text-slate-500">
            ~{estimatedMinutes} {t('tutorialChapterSelect.minutes', 'min')}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="line-clamp-2 text-xs leading-relaxed text-slate-400 group-hover:text-slate-300">
        {t(descriptionKey, '')}
      </p>
    </motion.button>
  )
}

// ── Main component ───────────────────────────
export default function TutorialChapterSelect({
  completedChapters,
  onSelectChapter,
  onClose,
}: TutorialChapterSelectProps) {
  const { t } = useTranslation('ui')

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="chapter-select-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[100] flex items-center justify-center"
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm" />

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05, ease: 'easeOut' }}
          className="relative z-10 mx-4 flex w-full max-w-2xl flex-col gap-6 rounded-2xl border border-slate-700/40 bg-slate-900/95 px-6 py-7 shadow-2xl shadow-slate-950/60 sm:px-8 sm:py-8"
        >
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-black tracking-wide text-slate-100">
                {t('tutorialChapterSelect.title', 'Tutorial Chapters')}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {t('tutorialChapterSelect.subtitle', 'Choose a chapter to learn specific mechanics')}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('tutorialChapterSelect.close', 'Close')}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              ✕
            </button>
          </div>

          {/* Chapter grid */}
          <div className="grid max-h-[60vh] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
            {TUTORIAL_CHAPTERS.map((chapter, i) => (
              <ChapterCard
                key={chapter.id}
                chapterId={chapter.id}
                icon={chapter.icon}
                titleKey={chapter.titleKey}
                descriptionKey={chapter.descriptionKey}
                estimatedMinutes={chapter.estimatedMinutes}
                isComplete={completedChapters.includes(chapter.id)}
                index={i}
                onSelect={() => onSelectChapter(chapter.id)}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-slate-800/60 pt-4">
            <span className="text-xs text-slate-600">
              {completedChapters.length}/{TUTORIAL_CHAPTERS.length}{' '}
              {t('tutorialChapterSelect.completed', 'completed')}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-800 px-5 py-2 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              {t('tutorialChapterSelect.back', 'Back to Menu')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
