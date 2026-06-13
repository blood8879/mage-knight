import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useUIStore } from '@/store/uiStore'
import { useGameStore } from '@/store/gameStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useTutorialProgress } from '@/hooks/useTutorialProgress'
import { useGameEngine } from '@/hooks/useGameEngine'
import { saveService } from '@/services/saveService'
import TutorialChapterSelect from '@/components/common/TutorialChapterSelect'
import AdBanner from '@/components/ads/AdBanner'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ko', label: '한국어' },
  { code: 'es', label: 'Español' },
] as const

export default function MainMenu() {
  const { t } = useTranslation('ui')
  const navigate = useUIStore((s) => s.navigate)
  const startNewGame = useGameStore((s) => s.startNewGame)
  const startTutorialChapter = useGameStore((s) => s.startTutorialChapter)
  const { language, setLanguage } = useSettingsStore()
  const { isFirstVisit, markFirstVisitDone, completedChapters } = useTutorialProgress()
  const [showChapterSelect, setShowChapterSelect] = useState(false)
  const engine = useGameEngine()
  const [autoSaveInfo, setAutoSaveInfo] = useState<{ round: number; dayNight: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    void saveService.getAutoSaveInfo().then((info) => {
      if (!cancelled) setAutoSaveInfo(info)
    })
    return () => { cancelled = true }
  }, [])

  const handleNewGame = () => {
    startNewGame()
    navigate('game')
  }

  const handleContinue = async () => {
    const loaded = await saveService.loadAutoSave()
    if (!loaded) {
      setAutoSaveInfo(null)
      return
    }
    startNewGame() // clear store flags (tutorial off, game active)
    engine.restoreGame(loaded)
    navigate('game')
  }

  const handleTutorialClick = () => {
    if (isFirstVisit) {
      markFirstVisitDone()
      startTutorialChapter(1)
      navigate('game')
    } else {
      setShowChapterSelect(true)
    }
  }

  const handleSelectChapter = (chapterId: number) => {
    setShowChapterSelect(false)
    startTutorialChapter(chapterId)
    navigate('game')
  }

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-8 overflow-hidden">
      {/* ── Atmospheric backdrop ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {/* drifting hex lattice */}
        <svg
          className="animate-drift absolute -inset-12 h-[calc(100%+6rem)] w-[calc(100%+6rem)] opacity-[0.13]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="mk-hex" width="56" height="97" patternUnits="userSpaceOnUse" patternTransform="scale(1.6)">
              <polygon
                points="28,1 54,16 54,49 28,64 2,49 2,16"
                fill="none"
                stroke="#d4af37"
                strokeWidth="1"
              />
              <polygon
                points="28,66 54,81 54,97 2,97 2,81"
                fill="none"
                stroke="#5b6b8c"
                strokeWidth="0.8"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#mk-hex)" />
        </svg>
        {/* warm hearth glow behind the title + cold rim at edges */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_40%_at_50%_32%,rgba(212,175,55,0.14),transparent_70%)]" />
        <div className="animate-glow-pulse absolute inset-0 bg-[radial-gradient(ellipse_40%_28%_at_50%_30%,rgba(139,92,246,0.12),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_100%_at_50%_50%,transparent_45%,rgba(3,6,14,0.9)_100%)]" />
      </div>

      <div className="relative text-center">
        <div className="font-display mb-3 text-xs tracking-[0.5em] text-slate-500 uppercase">
          ⚔ &nbsp;•&nbsp; 🛡 &nbsp;•&nbsp; ✦
        </div>
        <h1 className="font-display text-gold-foil text-5xl font-bold sm:text-6xl">
          {t('app.title')}
        </h1>
        <p className="font-display mt-3 text-base tracking-[0.25em] text-slate-400 uppercase">
          {t('app.subtitle')}
        </p>
      </div>

      <div className="divider-ornate relative w-72 text-sm">◆</div>

      <nav className="relative flex w-72 flex-col gap-3" aria-label="Main menu">
        {autoSaveInfo && (
          <button
            type="button"
            onClick={() => void handleContinue()}
            aria-label={t('menu.continue', 'Continue')}
            className="btn-fantasy btn-fantasy-gold rounded-lg px-6 py-3.5 text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          >
            {t('menu.continue', 'Continue')}
            <span className="ml-2 text-xs font-normal opacity-80">
              R{autoSaveInfo.round} {autoSaveInfo.dayNight === 'day' ? '☀️' : '🌙'}
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={handleNewGame}
          aria-label={t('menu.newGame', 'New Game')}
          className="btn-fantasy btn-fantasy-primary rounded-lg px-6 py-3.5 text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          {t('menu.newGame', 'New Game')}
        </button>
        <button
          type="button"
          onClick={handleTutorialClick}
          aria-label={t('menu.tutorial', 'Tutorial')}
          className="btn-fantasy rounded-lg px-6 py-3.5 text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          {t('menu.tutorial', 'Tutorial')}
        </button>
        <button
          type="button"
          onClick={() => navigate('settings')}
          aria-label={t('menu.settings')}
          className="btn-fantasy rounded-lg px-6 py-3.5 text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          {t('menu.settings')}
        </button>
      </nav>

      <div className="relative flex gap-2" role="group" aria-label={t('menu.language', 'Language selection')}>
        {LANGUAGES.map((lang) => (
          <button
            type="button"
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            aria-label={lang.label}
            aria-pressed={language === lang.code}
            className={`rounded-full border px-4 py-1.5 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
              language === lang.code
                ? 'border-amber-400/60 bg-amber-500/15 text-amber-200 shadow-[0_0_12px_rgba(212,175,55,0.2)]'
                : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:border-slate-500 hover:text-slate-200'
            }`}
          >
            {lang.label}
          </button>
        ))}
      </div>

      <div className="absolute inset-x-0 bottom-4 flex justify-center">
        <AdBanner slotId="mk-menu-banner" />
      </div>

      {showChapterSelect && (
        <TutorialChapterSelect
          completedChapters={completedChapters}
          onSelectChapter={handleSelectChapter}
          onClose={() => setShowChapterSelect(false)}
        />
      )}
    </div>
  )
}
