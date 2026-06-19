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
import { PLAYABLE_HEROES } from '@/data/loader'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ko', label: '한국어' },
  { code: 'es', label: 'Español' },
] as const

const HERO_INFO: Record<string, { ring: string; dot: string }> = {
  Arythea: { ring: 'hover:border-red-400/60 focus-visible:ring-red-400', dot: 'bg-red-500' },
  Tovak: { ring: 'hover:border-blue-400/60 focus-visible:ring-blue-400', dot: 'bg-blue-500' },
  Goldyx: { ring: 'hover:border-emerald-400/60 focus-visible:ring-emerald-400', dot: 'bg-emerald-500' },
  Norowas: { ring: 'hover:border-slate-300/60 focus-visible:ring-slate-300', dot: 'bg-slate-200' },
}

export default function MainMenu() {
  const { t } = useTranslation('ui')
  const navigate = useUIStore((s) => s.navigate)
  const startNewGame = useGameStore((s) => s.startNewGame)
  const startLearnGame = useGameStore((s) => s.startLearnGame)
  const startTutorialChapter = useGameStore((s) => s.startTutorialChapter)
  const { language, setLanguage } = useSettingsStore()
  const { isFirstVisit, markFirstVisitDone, completedChapters } = useTutorialProgress()
  const [showChapterSelect, setShowChapterSelect] = useState(false)
  const [showHeroSelect, setShowHeroSelect] = useState(false)
  // Whether the hero picker is for a normal game or a Learn-by-Playing game.
  const [heroSelectFor, setHeroSelectFor] = useState<'new' | 'learn'>('new')
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
    setHeroSelectFor('new')
    setShowHeroSelect(true)
  }

  const handleLearnGame = () => {
    setHeroSelectFor('learn')
    setShowHeroSelect(true)
  }

  const handleSelectHero = (hero: string) => {
    setShowHeroSelect(false)
    if (heroSelectFor === 'learn') startLearnGame(hero)
    else startNewGame(hero)
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
          onClick={handleLearnGame}
          aria-label={t('menu.learnByPlaying', 'Learn by Playing')}
          className="btn-fantasy rounded-lg px-6 py-3.5 text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          {t('menu.learnByPlaying', 'Learn by Playing')}
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

      {showHeroSelect && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4"
          onClick={() => setShowHeroSelect(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-700/60 bg-slate-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-center text-lg font-black tracking-wide text-amber-300">
              {t('hero.selectTitle', 'Choose your hero')}
            </h2>
            <p className="mb-4 text-center text-xs text-slate-500">
              {t('hero.selectSubtitle', 'Each hero has a unique starting card and skill set.')}
            </p>
            <div className="grid grid-cols-1 gap-2">
              {PLAYABLE_HEROES.map((hero) => {
                const info = HERO_INFO[hero]
                return (
                  <button
                    key={hero}
                    type="button"
                    onClick={() => handleSelectHero(hero)}
                    className={`flex items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-800/60 px-4 py-3 text-left transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 ${info.ring}`}
                  >
                    <span className={`h-3 w-3 shrink-0 rounded-full ${info.dot}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-slate-100">
                        {t(`hero.${hero.toLowerCase()}`, { defaultValue: hero })}
                      </span>
                      <span className="block text-[11px] leading-snug text-slate-500">
                        {t(`hero.${hero.toLowerCase()}Tag`, { defaultValue: '' })}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => setShowHeroSelect(false)}
              className="mt-4 w-full rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-600 active:scale-95"
            >
              {t('game.cancel', 'Cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
