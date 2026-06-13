import { useTranslation } from 'react-i18next'
import { useGameStore } from '@/store/gameStore'
import { useUIStore } from '@/store/uiStore'
import type { ExtendedManaColor, ManaColor, GamePhase } from '@/engine/types'
import { canActivateTactic } from '@/engine/TacticEffectManager'

type TacticAction = 'right_moment' | 'long_night' | 'midnight_meditation' | 'sparing_power_store' | 'sparing_power_retrieve' | 'mana_steal_use' | 'mana_search'

interface TopBarProps {
  onEndTurn?: () => void
  onRest?: (type: 'standard' | 'slow_recovery') => void
  onDeclareEndOfRound?: () => void
  onUndo?: () => void
  canUndo?: boolean
  onActivateTactic?: (action: TacticAction, options?: {
    midnightMeditationCardIndices?: number[]
    manaSearchDieIds?: string[]
  }) => void
  onMeditationSelect?: () => void
}

// ── Mana die color mapping ───────────────
const MANA_DIE_BG: Record<ExtendedManaColor, string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  white: 'bg-slate-200',
  gold: 'bg-amber-400',
  black: 'bg-neutral-900 ring-1 ring-neutral-600',
}

const CRYSTAL_COLORS: Record<ManaColor, { bg: string; text: string; glow: string }> = {
  red: { bg: 'bg-red-500/20', text: 'text-red-400', glow: 'shadow-red-500/30' },
  blue: { bg: 'bg-blue-500/20', text: 'text-blue-400', glow: 'shadow-blue-500/30' },
  green: { bg: 'bg-green-500/20', text: 'text-green-400', glow: 'shadow-green-500/30' },
  white: { bg: 'bg-slate-200/20', text: 'text-slate-200', glow: 'shadow-slate-200/30' },
}

const PLAYER_TURN_PHASES: ReadonlySet<GamePhase> = new Set([
  'player_turn_start',
  'movement',
  'action_declaration',
  'interaction',
  'combat_ranged_siege',
  'combat_block',
  'combat_assign_damage',
  'combat_attack',
  'combat_end',
  'level_up',
  'end_of_turn',
])

function phaseName(phase: GamePhase, t: (key: string, defaultValue: string) => string): string {
  return t(`game.phase.${phase}`, phase)
}

