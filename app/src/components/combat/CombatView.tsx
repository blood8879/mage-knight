import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useCombat } from '@/hooks/useCombat'
import { useCombatCards } from '@/hooks/useCombatCards'
import { useGameStore } from '@/store/gameStore'
import EnemyCard from '@/components/combat/EnemyCard'
import DamageAssign from '@/components/combat/DamageAssign'
import AttackBuilder from '@/components/combat/AttackBuilder'
import BlockBuilder from '@/components/combat/BlockBuilder'
import CombatCardTray from '@/components/combat/CombatCardTray'
import type { GamePhase, CombatPhase } from '@/engine/types'

// ── Phase metadata ───────────────────────
const PHASE_ORDER: CombatPhase[] = [
  'ranged_siege',
  'block',
  'assign_damage',
  'attack',
  'combat_end',
]

const PHASE_DISPLAY: Record<CombatPhase, { labelKey: string; accent: string; icon: string }> = {
  ranged_siege: { labelKey: 'combat.phaseRangedSiege', accent: 'text-amber-300', icon: '🏹' },
  block: { labelKey: 'combat.phaseBlock', accent: 'text-sky-300', icon: '🛡️' },
  assign_damage: { labelKey: 'combat.phaseAssignDamage', accent: 'text-red-300', icon: '💥' },
  attack: { labelKey: 'combat.phaseMeleeAttack', accent: 'text-orange-300', icon: '⚔️' },
  combat_end: { labelKey: 'combat.phaseCombatResults', accent: 'text-emerald-300', icon: '🏆' },
}

// ── Framer Motion variants ───────────────
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

const panelVariants = {
  hidden: { opacity: 0, y: 32, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, damping: 26, stiffness: 300 },
  },
  exit: { opacity: 0, y: 20, scale: 0.97, transition: { duration: 0.18 } },
}

const COMBAT_GAME_PHASES: ReadonlySet<GamePhase> = new Set([
  'combat_ranged_siege',
  'combat_block',
  'combat_assign_damage',
  'combat_attack',
  'combat_end',
])

