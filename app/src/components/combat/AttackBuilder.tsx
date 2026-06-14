import { useCallback, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { UseCombatCardsReturn } from '@/hooks/useCombatCards'
import type { EnemyInstance, CombatPhase, AttackDeclaration, Element, EnemyColor } from '@/engine/types'
import type { CombatCardPlay } from '@/engine/combatCardTypes'

// ── Props ───────────────────────────────────
interface AttackBuilderProps {
  phase: CombatPhase // 'ranged_siege' | 'attack'
  enemies: EnemyInstance[]
  combatCards: UseCombatCardsReturn
  onConfirm: (attacks: AttackDeclaration[], plays: CombatCardPlay[]) => void
}

// ── Constants ───────────────────────────────

const PHASE_CONFIG: Record<
  'ranged_siege' | 'attack',
  { icon: string; labelKey: string; label: string; hintKey: string; hint: string; accent: string; accentBg: string; accentBorder: string }
> = {
  ranged_siege: {
    icon: '🏹',
    labelKey: 'combat.rangedSiegePhase',
    label: 'Ranged & Siege Phase',
    hintKey: 'combat.rangedSiegeHint',
    hint: 'Select enemies to target, then play cards to build attacks.',
    accent: 'text-amber-300',
    accentBg: 'bg-amber-900/20',
    accentBorder: 'border-amber-700/30',
  },
  attack: {
    icon: '⚔️',
    labelKey: 'combat.meleePhase',
    label: 'Melee Attack Phase',
    hintKey: 'combat.meleeHint',
    hint: 'Select enemies to target, then play cards to build attacks.',
    accent: 'text-orange-300',
    accentBg: 'bg-orange-900/20',
    accentBorder: 'border-orange-700/30',
  },
}

const ELEMENT_ICON: Record<Element, string> = {
  physical: '🗡',
  fire: '🔥',
  ice: '❄',
  cold_fire: '💠',
}

const ELEMENT_KEY: Record<string, string> = {
  physical: 'combat.elementPhysical',
  fire: 'combat.elementFire',
  ice: 'combat.elementIce',
  cold_fire: 'combat.elementColdFire',
}

const ENEMY_TARGET_COLORS: Record<EnemyColor, { ring: string; bg: string; border: string }> = {
  green: { ring: 'ring-emerald-400/80', bg: 'bg-emerald-950/60', border: 'border-emerald-600/40' },
  grey: { ring: 'ring-zinc-400/80', bg: 'bg-zinc-900/60', border: 'border-zinc-500/40' },
  violet: { ring: 'ring-purple-400/80', bg: 'bg-purple-950/60', border: 'border-purple-500/40' },
  brown: { ring: 'ring-amber-400/80', bg: 'bg-amber-950/60', border: 'border-amber-700/40' },
  red: { ring: 'ring-red-400/80', bg: 'bg-red-950/60', border: 'border-red-500/40' },
  white: { ring: 'ring-slate-300/80', bg: 'bg-slate-800/60', border: 'border-slate-300/40' },
}

// ── Component ───────────────────────────────

export default function AttackBuilder({
  phase,
  enemies,
  combatCards,
  onConfirm,
}: AttackBuilderProps) {
  const { t } = useTranslation('ui')
  const { t: tEnemies } = useTranslation('enemies')

  const config = PHASE_CONFIG[phase as 'ranged_siege' | 'attack'] ?? PHASE_CONFIG.attack

  // ── Derived data ───────────────────────────

  const aliveEnemies = useMemo(
    () => enemies.filter((e) => !e.isDefeated),
    [enemies],
  )

  const hasEmptyAttacks = useMemo(
    () => combatCards.pendingAttacks.some((pa) => pa.plays.length === 0),
    [combatCards.pendingAttacks],
  )

  const canConfirmAttacks = useMemo(() => {
    // Can always confirm with 0 total attacks (skip)
    if (combatCards.pendingAttacks.length === 0) return true
    // Cannot confirm if any pending attack has 0 plays
    return !hasEmptyAttacks
  }, [combatCards.pendingAttacks.length, hasEmptyAttacks])

  // ── Handlers ───────────────────────────────

  const handleEnemyClick = useCallback(
    (enemyId: string) => {
      const alreadyTargeted = combatCards.pendingAttacks.some((pa) =>
        pa.targetEnemyIds.includes(enemyId),
      )

      if (alreadyTargeted) {
        // Set as active target to assign more cards to this attack
        combatCards.setActiveTarget(enemyId)
      } else {
        // Create a new pending attack for this enemy
        combatCards.startNewAttack([enemyId])
      }
    },
    [combatCards],
  )

  const handleNewAttack = useCallback(() => {
    if (combatCards.activeTargetEnemyId) {
      combatCards.startNewAttack([combatCards.activeTargetEnemyId])
    }
  }, [combatCards])

  // Attack cards were played but not assigned to any enemy → confirming wastes them
  const unassignedAttack = combatCards.plays.length > 0 && combatCards.pendingAttacks.length === 0

  const handleConfirm = useCallback(() => {
    const declarations = combatCards.buildAttackDeclarations()
    onConfirm(declarations, combatCards.plays)
  }, [combatCards, onConfirm])

  const handleSkip = useCallback(() => {
    onConfirm([], [])
  }, [onConfirm])

  // ── Helpers ────────────────────────────────

  const getEnemyName = useCallback(
    (enemyId: string): string => {
      const enemy = enemies.find((e) => e.instanceId === enemyId)
      return enemy ? tEnemies(`${enemy.token.id}.name`, { defaultValue: enemy.token.name }) : enemyId
    },
    [enemies, tEnemies],
  )

  const getEnemyArmor = useCallback(
    (enemyIds: string[]): number => {
      // Return max armor among targeted enemies
      return enemyIds.reduce((max, id) => {
        const enemy = enemies.find((e) => e.instanceId === id)
        return Math.max(max, enemy?.currentArmor ?? 0)
      }, 0)
    },
    [enemies],
  )

  const isEnemyFortified = useCallback(
    (enemyIds: string[]): boolean => {
      return enemyIds.some((id) => {
        const enemy = enemies.find((e) => e.instanceId === id)
        return enemy?.isFortified ?? false
      })
    },
    [enemies],
  )

  // ── Render ─────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Phase Header ── */}
      <div className={['rounded-lg border px-4 py-3', config.accentBg, config.accentBorder].join(' ')}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{config.icon}</span>
          <h3 className={['text-sm font-black tracking-wide', config.accent].join(' ')}>
            {t(config.labelKey, config.label)}
          </h3>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          {t(config.hintKey, config.hint)}
        </p>
      </div>

      {/* ── Target Selection ── */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {t('combat.targets', 'Targets')}
        </span>
        <div className="flex flex-wrap gap-2">
          {aliveEnemies.map((enemy) => {
            const colorStyle = ENEMY_TARGET_COLORS[enemy.token.color]
            const isActive = combatCards.activeTargetEnemyId === enemy.instanceId
            const isTargeted = combatCards.pendingAttacks.some((pa) =>
              pa.targetEnemyIds.includes(enemy.instanceId),
            )

            return (
              <button
                key={enemy.instanceId}
                type="button"
                onClick={() => handleEnemyClick(enemy.instanceId)}
                className={[
                  'relative flex w-20 flex-col items-center rounded-lg border p-2 shadow-md transition-all duration-200',
                  colorStyle.bg,
                  colorStyle.border,
                  isActive
                    ? `ring-2 ${colorStyle.ring} scale-105`
                    : isTargeted
                      ? 'ring-1 ring-slate-400/40'
                      : '',
                  'cursor-pointer hover:scale-105 hover:brightness-110 active:scale-95',
                ].join(' ')}
              >
                {/* Fortified badge */}
                {enemy.isFortified && (
                  <div className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[8px] font-black text-amber-950 shadow-md shadow-amber-600/40">
                    F
                  </div>
                )}

                {/* Targeted indicator */}
                {isTargeted && (
                  <div className="absolute -left-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[7px] font-black text-white shadow-sm">
                    ✓
                  </div>
                )}

                <span className="mb-1 truncate text-center text-[9px] font-bold leading-tight text-slate-200">
                  {tEnemies(`${enemy.token.id}.name`, { defaultValue: enemy.token.name })}
                </span>
                <div className="flex items-center gap-0.5">
                  <span className="text-[10px]">🛡️</span>
                  <span className="font-mono text-[10px] font-bold text-slate-300">
                    {enemy.currentArmor}
                  </span>
                </div>
                {isActive && (
                  <span className={['mt-0.5 text-[7px] font-bold', config.accent].join(' ')}>
                    {t('combat.activeTarget', 'TARGET')}
                  </span>
                )}
              </button>
            )
          })}

          {aliveEnemies.length === 0 && (
            <p className="text-xs italic text-slate-600">
              {t('combat.noEnemies', 'No enemies to target.')}
            </p>
          )}
        </div>
      </div>

      {/* ── Pending Attacks ── */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {t('combat.pendingAttacks', 'Pending Attacks')}
        </span>

        <AnimatePresence mode="popLayout">
          {combatCards.pendingAttacks.map((pa, idx) => {
            const targetArmor = getEnemyArmor(pa.targetEnemyIds)
            const isEnough = pa.totalValue >= targetArmor
            const isFortified = isEnemyFortified(pa.targetEnemyIds)
            const needsSiege = phase === 'ranged_siege' && isFortified && !pa.isSiege
            const targetNames = pa.targetEnemyIds.map(getEnemyName).join(', ')

            return (
              <motion.div
                key={pa.id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ type: 'spring', damping: 24, stiffness: 280 }}
                className={[
                  'rounded-lg border p-3',
                  needsSiege
                    ? 'border-red-600/50 bg-red-950/30'
                    : 'border-slate-700/30 bg-slate-800/50',
                ].join(' ')}
              >
                {/* Attack header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-slate-500">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-200">
                      → {targetNames}
                    </span>
                    {/* Attack type badges */}
                    <div className="flex items-center gap-1">
                      {pa.isSiege && (
                        <span className="rounded bg-amber-900/40 px-1.5 py-0.5 text-[8px] font-bold text-amber-300">
                          ⚔ {t('combat.siege', 'Siege')}
                        </span>
                      )}
                      {pa.isRanged && (
                        <span className="rounded bg-sky-900/40 px-1.5 py-0.5 text-[8px] font-bold text-sky-300">
                          🏹 {t('combat.ranged', 'Ranged')}
                        </span>
                      )}
                      <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[8px] font-bold text-slate-300">
                        {ELEMENT_ICON[pa.element]} {t(ELEMENT_KEY[pa.element] ?? 'combat.elementPhysical')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Value vs Armor comparison */}
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {t('combat.total', 'Total')}:
                    </span>
                    <span
                      className={[
                        'font-mono text-sm font-black',
                        isEnough ? 'text-emerald-400' : 'text-red-400',
                      ].join(' ')}
                    >
                      {pa.totalValue} ⚔
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-600">vs</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {t('combat.armor', 'Armor')}:
                    </span>
                    <span className="font-mono text-sm font-bold text-slate-300">
                      {targetArmor} 🛡️
                    </span>
                  </div>
                  {isEnough && pa.totalValue > 0 && (
                    <span className="rounded bg-emerald-900/40 px-1.5 py-0.5 text-[8px] font-bold text-emerald-300">
                      ✅ {t('combat.enough', 'Enough!')}
                    </span>
                  )}
                  {!isEnough && pa.totalValue > 0 && (
                    <span className="rounded bg-red-900/40 px-1.5 py-0.5 text-[8px] font-bold text-red-300">
                      ✗ {t('combat.notEnough', 'Not enough')}
                    </span>
                  )}
                </div>

                {/* Contributing plays */}
                {pa.plays.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {pa.plays.map((play) => (
                      <span
                        key={play.id}
                        className="inline-flex items-center gap-1 rounded border border-slate-600/40 bg-slate-900/60 px-2 py-0.5 text-[9px] font-semibold text-slate-300"
                      >
                        {play.cardName}
                        <span className="font-mono text-[8px] text-slate-500">
                          ({play.value})
                        </span>
                      </span>
                    ))}
                  </div>
                )}

                {pa.plays.length === 0 && (
                  <p className="mt-1.5 text-[9px] italic text-slate-600">
                    {t('combat.noCardsPlayed', 'No cards played yet — use the card tray below.')}
                  </p>
                )}

                {/* Fortified warning */}
                {needsSiege && (
                  <div className="mt-2 flex items-center gap-1.5 rounded border border-red-700/40 bg-red-950/40 px-2.5 py-1.5">
                    <span className="text-sm">⚠</span>
                    <span className="text-[10px] font-bold text-red-300">
                      {t(
                        'combat.fortifiedWarning',
                        'Fortified enemies require siege attacks',
                      )}
                    </span>
                  </div>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>

        {combatCards.pendingAttacks.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-700/40 bg-slate-900/30 py-4 text-center">
            <p className="text-xs text-slate-600">
              {t('combat.noAttacks', 'No attacks declared. Click an enemy above to start.')}
            </p>
          </div>
        )}

        {/* New Attack button */}
        {combatCards.activeTargetEnemyId && (
          <button
            type="button"
            onClick={handleNewAttack}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-600/40 bg-slate-800/30 py-2 text-xs font-semibold text-slate-400 transition-all hover:border-slate-500/60 hover:bg-slate-800/50 hover:text-slate-300 active:scale-[0.98]"
          >
            <span className="text-sm">+</span>
            {t('combat.newAttack', 'New Attack')}
          </button>
        )}
      </div>

      {/* Warning: attack cards played but not assigned to an enemy → wasted */}
      {unassignedAttack && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-600/50 bg-amber-950/40 px-3 py-2">
          <span className="text-sm">⚠️</span>
          <p className="text-[11px] leading-snug text-amber-200">
            {t('combat.unassignedAttackWarning', 'You played attack cards but did not assign them to an enemy. Tap an enemy above first — otherwise the cards are discarded with no attack.')}
          </p>
        </div>
      )}

      {/* ── Footer Actions ── */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={handleSkip}
          className="min-h-[44px] rounded-lg border border-slate-700/40 bg-slate-800/50 px-4 py-2.5 text-xs font-semibold text-slate-400 transition-all hover:bg-slate-700/60 hover:text-slate-300 active:scale-95"
        >
          {t('combat.skipPhase', 'Skip Phase')}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirmAttacks}
          className={[
            'min-h-[44px] rounded-lg px-5 py-2.5 text-sm font-bold shadow-lg transition-all active:scale-95',
            !canConfirmAttacks
              ? 'cursor-not-allowed bg-slate-800 text-slate-600 shadow-none'
              : unassignedAttack
                ? 'bg-amber-700 text-white shadow-amber-900/30 hover:bg-amber-600'
                : phase === 'ranged_siege'
                  ? 'bg-amber-700 text-white shadow-amber-900/30 hover:bg-amber-600'
                  : 'bg-orange-700 text-white shadow-orange-900/30 hover:bg-orange-600',
          ].join(' ')}
        >
          {unassignedAttack
            ? t('combat.confirmWasteAttacks', 'Confirm — discard cards')
            : `${t('combat.confirmAttacks', 'Confirm')} ✓`}
        </button>
      </div>
    </div>
  )
}
