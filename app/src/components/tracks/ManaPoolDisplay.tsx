import type { ManaPoolState, ExtendedManaColor, ManaColor, DayNight } from '@/engine/types'

import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'

const DIE_BG: Record<ExtendedManaColor, string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  white: 'bg-slate-200',
  gold: 'bg-amber-400',
  black: 'bg-neutral-900 ring-1 ring-neutral-500',
}

const DIE_GLOW: Record<ExtendedManaColor, string> = {
  red: 'shadow-red-500/40',
  blue: 'shadow-blue-500/40',
  green: 'shadow-green-500/40',
  white: 'shadow-slate-200/30',
  gold: 'shadow-amber-400/40',
  black: 'shadow-neutral-500/20',
}

const CRYSTAL_STYLE: Record<ManaColor, { bg: string; fill: string; text: string; ring: string }> = {
  red: { bg: 'bg-red-500/10', fill: 'bg-red-500', text: 'text-red-400', ring: 'ring-red-500/30' },
  blue: { bg: 'bg-blue-500/10', fill: 'bg-blue-500', text: 'text-blue-400', ring: 'ring-blue-500/30' },
  green: { bg: 'bg-green-500/10', fill: 'bg-green-500', text: 'text-green-400', ring: 'ring-green-500/30' },
  white: { bg: 'bg-slate-200/10', fill: 'bg-slate-200', text: 'text-slate-200', ring: 'ring-slate-200/30' },
}

const MANA_TOKEN_BG: Record<string, string> = {
  red: 'bg-red-400',
  blue: 'bg-blue-400',
  green: 'bg-green-400',
  white: 'bg-slate-100',
  gold: 'bg-amber-300',
  black: 'bg-neutral-800 ring-1 ring-neutral-500',
}

const MANA_TOKEN_GLOW: Record<string, string> = {
  red: 'shadow-[0_0_6px_rgba(248,113,113,0.5)]',
  blue: 'shadow-[0_0_6px_rgba(96,165,250,0.5)]',
  green: 'shadow-[0_0_6px_rgba(74,222,128,0.5)]',
  white: 'shadow-[0_0_6px_rgba(241,245,249,0.4)]',
  gold: 'shadow-[0_0_6px_rgba(252,211,77,0.5)]',
  black: 'shadow-[0_0_4px_rgba(115,115,115,0.3)]',
}

const CRYSTAL_COLORS: ManaColor[] = ['red', 'blue', 'green', 'white']
const MAX_CRYSTALS = 3

interface ManaPoolDisplayProps {
  manaState: ManaPoolState
  dayNight: DayNight
  onDieClick?: (dieId: string) => void
  onCrystalClick?: (color: ManaColor) => void
}