export default function TopBar({ onEndTurn, onRest, onDeclareEndOfRound, onUndo, canUndo, onActivateTactic, onMeditationSelect }: TopBarProps) {
  const { t } = useTranslation('ui')
  const { t: tTactics } = useTranslation('tactics')
  const { round, dayNight, fame, reputation, level, armor, phase, engineState } =
    useGameStore()
  const openModal = useUIStore((s) => s.openModal)

  const isPlayerTurn = PLAYER_TURN_PHASES.has(phase)

  const manaDice = engineState?.player.mana.dice.filter((d) => d.isInSource) ?? []
  const crystals = engineState?.player.mana.crystals ?? { red: 0, blue: 0, green: 0, white: 0 }

  const currentTactic = engineState?.player.currentTactic ?? null
  const tacticActions = canActivateTactic(currentTactic)
  const deckEmpty = engineState?.player.deck.drawPile.length === 0

  return (
    <header className="flex shrink-0 flex-col border-b border-amber-500/15 bg-gradient-to-b from-slate-800/90 to-slate-900 shadow-[0_2px_12px_rgba(0,0,0,0.4)] sm:flex-row sm:flex-wrap sm:items-center sm:gap-0">
      <div className="flex flex-1 items-center gap-1.5 px-2 py-1.5 sm:gap-3 sm:px-4 sm:py-2">
        <button
          onClick={() => openModal('settings')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-700/60 hover:text-slate-100 sm:h-8 sm:w-8"
          aria-label={t('game.menu', 'Menu')}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-5 w-5"
          >
            <path
              fillRule="evenodd"
              d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 5A.75.75 0 0 1 2.75 9h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 9.75Zm0 5a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        <div className="flex min-w-0 shrink items-center gap-2 overflow-x-auto text-xs sm:text-sm">
          <span className="whitespace-nowrap font-medium text-slate-400">
            {t('game.round', 'Round')} {round}
          </span>

          <span
            className={`whitespace-nowrap font-semibold ${
              dayNight === 'day'
                ? 'text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.4)]'
                : 'text-indigo-300 drop-shadow-[0_0_4px_rgba(165,180,252,0.4)]'
            }`}
          >
            {dayNight === 'day' ? '☀️' : '🌙'}{' '}
            {dayNight === 'day' ? t('game.day', 'Day') : t('game.night', 'Night')}
          </span>

          <span className="hidden whitespace-nowrap text-slate-500 sm:inline">
            — {phaseName(phase, t)}
          </span>

          {currentTactic && (
            <span className="hidden whitespace-nowrap text-xs text-purple-400 sm:inline">
              [{tTactics(`${currentTactic.id}.name`, { defaultValue: currentTactic.name })}{currentTactic.isUsed ? ' ✓' : ''}]
            </span>
          )}
        </div>

        <div className="flex-1" />

        <div data-tutorial="stats" className="flex min-w-0 shrink items-center gap-1.5 overflow-x-auto sm:shrink-0 sm:gap-3 sm:overflow-visible">
          <div className="flex items-center gap-1 text-xs" title={t('game.fame', 'Fame')}>
            <span className="text-yellow-500">★</span>
            <span className="font-mono font-semibold text-yellow-400">{fame}</span>
          </div>

          <div className="flex items-center gap-1 text-xs" title={t('game.reputation', 'Reputation')}>
            <span className="text-cyan-500">♦</span>
            <span className="font-mono font-semibold text-cyan-400">{reputation}</span>
          </div>

          <div className="flex items-center gap-1 text-xs" title={t('game.level', 'Level')}>
            <span className="text-emerald-500">▲</span>
            <span className="font-mono font-semibold text-emerald-400">{level}</span>
          </div>

          <div className="flex items-center gap-1 text-xs" title={t('game.armor', 'Armor')}>
            <span className="text-slate-400">🛡</span>
            <span className="font-mono font-semibold text-slate-300">{armor}</span>
          </div>

          <div className="hidden h-5 w-px bg-slate-700 sm:block" />

          <div data-tutorial="mana-source" className="hidden items-center gap-1 sm:flex" title={t('game.manaSource', 'Mana Source')}>
            {manaDice.length > 0 ? (
              manaDice.map((die) => (
                <div
                  key={die.id}
                  className={`h-4 w-4 rounded-sm ${MANA_DIE_BG[die.color]} shadow-sm`}
                />
              ))
            ) : (
              <span className="text-xs text-slate-600">—</span>
            )}
          </div>

          <div className="hidden h-5 w-px bg-slate-700 sm:block" />

          <div data-tutorial="crystals" className="hidden items-center gap-1 sm:flex">
            {(['red', 'blue', 'green', 'white'] as const).map((color) => {
              const c = CRYSTAL_COLORS[color]
              const count = crystals[color]
              return (
                <div
                  key={color}
                  className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 ${c.bg} shadow-sm ${c.glow}`}
                >
                  <div className={`h-2.5 w-2.5 rounded-full ${MANA_DIE_BG[color]}`} />
                  <span className={`text-[10px] font-bold ${c.text}`}>{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {(isPlayerTurn || phase === 'player_turn_start') && (
        <div className="flex items-center gap-1 overflow-x-auto border-t border-slate-800 py-1 sm:gap-1.5 sm:overflow-visible sm:border-t-0 sm:py-2 sm:pr-4" style={{paddingLeft: 8, paddingRight: 8}}>
          {phase === 'player_turn_start' && (
            <>
              <button
                data-tutorial="rest"
                onClick={() => onRest?.('standard')}
                className="min-h-[44px] min-w-[44px] shrink-0 rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-emerald-100 shadow transition-colors hover:bg-emerald-600 active:bg-emerald-800 sm:min-h-0 sm:min-w-0 sm:px-2.5 sm:py-1 sm:text-xs"
                title={t('game.restStandard', 'Rest: discard non-wounds, heal 1 wound')}
              >
                {t('game.rest', 'Rest')}
              </button>
              <button
                data-tutorial="end-round"
                onClick={() => onDeclareEndOfRound?.()}
                className="min-h-[44px] shrink-0 rounded-md bg-amber-700 px-3 py-2 text-xs font-semibold text-amber-100 shadow transition-colors hover:bg-amber-600 active:bg-amber-800 sm:min-h-0 sm:px-2.5 sm:py-1 sm:text-xs"
                title={t('game.declareEndOfRound', 'Declare end of round')}
              >
                {t('game.endRound', 'End Round')}
              </button>
            </>
          )}

          {isPlayerTurn && onActivateTactic && tacticActions.manaStealUse && (
            <button
              onClick={() => onActivateTactic('mana_steal_use')}
              className="min-h-[44px] shrink-0 rounded-md bg-purple-700 px-3 py-2 text-xs font-semibold text-purple-100 shadow transition-colors hover:bg-purple-600 active:bg-purple-800 sm:min-h-0 sm:px-2.5 sm:py-1 sm:text-xs"
            >
              {t('game.tacticManaSteal', 'Mana Steal')}
            </button>
          )}

          {isPlayerTurn && onActivateTactic && tacticActions.manaSearch && (
            <button
              onClick={() => onActivateTactic('mana_search')}
              className="min-h-[44px] shrink-0 rounded-md bg-blue-700 px-3 py-2 text-xs font-semibold text-blue-100 shadow transition-colors hover:bg-blue-600 active:bg-blue-800 sm:min-h-0 sm:px-2.5 sm:py-1 sm:text-xs"
            >
              {t('game.tacticManaSearch', 'Mana Search')}
            </button>
          )}

          {isPlayerTurn && onActivateTactic && tacticActions.rightMoment && (
            <button
              onClick={() => onActivateTactic('right_moment')}
              className="min-h-[44px] shrink-0 rounded-md bg-orange-700 px-3 py-2 text-xs font-semibold text-orange-100 shadow transition-colors hover:bg-orange-600 active:bg-orange-800 sm:min-h-0 sm:px-2.5 sm:py-1 sm:text-xs"
            >
              {t('game.tacticRightMoment', 'Extra Turn')}
            </button>
          )}

          {isPlayerTurn && onActivateTactic && tacticActions.longNight && deckEmpty && (
            <button
              onClick={() => onActivateTactic('long_night')}
              className="min-h-[44px] shrink-0 rounded-md bg-indigo-700 px-3 py-2 text-xs font-semibold text-indigo-100 shadow transition-colors hover:bg-indigo-600 active:bg-indigo-800 sm:min-h-0 sm:px-2.5 sm:py-1 sm:text-xs"
            >
              {t('game.tacticLongNight', 'Long Night')}
            </button>
          )}

          {isPlayerTurn && tacticActions.midnightMeditation && onMeditationSelect && (
            <button
              onClick={onMeditationSelect}
              className="min-h-[44px] shrink-0 rounded-md bg-teal-700 px-3 py-2 text-xs font-semibold text-teal-100 shadow transition-colors hover:bg-teal-600 active:bg-teal-800 sm:min-h-0 sm:px-2.5 sm:py-1 sm:text-xs"
            >
              {t('game.tacticMidnightMeditation', 'Meditation')}
            </button>
          )}

          {isPlayerTurn && onActivateTactic && tacticActions.sparingPowerStore && (
            <button
              onClick={() => onActivateTactic('sparing_power_store')}
              className="min-h-[44px] shrink-0 rounded-md bg-cyan-700 px-3 py-2 text-xs font-semibold text-cyan-100 shadow transition-colors hover:bg-cyan-600 active:bg-cyan-800 sm:min-h-0 sm:px-2.5 sm:py-1 sm:text-xs"
            >
              {t('game.tacticSparingStore', 'Store Card')}
            </button>
          )}

          {isPlayerTurn && onActivateTactic && tacticActions.sparingPowerRetrieve && (
            <button
              onClick={() => onActivateTactic('sparing_power_retrieve')}
              className="min-h-[44px] shrink-0 rounded-md bg-cyan-600 px-3 py-2 text-xs font-semibold text-cyan-100 shadow transition-colors hover:bg-cyan-500 active:bg-cyan-700 sm:min-h-0 sm:px-2.5 sm:py-1 sm:text-xs"
            >
              {t('game.tacticSparingRetrieve', 'Get Cards')}
            </button>
          )}

          <div className="min-w-2 flex-1" />

          {isPlayerTurn && onUndo && (
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={[
                'min-h-[44px] shrink-0 rounded-md px-3 py-2 text-xs font-semibold shadow transition-colors sm:min-h-0 sm:px-2.5 sm:py-1 sm:text-sm',
                canUndo
                  ? 'bg-slate-700 text-slate-200 hover:bg-slate-600 active:bg-slate-800'
                  : 'cursor-not-allowed bg-slate-800 text-slate-600',
              ].join(' ')}
              title={t('game.undo', 'Undo')}
            >
              {'\u21A9'} {t('game.undo', 'Undo')}
            </button>
          )}

          {isPlayerTurn && (
            <button
              data-tutorial="end-turn"
              onClick={onEndTurn}
              className="min-h-[44px] shrink-0 rounded-md bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-violet-900/30 transition-colors hover:bg-violet-500 active:bg-violet-700 sm:min-h-0 sm:px-3 sm:py-1 sm:text-sm"
            >
              {t('game.endTurn', 'End Turn')}
            </button>
          )}
        </div>
      )}
    </header>
  )
}
