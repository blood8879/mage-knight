import { useCallback, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { UseCombatCardsReturn } from '@/hooks/useCombatCards'
import type { EnemyInstance, BlockDeclaration } from '@/engine/types'
import type { CombatCardPlay } from '@/engine/combatCardTypes'

// ── Props ────────────────────────────────────

interface BlockBuilderProps {
  enemies: EnemyInstance[]
  combatCards: UseCombatCardsReturn
  onConfirm: (blocks: BlockDeclaration[], plays: CombatCardPlay[]) => void
}

// ── Constants ────────────────────────────────

const ATTACK_TYPE_ICON: Record<string, string> = {
  normal: '⚔️',
  fire: '🔥',
  ice: '❄️',
  cold_fire: '💠',
  summon: '👻',
}

const ELEMENT_KEY: Record<string, string> = {
  physical: 'combat.elementPhysical',
  fire: 'combat.elementFire',
  ice: 'combat.elementIce',
  cold_fire: 'combat.elementColdFire',
}

const ATTACK_TYPE_KEY: Record<string, string> = {
  normal: 'combat.elementPhysical',
  fire: 'combat.elementFire',
  ice: 'combat.elementIce',
  cold_fire: 'combat.elementColdFire',
  summon: 'combat.elementPhysical',
}

const RESISTANCE_MAP: Record<string, string[]> = {
  physical_resistance: ['physical'],
  fire_resistance: ['fire'],
  ice_resistance: ['ice'],
  fire_ice: ['fire', 'ice'],
}

// ── Motion variants ──────────────────────────

const rowVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
}

// ── Helpers ──────────────────────────────────

function getResistanceWarning(
  abilities: string[],
  blockElement: string,
): string | null {
  for (const ability of abilities) {
    const resistedElements = RESISTANCE_MAP[ability]
    if (resistedElements && resistedElements.includes(blockElement)) {
      return ability.replace(/_/g, ' ')
    }
  }
  return null
}

// ── Component ────────────────────────────────

