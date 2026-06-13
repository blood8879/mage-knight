import { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { HexCell, DayNight, TerrainType, SiteType, EnemyColor, EnemyToken } from '@/engine/types'
import { TERRAIN_MOVE_COST } from '@/engine/GameState'

// ── Terrain emoji icons ──────────────────
const TERRAIN_EMOJI: Record<TerrainType, string> = {
  plains: '\u{1F33E}',
  hills: '\u26F0\uFE0F',
  forest: '\u{1F332}',
  wasteland: '\u{1F3DC}\uFE0F',
  desert: '\u2600\uFE0F',
  swamp: '\u{1F33F}',
  lake: '\u{1F30A}',
  mountain: '\u{1F3D4}\uFE0F',
  sea: '\u{1F30A}',
  city: '\u{1F3D9}\uFE0F',
}

// ── Site type to translation index ───────
const SITE_INDEX_MAP: Record<SiteType, number> = {
  village: 1,
  monastery: 2,
  keep: 3,
  mageTower: 4,
  dungeon: 5,
  tomb: 6,
  ancientRuins: 7,
  monsterDen: 8,
  spawningGrounds: 9,
  crystalMine: 10,
  magicalGlade: 11,
  city: 12,
  portal: 13,
}

// ── Site emoji icons ─────────────────────
const SITE_EMOJI: Record<SiteType, string> = {
  village: '\u{1F3D8}',
  monastery: '\u26EA',
  keep: '\u{1F3F0}',
  mageTower: '\u{1F52E}',
  dungeon: '\u{1F573}',
  tomb: '\u26B0',
  ancientRuins: '\u{1F3DA}',
  monsterDen: '\u{1F479}',
  spawningGrounds: '\u{1F409}',
  crystalMine: '\u26CF',
  magicalGlade: '\u{1F33F}',
  city: '\u{1F3D9}',
  portal: '\u{1F300}',
}

// ── Enemy dot colors ─────────────────────
const ENEMY_DOT_COLOR: Record<EnemyColor, string> = {
  green: '#22c55e',
  grey: '#9ca3af',
  violet: '#a78bfa',
  brown: '#a16207',
  red: '#ef4444',
  white: '#e2e8f0',
}

// ── Attack type indicators ───────────────
const ATTACK_TYPE_ICON: Record<string, string> = {
  fire: '\u{1F525}',
  ice: '\u2744\uFE0F',
  summon: '\u{1F47B}',
}

// ── Impassable terrains ──────────────────
const IMPASSABLE_TERRAINS: ReadonlySet<TerrainType> = new Set(['lake', 'mountain', 'sea'])

interface TileInfoPopupProps {
  cell: HexCell | null
  onClose: () => void
  dayNight: DayNight
}

// ── Animation variants ───────────────────

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

// Desktop: centered modal
const desktopPanelVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 16 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring' as const, damping: 28, stiffness: 360 },
  },
  exit: { opacity: 0, scale: 0.95, y: 8, transition: { duration: 0.15 } },
}

// Mobile: bottom sheet
const mobilePanelVariants = {
  hidden: { y: '100%', opacity: 0.8 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring' as const, damping: 30, stiffness: 320 },
  },
  exit: { y: '100%', opacity: 0, transition: { duration: 0.2 } },
}

// ── Subcomponents ────────────────────────

