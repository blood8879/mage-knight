import { useTranslation } from 'react-i18next'
import { useGameStore } from '@/store/gameStore'
import { useGameEngine } from '@/hooks/useGameEngine'
import type { ManaColor, ExtendedManaColor } from '@/engine/types'

const DIE_BG: Record<ExtendedManaColor, string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  white: 'bg-slate-200',
  gold: 'bg-amber-400',
  black: 'bg-neutral-900 ring-1 ring-neutral-500',
}

const TOKEN_BG: Record<string, string> = {
  red: 'bg-red-400',
  blue: 'bg-blue-400',
  green: 'bg-green-400',
  white: 'bg-slate-100',
  gold: 'bg-amber-300',
  black: 'bg-neutral-800 ring-1 ring-neutral-500',
}

const CRYSTAL_COLORS: ManaColor[] = ['red', 'blue', 'green', 'white']

/**
 * Compact horizontal mana pool: Source dice (tap to take), active mana tokens,
 * and crystals (tap to spend as mana). Used inside full-screen overlays
 * (combat tray, interaction panel) where the sidebar ManaPoolDisplay is hidden,
 * so the player can still activate mana mid-combat / mid-interaction.
 */
export default function ManaStrip() {
  const { t } = useTranslation('ui')
  const engine = useGameEngine()
  const mana = useGameStore((s) => s.engineState?.player.mana)
  const dayNight = useGameStore((s) => s.engineState?.dayNight) ?? 'day'
  if (!mana) return null

  const sourceDice = mana.dice.filter((d) => d.isInSource)
  const canTakeMore = !mana.sourceDieTakenThisTurn || (mana.extraSourceDice ?? 0) > 0

  const dieUsable = (color: ExtendedManaColor) =>
    (color !== 'gold' && color !== 'black') ||
    (color === 'gold' && dayNight === 'day') ||
    (color === 'black' && dayNight === 'night')

  return (
    <div data-testid="mana-strip" className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-700/40 bg-slate-900/50 px-2.5 py-1.5">
      <span className="text-[9px] font-bold uppercase tracking-widest text-violet-400/80">
        {t('track.manaSource', 'Source')}
      </span>

      {sourceDice.length === 0 && (
        <span className="text-[10px] italic text-slate-600">{t('track.noDice', { defaultValue: 'No dice' })}</span>
      )}
      {sourceDice.map((die) => {
        const usable = dieUsable(die.color)
        const enabled = usable && canTakeMore
        return (
          <button
            key={`${die.id}-${die.color}`}
            type="button"
            disabled={!enabled}
            onClick={() => engine.takeManaFromSource(die.id)}
            title={
              enabled
                ? t('track.takeDie', { defaultValue: 'Take {{color}} mana die', color: t(`colors.${die.color}`, { defaultValue: die.color }) })
                : !usable
                  ? (die.color === 'gold' ? t('track.goldDayOnly', { defaultValue: 'Gold die — Day only' }) : t('track.blackNightOnly', { defaultValue: 'Black die — Night only' }))
                  : t('track.dieTaken', { defaultValue: 'Already took a die this turn' })
            }
            className={[
              'h-6 w-6 shrink-0 rounded-md transition-transform',
              DIE_BG[die.color] ?? 'bg-slate-600',
              enabled ? 'cursor-pointer hover:scale-110 active:scale-95' : 'cursor-not-allowed opacity-35 grayscale',
            ].join(' ')}
            aria-label={`${t(`colors.${die.color}`, { defaultValue: die.color })} mana die`}
          />
        )
      })}

      {mana.playerMana.length > 0 && (
        <>
          <span className="mx-0.5 h-4 w-px bg-slate-700" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400/80">
            {t('track.activeMana', 'Active')}
          </span>
          {mana.playerMana.map((token, i) => {
            const undoable = token.source === 'crystal' || token.source === 'die'
            const colorName = t(`colors.${token.color}`, { defaultValue: token.color })
            return undoable ? (
              <button
                key={i}
                type="button"
                onClick={() => engine.returnManaToken(i)}
                title={t('track.returnMana', { defaultValue: 'Undo {{color}} mana', color: colorName })}
                aria-label={t('track.returnMana', { defaultValue: 'Undo {{color}} mana', color: colorName })}
                className={`relative h-4 w-4 shrink-0 rounded-full ${TOKEN_BG[token.color] ?? 'bg-slate-500'} shadow transition-transform hover:brightness-110 hover:ring-1 hover:ring-white/60 active:scale-90`}
              >
                <span className="pointer-events-none absolute -right-1 -top-1 text-[8px] leading-none text-slate-300 opacity-0 transition-opacity hover:opacity-100">↩</span>
              </button>
            ) : (
              <span
                key={i}
                className={`h-4 w-4 shrink-0 rounded-full ${TOKEN_BG[token.color] ?? 'bg-slate-500'} shadow`}
                title={colorName}
              />
            )
          })}
        </>
      )}

      {CRYSTAL_COLORS.some((c) => mana.crystals[c] > 0) && (
        <>
          <span className="mx-0.5 h-4 w-px bg-slate-700" />
          <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-violet-400/80">💎</span>
          {CRYSTAL_COLORS.map((color) =>
            mana.crystals[color] > 0 ? (
              <button
                key={color}
                type="button"
                onClick={() => engine.useCrystal(color)}
                title={t('track.spendCrystal', { defaultValue: 'Use {{color}} crystal as mana', color: t(`colors.${color}`, { defaultValue: color }) })}
                className="flex shrink-0 items-center gap-0.5 rounded-full bg-slate-800 px-1.5 py-0.5 transition-transform hover:brightness-125 active:scale-90"
                aria-label={`${t(`colors.${color}`, { defaultValue: color })} crystal`}
              >
                <span className={`h-2.5 w-2.5 rotate-45 rounded-sm ${DIE_BG[color]}`} />
                <span className="text-[10px] font-bold text-slate-300">{mana.crystals[color]}</span>
              </button>
            ) : null,
          )}
        </>
      )}
    </div>
  )
}