export default function BlockBuilder({
  enemies,
  combatCards,
  onConfirm,
}: BlockBuilderProps) {
  const { t } = useTranslation('ui')
  const { t: tEnemies } = useTranslation('enemies')

  // Filter to non-defeated enemies
  const activeEnemies = useMemo(
    () => enemies.filter((e) => !e.isDefeated),
    [enemies],
  )

  // Map enemy → pending block (if exists)
  const blockByEnemy = useMemo(() => {
    const map = new Map<string, (typeof combatCards.pendingBlocks)[number]>()
    for (const pb of combatCards.pendingBlocks) {
      map.set(pb.enemyInstanceId, pb)
    }
    return map
  }, [combatCards.pendingBlocks])

  // Handlers
  const handleAssignBlock = useCallback(
    (enemyInstanceId: string) => {
      combatCards.assignBlockToEnemy(enemyInstanceId)
    },
    [combatCards],
  )

  const handleConfirm = useCallback(() => {
    const declarations = combatCards.buildBlockDeclarations()
    onConfirm(declarations, combatCards.plays)
  }, [combatCards, onConfirm])

  const handleSkip = useCallback(() => {
    onConfirm([], [])
  }, [onConfirm])

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-lg">🛡️</span>
          <h3 className="text-sm font-black uppercase tracking-widest text-sky-300">
            {t('combat.blockPhase', 'Block Phase')}
          </h3>
        </div>
        <p className="text-xs text-sky-200/60">
          {t(
            'combat.blockDesc',
            'Assign blocks to reduce enemy damage. Unblocked enemies deal full damage.',
          )}
        </p>
      </div>

      {/* ── Section label ── */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">
          {t('combat.incomingAttacks', 'Incoming Attacks')}
        </span>
        <span className="rounded bg-red-900/30 px-1.5 py-0.5 font-mono text-[10px] font-bold text-red-300">
          {activeEnemies.length}
        </span>
      </div>

      {/* ── Enemy block rows ── */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {activeEnemies.map((enemy, idx) => {
            const pendingBlock = blockByEnemy.get(enemy.instanceId)
            const isSwift = enemy.appliedAbilities.includes('swift')
            const requiredValue = isSwift
              ? enemy.currentAttack * 2
              : enemy.currentAttack
            const blockValue = pendingBlock?.totalValue ?? 0
            const isFullyBlocked = blockValue >= requiredValue
            const isPartiallyBlocked = blockValue > 0 && !isFullyBlocked
            const isActiveTarget =
              combatCards.activeTargetEnemyId === enemy.instanceId
            const blockElement = pendingBlock?.element ?? 'physical'

            // Check element resistance warning
            const resistanceWarning = pendingBlock
              ? getResistanceWarning(
                  enemy.appliedAbilities,
                  blockElement,
                )
              : null

            return (
              <motion.div
                key={enemy.instanceId}
                variants={rowVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{
                  type: 'spring',
                  damping: 24,
                  stiffness: 300,
                  delay: idx * 0.05,
                }}
                className={[
                  'rounded-xl border p-3 transition-all duration-200',
                  isFullyBlocked
                    ? 'border-emerald-600/50 bg-emerald-950/30'
                    : isPartiallyBlocked
                      ? 'border-amber-600/40 bg-amber-950/20'
                      : 'border-slate-700/30 bg-slate-800/50',
                  isActiveTarget ? 'ring-2 ring-sky-400/60' : '',
                ].join(' ')}
              >
                {/* ── Enemy info row ── */}
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-200">
                      {tEnemies(`${enemy.token.id}.name`, { defaultValue: enemy.token.name })}
                    </span>
                    {isSwift && (
                      <span className="flex items-center gap-1 rounded-full bg-yellow-900/30 px-2 py-0.5 text-[10px] font-bold text-yellow-300">
                        ⚡ {t('combat.swift', 'SWIFT')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">
                      {ATTACK_TYPE_ICON[enemy.currentAttackType] ?? '⚔️'}
                    </span>
                    <span className="text-xs font-semibold text-red-300">
                      {t('combat.attack', 'Attack')}: {enemy.currentAttack}
                    </span>
                    <span className="rounded bg-red-900/20 px-1.5 py-0.5 text-[9px] text-red-400/70">
                      {t(ATTACK_TYPE_KEY[enemy.currentAttackType] ?? 'combat.elementPhysical')}
                    </span>
                  </div>
                </div>

                {/* ── Block status ── */}
                {pendingBlock ? (
                  <div className="space-y-2">
                    {/* Progress indicator */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">
                          {t('combat.blockNeeded', 'Block needed')}:
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-300">
                          {requiredValue}
                        </span>
                        {isSwift && (
                          <span className="text-[9px] text-yellow-400/70">
                            (2× {t('combat.swiftLabel', 'Swift')})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">
                          {t('combat.yourBlock', 'Your block')}:
                        </span>
                        <span
                          className={[
                            'font-mono text-xs font-black',
                            isFullyBlocked
                              ? 'text-emerald-400'
                              : 'text-amber-400',
                          ].join(' ')}
                        >
                          {blockValue}/{requiredValue}
                        </span>
                        <span className="text-sm">
                          {isFullyBlocked ? '✅' : '⚠'}
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
                      <div
                        className={[
                          'absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out',
                          isFullyBlocked ? 'bg-emerald-600' : 'bg-amber-600',
                        ].join(' ')}
                        style={{
                          width: `${Math.min((blockValue / requiredValue) * 100, 100)}%`,
                        }}
                      />
                    </div>

                    {/* Block element & contributing plays */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded bg-sky-900/30 px-1.5 py-0.5 text-[9px] font-semibold text-sky-300">
                        {t(ELEMENT_KEY[blockElement] ?? 'combat.elementPhysical')}
                      </span>
                      {pendingBlock.plays.map((play) => (
                        <span
                          key={play.id}
                          className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[9px] text-slate-400"
                        >
                          {play.cardName} +{play.value}
                        </span>
                      ))}
                    </div>

                    {/* Resistance warning */}
                    {resistanceWarning && (
                      <div className="flex items-center gap-1.5 rounded-md border border-amber-700/30 bg-amber-950/30 px-2.5 py-1.5">
                        <span className="text-sm">⚠</span>
                        <span className="text-[10px] font-semibold text-amber-300">
                          {t('combat.resistsElement', 'Enemy resists {{element}}', {
                            element: resistanceWarning,
                          })}
                        </span>
                      </div>
                    )}

                    {/* Blocked badge */}
                    {isFullyBlocked && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">✓</span>
                        <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                          {t('combat.blocked', 'BLOCKED')}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ── No block assigned ── */
                  <div className="flex items-center justify-between">
                    <span className="text-xs italic text-slate-500">
                      {t(
                        'combat.noBlock',
                        'No block assigned — will take damage',
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAssignBlock(enemy.instanceId)}
                      className="min-h-[44px] rounded-lg border border-sky-700/40 bg-sky-900/20 px-3.5 py-2 text-xs font-bold text-sky-300 transition-all hover:bg-sky-800/30 hover:text-sky-200 active:scale-95"
                    >
                      {t('combat.assignBlock', 'Assign Block')}
                    </button>
                  </div>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* ── No enemies ── */}
      {activeEnemies.length === 0 && (
        <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/40 p-6 text-center">
          <span className="text-sm font-bold text-emerald-400">
            {t('combat.allDefeated', 'All enemies defeated!')}
          </span>
        </div>
      )}

      {/* ── Footer buttons ── */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={handleSkip}
          className="min-h-[44px] rounded-lg border border-red-800/40 bg-red-950/30 px-4 py-2.5 text-xs font-bold text-red-300 transition-all hover:bg-red-900/40 hover:text-red-200 active:scale-95"
        >
          {t('combat.takeAllDamage', 'Take All Damage')}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="min-h-[44px] rounded-lg bg-sky-700 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-900/30 transition-all hover:bg-sky-600 active:scale-95"
        >
          {t('combat.confirmBlocks', 'Confirm Blocks')} ✓
        </button>
      </div>
    </div>
  )
}
