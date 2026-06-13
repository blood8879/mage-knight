import { useTranslation } from 'react-i18next'
import { useUIStore } from '@/store/uiStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useTheme } from '@/hooks/useTheme'

const LANGUAGES = [
  { code: 'en', flag: '\uD83C\uDDFA\uD83C\uDDF8', native: 'English', english: 'English' },
  { code: 'ko', flag: '\uD83C\uDDF0\uD83C\uDDF7', native: '\uD55C\uAD6D\uC5B4', english: 'Korean' },
  { code: 'es', flag: '\uD83C\uDDEA\uD83C\uDDF8', native: 'Espa\u00F1ol', english: 'Spanish' },
] as const

export default function SettingsScreen() {
  const { t } = useTranslation('ui')
  const navigate = useUIStore((s) => s.navigate)
  const {
    language,
    soundEnabled,
    musicEnabled,
    animationsEnabled,
    setLanguage,
    toggleSound,
    toggleMusic,
    toggleAnimations,
  } = useSettingsStore()

  const { theme, toggleTheme } = useTheme()

  return (
    <>
      <div className="flex h-full flex-col items-center justify-center gap-8">
        <h1 className="font-display text-3xl font-bold text-white">{t('menu.settings')}</h1>

        <div className="w-96 space-y-6">
          <section>
            <label className="mb-3 block text-xs font-semibold uppercase tracking-widest text-slate-500">
              {t('menu.language')}
            </label>
            <div className="flex flex-col gap-1.5">
              {LANGUAGES.map((lang) => {
                const isActive = language === lang.code
                return (
                  <button
                    type="button"
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    aria-label={`${lang.native} (${lang.english})`}
                    aria-pressed={language === lang.code}
                    className={[
                      'flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all',
                      isActive
                        ? 'bg-violet-600/15 ring-1 ring-violet-500/40'
                        : 'bg-slate-800/60 hover:bg-slate-800 ring-1 ring-slate-700/40 hover:ring-slate-600/50',
                    ].join(' ')}
                  >
                    <span className="text-xl leading-none">{lang.flag}</span>
                    <span className="flex-1">
                      <span
                        className={[
                          'block text-sm font-semibold',
                          isActive ? 'text-violet-300' : 'text-slate-200',
                        ].join(' ')}
                      >
                        {lang.native}
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        {lang.english}
                      </span>
                    </span>
                    {isActive && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="h-3.5 w-3.5 text-white"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>

          <section>
            <label className="mb-3 block text-xs font-semibold uppercase tracking-widest text-slate-500">
              {t('settings.theme', 'Theme')}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={theme === 'dark' ? undefined : toggleTheme}
                aria-pressed={theme === 'dark'}
                aria-label={t('settings.dark', 'Dark')}
                className={[
                  'flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400',
                  theme === 'dark'
                    ? 'bg-slate-700 text-white ring-1 ring-violet-500/40'
                    : 'bg-slate-800/60 text-slate-400 ring-1 ring-slate-700/40 hover:bg-slate-800 hover:text-slate-200',
                ].join(' ')}
              >
                <span className="text-base">{'\uD83C\uDF19'}</span>
                {t('settings.dark', 'Dark')}
              </button>
              <button
                type="button"
                onClick={theme === 'light' ? undefined : toggleTheme}
                aria-pressed={theme === 'light'}
                aria-label={t('settings.light', 'Light')}
                className={[
                  'flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400',
                  theme === 'light'
                    ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-400/50'
                    : 'bg-slate-800/60 text-slate-400 ring-1 ring-slate-700/40 hover:bg-slate-800 hover:text-slate-200',
                ].join(' ')}
              >
                <span className="text-base">{'\u2600\uFE0F'}</span>
                {t('settings.light', 'Light')}
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">
              {t('settings.general', 'General')}
            </label>
            <ToggleRow
              label={t('settings.sound', 'Sound Effects')}
              enabled={soundEnabled}
              onToggle={toggleSound}
            />
            <ToggleRow
              label={t('settings.music', 'Music')}
              enabled={musicEnabled}
              onToggle={toggleMusic}
            />
            <ToggleRow
              label={t('settings.animations', 'Animations')}
              enabled={animationsEnabled}
              onToggle={toggleAnimations}
            />
          </section>

          <section>
            <button
              type="button"
              onClick={() => navigate('main_menu')}
              aria-label={t('settings.showTutorial', 'Show Tutorial')}
              className="w-full rounded-xl bg-slate-800/60 px-4 py-3 text-sm font-semibold text-slate-300 ring-1 ring-slate-700/40 transition-all hover:bg-slate-800 hover:text-white hover:ring-slate-600/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              {t('settings.showTutorial', 'Show Tutorial')}
            </button>
          </section>
        </div>

        <button
          type="button"
          onClick={() => navigate('main_menu')}
          aria-label={t('menu.back', 'Back')}
          className="rounded-lg bg-slate-700 px-6 py-3 font-semibold text-white transition-colors hover:bg-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          {t('menu.back', 'Back')}
        </button>
      </div>

    </>
  )
}

function ToggleRow({
  label,
  enabled,
  onToggle,
}: {
  label: string
  enabled: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-300">{label}</span>
      <button
        type="button"
        onClick={onToggle}
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        className={`h-6 w-11 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
          enabled ? 'bg-violet-600' : 'bg-slate-600'
        }`}
      >
        <span
          className={`block h-5 w-5 rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-5.5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}
