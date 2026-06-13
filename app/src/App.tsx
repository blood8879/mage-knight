import { lazy, Suspense } from 'react'
import { useUIStore } from '@/store/uiStore'
import MainMenu from '@/screens/MainMenu'
import AudioDirector from '@/components/common/AudioDirector'

const GameScreen = lazy(() => import('@/screens/GameScreen'))
const ScoreScreen = lazy(() => import('@/screens/ScoreScreen'))
const SettingsScreen = lazy(() => import('@/screens/SettingsScreen'))

const SCREENS = {
  main_menu: MainMenu,
  game: GameScreen,
  score: ScoreScreen,
  settings: SettingsScreen,
} as const

function LoadingSpinner() {
  return (
    <div className="flex h-full items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-violet-500" />
        <span className="text-sm text-slate-500">Loading…</span>
      </div>
    </div>
  )
}

export default function App() {
  const currentScreen = useUIStore((s) => s.currentScreen)
  const ScreenComponent = SCREENS[currentScreen]

  return (
    <div className="h-full w-full bg-slate-900">
      <AudioDirector />
      {/* Skip to content link for keyboard/screen-reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-violet-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:outline-none"
      >
        Skip to content
      </a>
      <main id="main-content" role="main" className="h-full">
        <Suspense fallback={<LoadingSpinner />}>
          <ScreenComponent />
        </Suspense>
      </main>
    </div>
  )
}