export default function ManaPoolDisplay({
  manaState,
  dayNight,
  onDieClick,
  onCrystalClick,
}: ManaPoolDisplayProps) {
  const { t } = useTranslation('ui')
  const { dice, playerMana, crystals } = manaState

  return (
    <div className="w-full max-w-[240px] space-y-3">
      {/* ── Source dice ──────────── */}
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-400/80">
            {t('track.manaSource', 'Mana Source')}
          </span>
          <span className="text-[9px] font-medium text-slate-500">
            {dayNight === 'day' ? '☀ Day' : '🌙 Night'}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {dice.map((die) => {
            const isGoldBlackUsable =
              (die.color === 'gold' && dayNight === 'day') ||
              (die.color === 'black' && dayNight === 'night')
            const isBasicColor = die.color !== 'gold' && die.color !== 'black'
            const isUsable = die.isInSource && (isBasicColor || isGoldBlackUsable)

            return (
              <motion.button
                key={`${die.id}-${die.color}`}
                initial={{ rotate: -180, scale: 0.4, opacity: 0 }}
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 14, stiffness: 260 }}
                type="button"
                disabled={!die.isInSource}
                onClick={() => onDieClick?.(die.id)}
                className={[
                  'flex h-7 w-7 items-center justify-center rounded-md border transition-all duration-200',
                  die.isInSource
                    ? [
                        DIE_BG[die.color],
                        'border-transparent shadow-md',
                        DIE_GLOW[die.color],
                        isUsable
                          ? 'cursor-pointer hover:scale-110 hover:brightness-110 active:scale-95'
                          : 'cursor-not-allowed opacity-40 grayscale',
                      ].join(' ')
                    : 'cursor-not-allowed border-dashed border-slate-700 bg-slate-800/30 opacity-30',
                ].join(' ')}
                title={
                  die.isInSource
                    ? isUsable
                      ? `${die.color} mana die`
                      : die.color === 'gold'
                        ? 'Gold die — only usable during Day'
                        : 'Black die — only usable during Night'
                    : `${die.color} die (taken)`
                }
              >
                {die.isInSource && (
                  isUsable ? (
                    <svg viewBox="0 0 10 10" className="h-3 w-3 opacity-40">
                      <circle cx="5" cy="5" r="1.5" fill="currentColor" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 16 16" className="h-3 w-3 text-slate-400 opacity-70">
                      <path d="M8 1a4 4 0 0 0-4 4v2H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-1V5a4 4 0 0 0-4-4zm2 6H6V5a2 2 0 1 1 4 0v2z" fill="currentColor"/>
                    </svg>
                  )
                )}
              </motion.button>
            )
          })}
          {dice.length === 0 && (
            <span className="text-xs italic text-slate-600">{t('track.noDice', { defaultValue: 'No dice' })}</span>
          )}
        </div>
      </div>

      {/* ── Player mana tokens ──── */}
      {playerMana.length > 0 && (
        <div>
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-violet-400/80">
            {t('track.activeMana', 'Active Mana')}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {playerMana.map((token, idx) => (
              <div
                key={idx}
                className={[
                  'h-5 w-5 rounded-full',
                  MANA_TOKEN_BG[token.color] ?? 'bg-slate-500',
                  MANA_TOKEN_GLOW[token.color] ?? '',
                  'animate-pulse',
                ].join(' ')}
                title={`${token.color} mana (from ${token.source})`}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Crystal inventory ───── */}
      <div data-tutorial="crystal-inventory">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-400/80">
            💎 {t('track.crystalInventory', 'Crystal Inventory')}
          </span>
          <span className="text-[9px] font-medium text-slate-500">
            {t('track.crystalMax', { defaultValue: 'max {{max}} each', max: MAX_CRYSTALS })}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {CRYSTAL_COLORS.map((color) => {
            const style = CRYSTAL_STYLE[color]
            const count = crystals[color]
            return (
              <button
                key={color}
                type="button"
                disabled={count <= 0}
                onClick={() => onCrystalClick?.(color)}
                className={[
                  'flex flex-col items-center gap-1 rounded-lg px-1.5 py-1.5 ring-1 transition-all duration-200',
                  style.bg,
                  style.ring,
                  count > 0
                    ? 'cursor-pointer hover:brightness-125 active:scale-95'
                    : 'cursor-not-allowed opacity-40',
                ].join(' ')}
                title={`${t(`mana.${color}`, color)}: ${count}/${MAX_CRYSTALS}`}
              >
                <div className="flex gap-0.5">
                  {Array.from({ length: MAX_CRYSTALS }).map((_, i) => (
                    <div
                      key={i}
                      className={[
                        'h-2 w-2 rotate-45 rounded-sm transition-all duration-200',
                        i < count
                          ? `${style.fill} shadow-sm`
                          : 'bg-slate-700/50',
                      ].join(' ')}
                    />
                  ))}
                </div>
                <motion.span
                  key={count}
                  initial={{ scale: count > 0 ? 1.6 : 1 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 300 }}
                  className={`text-[9px] font-bold ${style.text}`}
                >
                  {count}
                </motion.span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
