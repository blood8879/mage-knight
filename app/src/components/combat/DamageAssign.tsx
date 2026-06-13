import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { EnemyAbility, DamageAssignment, UnitInstance } from '@/engine/types'
import { getEffectiveUnitArmor } from '@/utils/bannerUtils'

interface DamageSource {
  enemyInstanceId: string
  damage: number
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

interface LocalAssignment {
  enemyInstanceId: string
  totalDamage: number
  assignments: AssignmentTarget[]
}

function calcWounds(damageAbsorbed: number, armor: number): number {
  if (damageAbsorbed <= 0) return 0
  return Math.ceil(damageAbsorbed / Math.max(armor, 1))
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

  const [localAssignments, setLocalAssignments] = useState<LocalAssignment[]>(() =>
    unblockedDamage.map((src) => ({
      enemyInstanceId: src.enemyInstanceId,
      totalDamage: src.damage,
      assignments: [],
    })),
  )

  const totalAssigned = useMemo(
    () =>
      localAssignments.reduce(
        (sum, la) => la.assignments.reduce((s, a) => s + a.damageAbsorbed, sum),
        0,
      ),
    [localAssignments],
  )

  const remaining = totalIncoming - totalAssigned
  const isComplete = remaining === 0

  const assignToHero = useCallback(
    (enemyInstanceId: string, amount: number) => {
      setLocalAssignments((prev) =>
        prev.map((la) => {
          if (la.enemyInstanceId !== enemyInstanceId) return la
          const currentHeroAssigned = la.assignments
            .filter((a) => a.targetType === 'hero')
            .reduce((s, a) => s + a.damageAbsorbed, 0)
          const assignedToUnits = la.assignments
            .filter((a) => a.targetType === 'unit')
            .reduce((s, a) => s + a.damageAbsorbed, 0)
          const maxCanAssign = la.totalDamage - assignedToUnits
          const newAmount = Math.min(Math.max(0, amount), maxCanAssign)

          if (newAmount === currentHeroAssigned) return la

          const nonHeroAssignments = la.assignments.filter((a) => a.targetType !== 'hero')
          const heroAssignment: AssignmentTarget =
            newAmount > 0
              ? {
                  targetType: 'hero',
                  damageAbsorbed: newAmount,
                  woundsInflicted: calcWounds(newAmount, heroArmor),
                }
              : { targetType: 'hero', damageAbsorbed: 0, woundsInflicted: 0 }

          return {
            ...la,
            assignments:
              newAmount > 0
                ? [...nonHeroAssignments, heroAssignment]
                : nonHeroAssignments,
          }
        }),
      )
    },
    [heroArmor],
  )

  const assignToUnit = useCallback(
    (enemyInstanceId: string, unitIndex: number, amount: number) => {
      setLocalAssignments((prev) =>
        prev.map((la) => {
          if (la.enemyInstanceId !== enemyInstanceId) return la
          const otherAssigned = la.assignments
            .filter(
              (a) =>
                !(a.targetType === 'unit' && a.unitInstanceIndex === unitIndex),
            )
            .reduce((s, a) => s + a.damageAbsorbed, 0)
          const maxCanAssign = la.totalDamage - otherAssigned
          const newAmount = Math.min(Math.max(0, amount), maxCanAssign)

          const unitArmor = units[unitIndex] ? getEffectiveUnitArmor(units[unitIndex]) : 1
          const filtered = la.assignments.filter(
            (a) =>
              !(a.targetType === 'unit' && a.unitInstanceIndex === unitIndex),
          )

          if (newAmount <= 0) return { ...la, assignments: filtered }

          return {
            ...la,
            assignments: [
              ...filtered,
              {
                targetType: 'unit' as const,
                unitInstanceIndex: unitIndex,
                damageAbsorbed: newAmount,
                woundsInflicted: calcWounds(newAmount, unitArmor),
              },
            ],
          }
        }),
      )
    },
    [units],
  )

  const handleConfirm = useCallback(() => {
    if (!isComplete) return
    const result: DamageAssignment[] = localAssignments
      .filter((la) => la.assignments.length > 0)
      .map((la) => ({
        enemyInstanceId: la.enemyInstanceId,
        totalDamage: la.totalDamage,
        assignments: la.assignments,
      }))
    onConfirm(result)
  }, [isComplete, localAssignments, onConfirm])

  const getAssignedToHero = useCallback(
    (enemyInstanceId: string): number => {
      const la = localAssignments.find((a) => a.enemyInstanceId === enemyInstanceId)
      if (!la) return 0
      return la.assignments
        .filter((a) => a.targetType === 'hero')
        .reduce((s, a) => s + a.damageAbsorbed, 0)
    },
    [localAssignments],
  )

  const getAssignedToUnit = useCallback(
    (enemyInstanceId: string, unitIndex: number): number => {
      const la = localAssignments.find((a) => a.enemyInstanceId === enemyInstanceId)
      if (!la) return 0
      return la.assignments
        .filter(
          (a) => a.targetType === 'unit' && a.unitInstanceIndex === unitIndex,
        )
        .reduce((s, a) => s + a.damageAbsorbed, 0)
    },
    [localAssignments],
  )

  const assignAllToHero = useCallback(() => {
    setLocalAssignments((prev) =>
      prev.map((la) => ({
        ...la,
        assignments: [
          {
            targetType: 'hero' as const,
            damageAbsorbed: la.totalDamage,
            woundsInflicted: calcWounds(la.totalDamage, heroArmor),
          },
        ],
      })),
    )
  }, [heroArmor])

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
        <div className="flex items-center gap-2">
          <span className="text-xs text-red-400/70">{t('combat.remaining')}</span>
          <span
            className={[
              'rounded px-2 py-0.5 font-mono text-sm font-black',
              remaining > 0
                ? 'bg-red-700/50 text-red-200'
                : 'bg-emerald-800/50 text-emerald-300',
            ].join(' ')}
          >
            {remaining}
          </span>
        </div>
      </div>

      {unblockedDamage.map((src) => {
        const heroAmount = getAssignedToHero(src.enemyInstanceId)
        const hasPoisonOrParalyze =
          src.abilities.includes('poison') || src.abilities.includes('paralyze')

        return (
          <div
            key={src.enemyInstanceId}
            className="rounded-xl border border-red-900/30 bg-slate-900/60 p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-red-300">
                {src.enemyInstanceId}
              </span>
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
              <div className="flex items-center justify-between rounded-md border border-slate-700/40 bg-slate-800/60 px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{'\u2764\uFE0F'}</span>
                  <span className="text-xs font-semibold text-slate-300">
                    {t('combat.heroLabel')} ({t('combat.armorLabel')} {heroArmor})
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      assignToHero(src.enemyInstanceId, heroAmount - 1)
                    }
                    disabled={heroAmount <= 0}
                    className="flex h-9 w-9 items-center justify-center rounded bg-slate-700 text-sm font-bold text-slate-300 transition-colors hover:bg-slate-600 disabled:opacity-30"
                  >
                    -
                  </button>
                  <span className="w-6 text-center font-mono text-sm font-bold text-red-300">
                    {heroAmount}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      assignToHero(src.enemyInstanceId, heroAmount + 1)
                    }
                    disabled={remaining <= 0 && heroAmount >= src.damage}
                    className="flex h-9 w-9 items-center justify-center rounded bg-slate-700 text-sm font-bold text-slate-300 transition-colors hover:bg-slate-600 disabled:opacity-30"
                  >
                    +
                  </button>
                  {heroAmount > 0 && (
                    <span className="ml-1 rounded bg-red-900/50 px-1.5 py-0.5 text-[9px] font-bold text-red-300">
                      {calcWounds(heroAmount, heroArmor)}{t('combat.woundShort')}
                    </span>
                  )}
                </div>
              </div>

              {units.map((unit, unitIdx) => {
                const unitAmount = getAssignedToUnit(src.enemyInstanceId, unitIdx)
                return (
                  <div
                    key={unitIdx}
                    className="flex items-center justify-between rounded-md border border-slate-700/40 bg-slate-800/60 px-3 py-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{'\uD83D\uDEE1\uFE0F'}</span>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-slate-300">
                          {unit.unit.name}
                        </span>
                        <span className="text-[9px] text-slate-500">
                          {t('combat.armorLabel')} {getEffectiveUnitArmor(unit)} | {unit.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          assignToUnit(src.enemyInstanceId, unitIdx, unitAmount - 1)
                        }
                        disabled={unitAmount <= 0}
                        className="flex h-9 w-9 items-center justify-center rounded bg-slate-700 text-sm font-bold text-slate-300 transition-colors hover:bg-slate-600 disabled:opacity-30"
                      >
                        -
                      </button>
                      <span className="w-6 text-center font-mono text-sm font-bold text-red-300">
                        {unitAmount}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          assignToUnit(src.enemyInstanceId, unitIdx, unitAmount + 1)
                        }
                        disabled={remaining <= 0 && unitAmount >= src.damage}
                        className="flex h-9 w-9 items-center justify-center rounded bg-slate-700 text-sm font-bold text-slate-300 transition-colors hover:bg-slate-600 disabled:opacity-30"
                      >
                        +
                      </button>
                      {unitAmount > 0 && (
                        <span className="ml-1 rounded bg-red-900/50 px-1.5 py-0.5 text-[9px] font-bold text-red-300">
                          {calcWounds(unitAmount, getEffectiveUnitArmor(unit))}{t('combat.woundShort')}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {remaining > 0 && (
        <button
          type="button"
          onClick={assignAllToHero}
          className="min-h-[44px] w-full rounded-lg border border-red-700/40 bg-red-950/50 py-2.5 text-sm font-bold tracking-wide text-red-200 shadow transition-all hover:bg-red-900/60 active:scale-[0.98]"
        >
          {t('combat.assignAllToHero', 'Assign all damage to hero')}
        </button>
      )}

      <button
        type="button"
        onClick={handleConfirm}
        disabled={!isComplete}
        className={[
          'min-h-[44px] w-full rounded-lg py-3 text-sm font-bold tracking-wide shadow-lg transition-all active:scale-[0.98]',
          isComplete
            ? 'bg-red-700 text-white shadow-red-900/40 hover:bg-red-600'
            : 'cursor-not-allowed bg-slate-800 text-slate-600 shadow-none',
        ].join(' ')}
      >
        {isComplete ? t('combat.confirmDamage') : t('combat.assignMore', { count: remaining })}
      </button>
    </div>
  )
}