export default function CombatView() {
  const { t } = useTranslation('ui')
  const phase = useGameStore((s) => s.phase)
  const heroArmor = useGameStore((s) => s.armor)
  const engineState = useGameStore((s) => s.engineState)
  const heroUnits = engineState?.player.units ?? []

  const {
    isCombatActive,
    combatPhase,
    enemies,
    confirmRangedPhase,
    confirmBlockPhase,
    confirmDamageAssignment,
    confirmMeleePhase,
    finishCombat,
    getUnblockedDamage,
  } = useCombat()

  const hand = engineState?.player.deck.hand ?? []
  const units = engineState?.player.units ?? []
  const skills = engineState?.player.skills ?? []

  const combatCards = useCombatCards(
    combatPhase, hand, units, enemies, skills, engineState?.dayNight ?? 'day',
  )

  const isVisible = isCombatActive && COMBAT_GAME_PHASES.has(phase)

  const currentPhaseIdx = PHASE_ORDER.indexOf(combatPhase)
  const progressPercent = ((currentPhaseIdx + 1) / PHASE_ORDER.length) * 100
  const phaseDisplay = PHASE_DISPLAY[combatPhase]

  const defeatedCount = useMemo(
    () => enemies.filter((e) => e.isDefeated).length,
    [enemies],
  )

  const allDefeated = useMemo(
    () => enemies.length > 0 && enemies.every((e) => e.isDefeated),
    [enemies],
  )

  const totalFame = useMemo(
    () =>
      enemies
        .filter((e) => e.isDefeated)
        .reduce((sum, e) => sum + e.token.fameReward, 0),
    [enemies],
  )

  const unblockedDamage = useMemo(() => {
    if (combatPhase !== 'assign_damage') return []
    return getUnblockedDamage()
  }, [combatPhase, getUnblockedDamage])

  return createPortal(
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-3"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          transition={{ duration: 0.22 }}
        >
          {/* ── Backdrop ── */}
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* ── Main panel ── */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t('combat.title', 'Combat')}
            className="relative z-50 flex w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900 shadow-2xl shadow-black/60 ring-1 ring-white/5"
            style={{ maxHeight: 'calc(100vh - 1.5rem)' }}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* ── Header ── */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-700/50 bg-slate-800/80 px-3 py-2 sm:px-5 sm:py-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <h2 className="text-base font-bold tracking-wide text-slate-100 sm:text-lg">
                  {t('combat.title', 'Combat')}
                </h2>
                {phaseDisplay && (
                  <span
                    className={[
                      'flex items-center gap-1 rounded-full border border-slate-700/40 bg-slate-900/60 px-2 py-0.5 text-[10px] font-bold sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs',
                      phaseDisplay.accent,
                    ].join(' ')}
                  >
                    <span>{phaseDisplay.icon}</span>
                    {t(phaseDisplay.labelKey)}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 sm:gap-2 sm:text-xs">
                {combatCards.pendingAttacks.length > 0 && (
                  <span className="rounded bg-orange-900/40 px-1.5 py-0.5 font-semibold text-orange-300 sm:px-2">
                    {combatCards.pendingAttacks.length} {t('combat.attacks', 'attack(s)')}
                  </span>
                )}
                {combatCards.pendingBlocks.length > 0 && (
                  <span className="rounded bg-sky-900/40 px-1.5 py-0.5 font-semibold text-sky-300 sm:px-2">
                    {combatCards.pendingBlocks.length} {t('combat.blocks', 'block(s)')}
                  </span>
                )}
                {combatCards.plays.length > 0 && (
                  <span className="rounded bg-violet-900/40 px-1.5 py-0.5 font-semibold text-violet-300 sm:px-2">
                    {combatCards.plays.length} {t('combat.cardsPlayed', 'card(s) played')}
                  </span>
                )}
              </div>
            </div>

            {/* ── Scrollable body ── */}
            <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
              {/* ── Phase progress stepper ── */}
              <div className="mb-5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{phaseDisplay.icon}</span>
                    <span
                      className={[
                        'text-lg font-black tracking-wide',
                        phaseDisplay.accent,
                      ].join(' ')}
                    >
                      {t(phaseDisplay.labelKey)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>
                      {defeatedCount}/{enemies.length}{' '}
                      {t('combat.defeated', 'defeated')}
                    </span>
                    <span className="font-mono text-amber-400">
                      {totalFame} {t('combat.fame', 'fame')}
                    </span>
                  </div>
                </div>

                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                  {PHASE_ORDER.map((stepPhase, idx) => (
                    <div
                      key={stepPhase}
                      className={[
                        'absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-all duration-300',
                        idx <= currentPhaseIdx
                          ? 'border-amber-400 bg-amber-500 shadow-sm shadow-amber-400/40'
                          : 'border-slate-600 bg-slate-700',
                      ].join(' ')}
                      style={{
                        left: `${((idx + 0.5) / PHASE_ORDER.length) * 100}%`,
                      }}
                      title={t(PHASE_DISPLAY[stepPhase].labelKey)}
                    />
                  ))}
                </div>

                <div className="flex justify-between px-1">
                  {PHASE_ORDER.map((stepPhase, idx) => (
                    <span
                      key={stepPhase}
                      className={[
                        'text-[8px] font-semibold uppercase tracking-wider transition-colors',
                        idx <= currentPhaseIdx
                          ? 'text-slate-300'
                          : 'text-slate-600',
                      ].join(' ')}
                    >
                      {t(PHASE_DISPLAY[stepPhase].labelKey)}
                    </span>
                  ))}
                </div>
              </div>

              {/* ── Enemy grid ── */}
              <div className="mb-5 space-y-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">
                    {t('combat.enemies', 'Enemies')}
                  </span>
                  <span className="rounded bg-red-900/30 px-1.5 py-0.5 font-mono text-[10px] font-bold text-red-300">
                    {enemies.filter((e) => !e.isDefeated).length}/{enemies.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {enemies.map((enemy) => (
                    <EnemyCard
                      key={enemy.instanceId}
                      enemy={enemy}
                      isSelected={combatCards.activeTargetEnemyId === enemy.instanceId}
                      onClick={() => combatCards.setActiveTarget(enemy.instanceId)}
                      showDetails={combatCards.activeTargetEnemyId === enemy.instanceId}
                    />
                  ))}
                </div>
              </div>

              {/* ── Phase-specific action area ── */}
              <div className="min-h-[120px] rounded-xl border border-slate-700/30 bg-slate-900/50 p-4">
                {combatPhase === 'ranged_siege' && (
                  <AttackBuilder
                    phase="ranged_siege"
                    enemies={enemies}
                    combatCards={combatCards}
                    onConfirm={confirmRangedPhase}
                  />
                )}

                {combatPhase === 'block' && (
                  <BlockBuilder
                    enemies={enemies}
                    combatCards={combatCards}
                    onConfirm={confirmBlockPhase}
                  />
                )}

                {combatPhase === 'assign_damage' && (
                  <DamageAssign
                    unblockedDamage={unblockedDamage}
                    heroArmor={heroArmor}
                    units={heroUnits}
                    onConfirm={confirmDamageAssignment}
                  />
                )}

                {combatPhase === 'attack' && (
                  <AttackBuilder
                    phase="attack"
                    enemies={enemies}
                    combatCards={combatCards}
                    onConfirm={confirmMeleePhase}
                  />
                )}

                {combatPhase === 'combat_end' && (
                  <div className="space-y-4 text-center">
                    <div className="space-y-1">
                      <span className="text-3xl">
                        {allDefeated ? '🏆' : '⚔️'}
                      </span>
                      <h3 className="text-lg font-black text-slate-100">
                        {allDefeated
                          ? t('combat.victory', 'Victory!')
                          : t('combat.resolved', 'Combat Resolved')}
                      </h3>
                      <p className="text-sm text-slate-400">
                        {defeatedCount}/{enemies.length}{' '}
                        {t('combat.defeated')}
                      </p>
                    </div>

                    <div className="mx-auto flex w-fit gap-4">
                      <div className="rounded-lg border border-amber-700/30 bg-amber-950/40 px-4 py-2 text-center">
                        <span className="block text-[10px] font-bold uppercase tracking-widest text-amber-400/60">
                          {t('combat.fame', 'Fame')}
                        </span>
                        <span className="font-mono text-xl font-black text-amber-300">
                          +{totalFame}
                        </span>
                      </div>
                    </div>

                    {/* Combat rewards placeholder */}
                    <div className="mx-auto mt-3 w-fit">
                      <p className="text-xs text-slate-500">
                        {allDefeated
                          ? t('combat.rewardsNote', 'Rewards will be processed when combat ends.')
                          : t('combat.retreatNote', 'Surviving enemies remain. No site rewards earned.')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Card Tray (visible during card-selection phases) ── */}
            {(combatPhase === 'ranged_siege' || combatPhase === 'block' || combatPhase === 'attack') && (
              <CombatCardTray
                phase={combatPhase}
                combatCards={combatCards}
              />
            )}

            {/* ── Footer actions ── */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-700/50 bg-slate-800/60 px-3 py-2 sm:px-5 sm:py-3">
              {/* Skip phase button - always available except at combat_end */}
              {combatPhase !== 'combat_end' && !(combatPhase === 'assign_damage' && unblockedDamage.length > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    if (combatPhase === 'ranged_siege') confirmRangedPhase([], [])
                    else if (combatPhase === 'block') confirmBlockPhase([], [])
                    else if (combatPhase === 'assign_damage') confirmDamageAssignment([])
                    else if (combatPhase === 'attack') confirmMeleePhase([], [])
                  }}
                  className="min-h-[44px] rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 shadow transition-all hover:bg-slate-600 active:scale-[0.97]"
                >
                  {t('combat.skipPhase', 'Skip Phase')} →
                </button>
              )}

              {/* End combat button - always shown at combat_end, or when all defeated */}
              {(allDefeated || combatPhase === 'combat_end') && (
                <button
                  type="button"
                  onClick={finishCombat}
                  className="min-h-[44px] rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 transition-all hover:bg-emerald-600 active:scale-[0.97]"
                >
                  {t('combat.endCombat', 'End Combat')}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
