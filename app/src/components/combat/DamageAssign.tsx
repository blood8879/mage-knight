import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { EnemyAbility, DamageAssignment, UnitInstance, Element } from '@/engine/types'
import { getEffectiveUnitArmor } from '@/utils/bannerUtils'
import { isUnitEligible, isUnitResistant, unitAbsorption } from '@/utils/damageAssignUtils'

interface DamageSource {
  enemyInstanceId: string
  damage: number
  element: Element
  abilities: EnemyAbility[]
}

interface DamageAssignProps {
  unblockedDamage: DamageSource[]
  heroArmor: number
  units: UnitInstance[]
  onConfirm: (assignments: DamageAssignment[]) => void
}

interface AssignmentTarget {
  targetType: 'hero' | 'unit'
  unitInstanceIndex?: number
  damageAbsorbed: number
  woundsInflicted: number
}

const ELEMENT_LABEL: Record<Element, string> = {
  physical: 'combat.elementPhysical',
  fire: 'combat.elementFire',
  ice: 'combat.elementIce',
  cold_fire: 'combat.elementColdFire',
}

const ELEMENT_ICON: Record<Element, string> = {
  physical: '🗡',
  fire: '🔥',
  ice: '❄',
  cold_fire: '💠',
}

export default function DamageAssign({
  unblockedDamage,
  heroArmor,
  units,
  onConfirm,
}: DamageAssignProps) {
  const { t } = useTranslation('ui')

  const totalIncoming = useMemo(
    () => unblockedDamage.reduce((sum, d) => sum + d.damage, 0),
    [unblockedDamage],
  )

  // Each Unit may be assigned to at most one enemy. We store, per enemy, the
  // ordered list of unit indices the player has chosen to soak that attack.
  const [unitOrder, setUnitOrder] = useState<Record<string, number[]>>({})

  // Toggle the "how wounds work" help panel
  const [showHelp, setShowHelp] = useState(false)

  // Which enemy (if any) a given unit index is currently assigned to.
  const unitToEnemy = useMemo(() => {
    const map: Record<number, string> = {}
    for (const [enemyId, idxs] of Object.entries(unitOrder)) {
      for (const idx of idxs) map[idx] = enemyId
    }
    return map
  }, [unitOrder])

  /** Resolve the full assignment for one enemy: unit soaks first, hero takes the rest. */
  const resolveEnemy = useCallback(
    (src: DamageSource): AssignmentTarget[] => {
      const poison = src.abilities.includes('poison')
      const targets: AssignmentTarget[] = []
      let remaining = src.damage

      for (const unitIdx of unitOrder[src.enemyInstanceId] ?? []) {
        if (remaining <= 0) break
        const unit = units[unitIdx]
        if (!unit) continue
        const { absorbed, wounds } = unitAbsorption(unit, src.element, remaining, poison)
        if (absorbed <= 0) continue
        targets.push({
          targetType: 'unit',
          unitInstanceIndex: unitIdx,
          damageAbsorbed: absorbed,
          woundsInflicted: wounds,
        })
        remaining -= absorbed
      }

      if (remaining > 0) {
        targets.push({
          targetType: 'hero',
          damageAbsorbed: remaining,
          woundsInflicted: Math.ceil(remaining / Math.max(heroArmor, 1)),
        })
      }

      return targets
    },
    [unitOrder, units, heroArmor],
  )

  /** Remaining damage that would spill to the hero for an enemy (before adding more units). */
  const heroRemainingFor = useCallback(
    (src: DamageSource): number => {
      const hero = resolveEnemy(src).find((a) => a.targetType === 'hero')
      return hero ? hero.damageAbsorbed : 0
    },
    [resolveEnemy],
  )

  const toggleUnit = useCallback(
    (enemyInstanceId: string, unitIdx: number) => {
      setUnitOrder((prev) => {
        const current = prev[enemyInstanceId] ?? []
        if (current.includes(unitIdx)) {
          // Unassign from this enemy
          return { ...prev, [enemyInstanceId]: current.filter((i) => i !== unitIdx) }
        }
        // A unit can only be assigned to one enemy — drop it elsewhere first
        const cleared: Record<string, number[]> = {}
        for (const [eid, idxs] of Object.entries(prev)) {
          cleared[eid] = idxs.filter((i) => i !== unitIdx)
        }
        return { ...cleared, [enemyInstanceId]: [...(cleared[enemyInstanceId] ?? []), unitIdx] }
      })
    },
    [],
  )

  const handleConfirm = useCallback(() => {
    const result: DamageAssignment[] = unblockedDamage.map((src) => ({
      enemyInstanceId: src.enemyInstanceId,
      totalDamage: src.damage,
      assignments: resolveEnemy(src),
    }))
    onConfirm(result)
  }, [unblockedDamage, resolveEnemy, onConfirm])

  if (totalIncoming === 0) {
    return (
      <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/40 p-6 text-center">
        <span className="text-lg font-bold text-emerald-400">{t('combat.noIncomingDamage')}</span>
        <p className="mt-1 text-sm text-emerald-400/60">{t('combat.allBlocked')}</p>
        <button
          type="button"
          onClick={() => onConfirm([])}
          className="mt-4 min-h-[44px] rounded-lg bg-emerald-700 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/40 transition-all hover:bg-emerald-600 active:scale-95"
        >
          {t('combat.continue')}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-red-800/40 bg-red-950/30 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-red-300">{t('combat.incomingDamage')}</span>
          <span className="rounded bg-red-800/60 px-2 py-0.5 font-mono text-sm font-black text-red-200">
            {totalIncoming}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          aria-expanded={showHelp}
          className="flex items-center gap-1 rounded-full border border-slate-600/50 bg-slate-800/70 px-2 py-1 text-[10px] font-bold text-slate-300 transition-colors hover:bg-slate-700/70"
        >
          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-600 text-[8px] text-white">
            ?
          </span>
          {t('combat.howWoundsWork', 'How wounds work')}
        </button>
      </div>

      {/* Help panel — explains that Armor sets the wound ratio, not damage reduction */}
      {showHelp && (
        <div className="rounded-lg border border-slate-700/50 bg-slate-800/60 px-3 py-2.5 text-[11px] leading-relaxed text-slate-300">
          <p className="mb-1 font-bold text-amber-300">
            {t('combat.woundHelpTitle', 'Armor does not reduce damage')}
          </p>
          <p>
            {t(
              'combat.woundHelpBody',
              'Armor sets how much damage equals one Wound. You take ⌈damage ÷ Armor⌉ Wounds (rounded up).',
            )}
          </p>
          <p className="mt-1 text-slate-400">
            {t('combat.woundHelpExample', 'Example: 6 damage with Armor 2 → 6 ÷ 2 = 3 Wounds.')}
          </p>
          <p className="mt-1 text-slate-400">
            {t(
              'combat.woundHelpUnit',
              'A Unit instead soaks up to its Armor and takes a single Wound; assign damage to a Unit to spare your Hero.',
            )}
          </p>
        </div>
      )}

      {unblockedDamage.map((src) => {
        const heroAmount = heroRemainingFor(src)
        const heroWounds = Math.ceil(heroAmount / Math.max(heroArmor, 1))
        const hasPoisonOrParalyze =
          src.abilities.includes('poison') || src.abilities.includes('paralyze')

        return (
          <div
            key={src.enemyInstanceId}
            className="rounded-xl border border-red-900/30 bg-slate-900/60 p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-red-300">
                  {src.enemyInstanceId}
                </span>
                <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[9px] font-bold text-slate-300">
                  {ELEMENT_ICON[src.element]} {t(ELEMENT_LABEL[src.element])}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-sm font-black text-red-400">
                  {src.damage} {t('combat.dmg')}
                </span>
                {hasPoisonOrParalyze && (
                  <span className="rounded bg-lime-900/40 px-1.5 py-0.5 text-[9px] font-bold text-lime-400">
                    {src.abilities.filter((a) => a === 'poison' || a === 'paralyze').join(' ')}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              {/* Hero — automatically absorbs whatever the Units don't */}
              <div className="flex items-center justify-between rounded-md border border-slate-700/40 bg-slate-800/60 px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{'❤️'}</span>
                  <span className="text-xs font-semibold text-slate-300">
                    {t('combat.heroLabel')} ({t('combat.armorLabel')} {heroArmor})
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {heroWounds > 0 && (
                    <span className="font-mono text-[10px] text-slate-500">
                      {heroAmount} ÷ {heroArmor} =
                    </span>
                  )}
                  <span className="font-mono text-sm font-bold text-red-300">{heroAmount}</span>
                  {heroWounds > 0 && (
                    <span
                      title={t('combat.woundFormula', {
                        damage: heroAmount,
                        armor: heroArmor,
                        wounds: heroWounds,
                        defaultValue: '{{damage}} damage ÷ Armor {{armor}} = {{wounds}} Wounds',
                      })}
                      className="rounded bg-red-900/50 px-1.5 py-0.5 text-[9px] font-bold text-red-300"
                    >
                      {heroWounds}
                      {t('combat.woundShort')}
                    </span>
                  )}
                </div>
              </div>

              {units.map((unit, unitIdx) => {
                const eligible = isUnitEligible(unit)
                const assignedHere = (unitOrder[src.enemyInstanceId] ?? []).includes(unitIdx)
                const assignedElsewhere =
                  !assignedHere && unitToEnemy[unitIdx] !== undefined
                const armor = getEffectiveUnitArmor(unit)
                const resistant = isUnitResistant(unit, src.element)

                // What this unit would soak if toggled on now
                const preview = eligible
                  ? unitAbsorption(unit, src.element, heroAmount, src.abilities.includes('poison'))
                  : { absorbed: 0, wounds: 0 }
                // No remaining damage to soak (and not already assigned here) → nothing to do
                const noDamageLeft = !assignedHere && heroAmount <= 0

                const disabled = !eligible || assignedElsewhere || noDamageLeft

                return (
                  <button
                    key={unitIdx}
                    type="button"
                    onClick={() => toggleUnit(src.enemyInstanceId, unitIdx)}
                    disabled={disabled}
                    className={[
                      'flex w-full items-center justify-between rounded-md border px-3 py-1.5 text-left transition-colors',
                      assignedHere
                        ? 'border-amber-600/50 bg-amber-950/40 hover:bg-amber-900/40'
                        : disabled
                          ? 'cursor-not-allowed border-slate-800/40 bg-slate-900/40 opacity-50'
                          : 'border-slate-700/40 bg-slate-800/60 hover:bg-slate-700/60',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{'🛡️'}</span>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-slate-300">
                          {unit.unit.name}
                        </span>
                        <span className="text-[9px] text-slate-500">
                          {t('combat.armorLabel')} {armor}
                          {resistant && (
                            <span className="ml-1 text-cyan-400">
                              · {t('combat.resists', 'resists')}
                            </span>
                          )}
                          {!eligible && (
                            <span className="ml-1 text-red-400">
                              · {t('combat.unitWounded', 'wounded')}
                            </span>
                          )}
                          {assignedElsewhere && (
                            <span className="ml-1 text-slate-400">
                              · {t('combat.unitAssignedElsewhere', 'used elsewhere')}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {assignedHere ? (
                        <>
                          <span className="font-mono text-xs font-bold text-amber-300">
                            −{resolveEnemy(src).find(
                              (a) => a.targetType === 'unit' && a.unitInstanceIndex === unitIdx,
                            )?.damageAbsorbed ?? 0}
                          </span>
                          {(resolveEnemy(src).find(
                            (a) => a.targetType === 'unit' && a.unitInstanceIndex === unitIdx,
                          )?.woundsInflicted ?? 0) > 0 && (
                            <span className="rounded bg-amber-800/40 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                              {resolveEnemy(src).find(
                                (a) => a.targetType === 'unit' && a.unitInstanceIndex === unitIdx,
                              )?.woundsInflicted}
                              {t('combat.woundShort')}
                            </span>
                          )}
                          <span className="text-[9px] font-bold text-amber-400">✓</span>
                        </>
                      ) : (
                        !disabled && (
                          <span className="text-[9px] text-slate-500">
                            {t('combat.soak', 'soak')} {preview.absorbed}
                            {preview.wounds === 0 && resistant && (
                              <span className="ml-1 text-cyan-400">
                                ({t('combat.noWound', 'no wound')})
                              </span>
                            )}
                          </span>
                        )
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      <button
        type="button"
        onClick={handleConfirm}
        className="min-h-[44px] w-full rounded-lg bg-red-700 py-3 text-sm font-bold tracking-wide text-white shadow-lg shadow-red-900/40 transition-all hover:bg-red-600 active:scale-[0.98]"
      >
        {t('combat.confirmDamage')}
      </button>
    </div>
  )
}