function TerrainSection({
  cell,
  dayNight,
  t,
}: {
  cell: HexCell
  dayNight: DayNight
  t: (key: string, options?: { defaultValue: string }) => string
}) {
  const cost = TERRAIN_MOVE_COST[cell.terrain]
  const isImpassable = IMPASSABLE_TERRAINS.has(cell.terrain)

  return (
    <div className="space-y-2.5">
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
        {t('game.tileInfoTerrain', { defaultValue: 'Terrain' })}
      </h3>

      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-700/50 text-xl">
          {TERRAIN_EMOJI[cell.terrain]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-200">
            {t(`game.terrain.${cell.terrain}`, { defaultValue: cell.terrain })}
          </p>

          {isImpassable ? (
            <span className="mt-0.5 inline-block rounded-md bg-red-500/15 px-2 py-0.5 text-[11px] font-bold tracking-wide text-red-400 ring-1 ring-red-500/25">
              {t('game.tileInfoImpassable', { defaultValue: 'Impassable' })}
            </span>
          ) : cost ? (
            <p className="mt-0.5 text-xs text-slate-400">
              <span className="text-slate-500">{t('game.tileInfoMoveCost', { defaultValue: 'Move Cost' })}:</span>{' '}
              <span className={dayNight === 'day' ? 'font-bold text-amber-400' : 'text-slate-400'}>
                {t('game.tileInfoDay', { defaultValue: 'Day' })} {cost.day}
              </span>
              <span className="mx-1.5 text-slate-600">/</span>
              <span className={dayNight === 'night' ? 'font-bold text-indigo-400' : 'text-slate-400'}>
                {t('game.tileInfoNight', { defaultValue: 'Night' })} {cost.night}
              </span>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function SiteSection({
  cell,
  tSites,
  t,
}: {
  cell: HexCell
  tSites: (key: string, options?: { defaultValue: string }) => string
  t: (key: string, options?: { defaultValue: string }) => string
}) {
  if (!cell.site) return null

  const siteIdx = SITE_INDEX_MAP[cell.site]
  const siteName = tSites(`${siteIdx}.name`, { defaultValue: cell.site })
  const siteDesc = tSites(`${siteIdx}.description`, { defaultValue: '' })
  const isConquered = cell.siteData?.isConquered === true

  return (
    <div className="space-y-2.5">
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
        {t('game.tileInfoSite', { defaultValue: 'Site' })}
      </h3>

      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-700/50 text-xl">
          {SITE_EMOJI[cell.site]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-200">{siteName}</p>
            {isConquered && (
              <span className="inline-block rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold tracking-wide text-emerald-400 ring-1 ring-emerald-500/25">
                {t('game.tileInfoConquered', { defaultValue: 'Conquered' })}
              </span>
            )}
          </div>
          {siteDesc && (
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{siteDesc}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function EnemyCard({
  token,
  tEnemies,
  t,
}: {
  token: EnemyToken
  tEnemies: (key: string, options?: { defaultValue: string }) => string
  t: (key: string, options?: { defaultValue: string }) => string
}) {
  const enemyName = tEnemies(`${token.id}.name`, { defaultValue: token.name })
  const enemyAbilities = tEnemies(`${token.id}.abilities`, { defaultValue: '' })
  const dotColor = ENEMY_DOT_COLOR[token.color]
  const attackIcon = token.attackType !== 'normal' ? ATTACK_TYPE_ICON[token.attackType] : null

  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-slate-700/40 bg-slate-800/50 px-3 py-2.5">
      {/* Color dot */}
      <span
        className="mt-1 block h-3 w-3 shrink-0 rounded-full ring-1 ring-black/20"
        style={{ backgroundColor: dotColor }}
      />

      <div className="min-w-0 flex-1">
        {/* Name + attack type */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-slate-200">{enemyName}</span>
          {attackIcon && <span className="text-sm">{attackIcon}</span>}
        </div>

        {/* Stats row */}
        <div className="mt-1 flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-red-400">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
              <path d="M2.22 2.22a.75.75 0 0 1 1.06 0L8 6.94l4.72-4.72a.75.75 0 1 1 1.06 1.06L9.06 8l4.72 4.72a.75.75 0 1 1-1.06 1.06L8 9.06l-4.72 4.72a.75.75 0 0 1-1.06-1.06L6.94 8 2.22 3.28a.75.75 0 0 1 0-1.06Z" />
            </svg>
            <span className="font-bold">{token.attack}</span>
            <span className="text-slate-500">{t('game.tileInfoAttack', { defaultValue: 'Atk' })}</span>
          </span>

          <span className="flex items-center gap-1 text-blue-400">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
              <path fillRule="evenodd" d="M8 1a.75.75 0 0 1 .698.48l1.396 3.6 3.838.266a.75.75 0 0 1 .432 1.307l-2.926 2.548.88 3.73a.75.75 0 0 1-1.117.8L8 11.844 4.8 13.73a.75.75 0 0 1-1.118-.8l.88-3.73L1.636 6.654a.75.75 0 0 1 .432-1.308l3.838-.266 1.396-3.6A.75.75 0 0 1 8 1Z" clipRule="evenodd" />
            </svg>
            <span className="font-bold">{token.armor}</span>
            <span className="text-slate-500">{t('game.tileInfoArmor', { defaultValue: 'Arm' })}</span>
          </span>

          <span className="flex items-center gap-1 text-amber-400">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
              <path d="M7.628 1.099a.75.75 0 0 1 .744 0l5.25 3a.75.75 0 0 1 0 1.302l-5.25 3a.75.75 0 0 1-.744 0l-5.25-3a.75.75 0 0 1 0-1.302l5.25-3ZM2.57 7.3l4.682 2.676a.75.75 0 0 0 .744 0L12.68 7.3l1.57.898a.75.75 0 0 1 0 1.302l-5.25 3a.75.75 0 0 1-.744 0l-5.25-3a.75.75 0 0 1 0-1.302L4.5 7.3l-1.93-1Z" />
            </svg>
            <span className="font-bold">{token.fameReward}</span>
            <span className="text-slate-500">{t('game.tileInfoFame', { defaultValue: 'Fame' })}</span>
          </span>
        </div>

        {/* Abilities */}
        {enemyAbilities && enemyAbilities !== 'None' && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {enemyAbilities.split(', ').map((ability) => (
              <span
                key={ability}
                className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[10px] font-medium text-slate-400"
              >
                {ability}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function EnemiesSection({
  cell,
  tEnemies,
  t,
}: {
  cell: HexCell
  tEnemies: (key: string, options?: { defaultValue: string }) => string
  t: (key: string, options?: { defaultValue: string }) => string
}) {
  if (cell.enemyTokens.length === 0) return null

  return (
    <div className="space-y-2.5">
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
        {t('game.tileInfoEnemies', { defaultValue: 'Enemies' })}
        <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-red-400 ring-1 ring-red-500/25">
          {cell.enemyTokens.length}
        </span>
      </h3>

      <div className="flex flex-col gap-2">
        {cell.enemyTokens.map((token, idx) => (
          <EnemyCard
            key={`${token.id}-${idx}`}
            token={token}
            tEnemies={tEnemies}
            t={t}
          />
        ))}
      </div>
    </div>
  )
}

function UnrevealedContent({
  t,
}: {
  t: (key: string, options?: { defaultValue: string }) => string
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <span className="text-4xl opacity-50">{'\u{1F32B}\uFE0F'}</span>
      <p className="text-sm font-medium text-slate-400">
        {t('game.tileInfoUnrevealed', { defaultValue: 'Unexplored' })}
      </p>
    </div>
  )
}

// ── Main Component ───────────────────────

export default function TileInfoPopup({ cell, onClose, dayNight }: TileInfoPopupProps) {
  const { t } = useTranslation('ui')
  const { t: tEnemies } = useTranslation('enemies')
  const { t: tSites } = useTranslation('sites')

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (!cell) return

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [cell, handleKeyDown])

  const isOpen = cell !== null

  const title = isOpen
    ? cell.isRevealed
      ? t(`game.terrain.${cell.terrain}`, { defaultValue: cell.terrain })
      : t('game.tileInfoUnrevealed', { defaultValue: 'Unexplored' })
    : ''

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center lg:items-center"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Desktop Panel (lg+) */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t('game.tileInfo', { defaultValue: 'Tile Info' })}
            className={[
              'relative z-50 w-full max-w-sm',
              'hidden lg:flex lg:flex-col',
              'max-h-[80vh] overflow-y-auto',
              'rounded-xl bg-slate-800',
              'border border-slate-700/60',
              'shadow-2xl shadow-black/50',
              'ring-1 ring-white/5',
            ].join(' ')}
            variants={desktopPanelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <PanelHeader title={title} onClose={onClose} />
            <PanelBody cell={cell} dayNight={dayNight} t={t} tEnemies={tEnemies} tSites={tSites} />
          </motion.div>

          {/* Mobile Panel (<lg) */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t('game.tileInfo', { defaultValue: 'Tile Info' })}
            className={[
              'relative z-50 w-full',
              'flex flex-col lg:hidden',
              'max-h-[75vh] overflow-hidden',
              'rounded-t-2xl bg-slate-800',
              'border-t border-slate-700/60',
              'shadow-2xl shadow-black/50',
              'ring-1 ring-white/5',
            ].join(' ')}
            variants={mobilePanelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Drag handle */}
            <div className="flex shrink-0 justify-center pt-2 pb-0">
              <div className="h-1 w-8 rounded-full bg-slate-600" />
            </div>
            <PanelHeader title={title} onClose={onClose} />
            <div className="flex-1 overflow-y-auto">
              <PanelBody cell={cell} dayNight={dayNight} t={t} tEnemies={tEnemies} tSites={tSites} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

// ── Shared panel sub-components ──────────

function PanelHeader({
  title,
  onClose,
}: {
  title: string
  onClose: () => void
}) {
  const { t } = useTranslation('ui')
  return (
    <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-slate-700/50 bg-slate-800/95 px-5 py-3.5 backdrop-blur-sm">
      <h2 className="text-base font-bold tracking-wide text-slate-100">{title}</h2>
      <button
        onClick={onClose}
        className="flex h-11 w-11 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-700 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-400 sm:h-8 sm:w-8"
        aria-label={t('common.closeDialog', { defaultValue: 'Close dialog' })}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      </button>
    </div>
  )
}

function PanelBody({
  cell,
  dayNight,
  t,
  tEnemies,
  tSites,
}: {
  cell: HexCell
  dayNight: DayNight
  t: (key: string, options?: { defaultValue: string }) => string
  tEnemies: (key: string, options?: { defaultValue: string }) => string
  tSites: (key: string, options?: { defaultValue: string }) => string
}) {
  if (!cell.isRevealed) {
    return (
      <div className="px-5 py-2">
        <UnrevealedContent t={t} />
      </div>
    )
  }

  return (
    <div className="space-y-4 px-5 py-4">
      <TerrainSection cell={cell} dayNight={dayNight} t={t} />

      {cell.site && (
        <>
          <div className="border-t border-slate-700/40" />
          <SiteSection cell={cell} tSites={tSites} t={t} />
        </>
      )}

      {cell.enemyTokens.length > 0 && (
        <>
          <div className="border-t border-slate-700/40" />
          <EnemiesSection cell={cell} tEnemies={tEnemies} t={t} />
        </>
      )}
    </div>
  )
}
