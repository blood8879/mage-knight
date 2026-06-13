import { useTranslation } from 'react-i18next'
import type { EnemyInstance, EnemyColor, AttackType } from '@/engine/types'
import AbilityChip from '@/components/combat/AbilityChip'

const ENEMY_COLOR_STYLES: Record<EnemyColor, { bg: string; border: string; glow: string }> = {
  green: {
    bg: 'bg-emerald-950/80',
    border: 'border-emerald-600/50',
    glow: 'shadow-emerald-900/40',
  },
  grey: {
    bg: 'bg-zinc-900/80',
    border: 'border-zinc-500/50',
    glow: 'shadow-zinc-800/40',
  },
  violet: {
    bg: 'bg-purple-950/80',
    border: 'border-purple-500/50',
    glow: 'shadow-purple-900/40',
  },
  brown: {
    bg: 'bg-amber-950/80',
    border: 'border-amber-700/50',
    glow: 'shadow-amber-900/40',
  },
  red: {
    bg: 'bg-red-950/80',
    border: 'border-red-500/50',
    glow: 'shadow-red-900/40',
  },
  white: {
    bg: 'bg-slate-800/80',
    border: 'border-slate-300/50',
    glow: 'shadow-slate-400/20',
  },
}

const ATTACK_TYPE_ICON: Record<AttackType, string> = {
  normal: '\u2694\uFE0F',
  fire: '\uD83D\uDD25',
  ice: '\u2744\uFE0F',
  cold_fire: '\uD83D\uDCA0',
  summon: '\uD83D\uDC7B',
}

interface EnemyCardProps {
  enemy: EnemyInstance
  isSelected?: boolean
  onClick?: () => void
  showDetails?: boolean
}

export default function EnemyCard({
  enemy,
  isSelected = false,
  onClick,
  showDetails = false,
}: EnemyCardProps) {
  const { t } = useTranslation('ui')
  const { t: tEnemies } = useTranslation('enemies')
  const colorStyle = ENEMY_COLOR_STYLES[enemy.token.color]
  const isDefeated = enemy.isDefeated
  const isBlocked = enemy.isBlocked

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDefeated}
      className={[
        'relative flex w-20 flex-col rounded-lg border p-1.5 shadow-lg transition-all duration-200',
        colorStyle.bg,
        colorStyle.border,
        colorStyle.glow,
        isSelected && !isDefeated
          ? 'ring-2 ring-amber-400/80 scale-105'
          : '',
        isDefeated
          ? 'opacity-35 grayscale pointer-events-none'
          : 'cursor-pointer hover:scale-105 hover:brightness-110 active:scale-95',
        isBlocked && !isDefeated
          ? 'ring-2 ring-sky-400/60'
          : '',
      ].join(' ')}
    >
      {isBlocked && !isDefeated && (
        <div className="absolute inset-0 rounded-lg bg-sky-500/10 pointer-events-none" />
      )}

      {enemy.isFortified && !isDefeated && (
        <div className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[8px] font-black text-amber-950 shadow-md shadow-amber-600/40">
          F
        </div>
      )}

      {isDefeated && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg">
          <span className="text-2xl opacity-60">\u2716</span>
        </div>
      )}

      <span className="mb-0.5 truncate text-center text-[9px] font-bold leading-tight text-slate-200">
        {tEnemies(`${enemy.token.id}.name`, { defaultValue: enemy.token.name })}
      </span>

      <div className="flex items-center justify-between gap-1 px-0.5">
        <div className="flex items-center gap-0.5" title={`Armor: ${enemy.currentArmor}`}>
          <span className="text-[10px]">{'\uD83D\uDEE1\uFE0F'}</span>
          <span className="font-mono text-[10px] font-bold text-slate-300">
            {enemy.currentArmor}
          </span>
        </div>
        <div
          className="flex items-center gap-0.5"
          title={`Attack: ${enemy.currentAttack} (${enemy.currentAttackType})`}
        >
          <span className="text-[10px]">{ATTACK_TYPE_ICON[enemy.currentAttackType]}</span>
          <span className="font-mono text-[10px] font-bold text-red-300">
            {enemy.currentAttack}
          </span>
        </div>
      </div>

      {showDetails && enemy.appliedAbilities.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-0.5">
          {enemy.appliedAbilities.map((ability, idx) => (
            <AbilityChip key={`${ability}-${idx}`} ability={ability} size="text-[7px]" />
          ))}
        </div>
      )}

      {!showDetails && enemy.appliedAbilities.length > 0 && (
        <div className="mt-0.5 text-center">
          <span className="text-[7px] text-slate-500">
            {enemy.appliedAbilities.length} {t(enemy.appliedAbilities.length !== 1 ? 'combat.abilities_other' : 'combat.abilities_one')}
          </span>
        </div>
      )}

      <div className="mt-0.5 text-center">
        <span className="font-mono text-[8px] text-amber-400/70">
          {enemy.token.fameReward} {t('combat.fame')}
        </span>
      </div>
    </button>
  )
}
