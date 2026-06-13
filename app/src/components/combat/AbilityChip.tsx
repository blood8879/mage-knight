import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { EnemyAbility } from '@/engine/types'
import { getAbilityMeta } from '@/components/combat/enemyAbilityMeta'

interface AbilityChipProps {
  ability: EnemyAbility
  /** Tailwind text-size class for the chip label (default text-[10px]) */
  size?: string
}

/**
 * Enemy ability chip with an explanatory tooltip.
 * Works on both desktop and mobile:
 *  - desktop: hover shows the tooltip
 *  - mobile: tap toggles it; tapping elsewhere (or another chip) closes it
 */
export default function AbilityChip({ ability, size = 'text-[10px]' }: AbilityChipProps) {
  const { t } = useTranslation('ui')
  const meta = getAbilityMeta(ability)
  const label = t(meta.labelKey, { defaultValue: ability.replace(/_/g, ' ') })
  const desc = meta.descKey ? t(meta.descKey, { defaultValue: '' }) : ''
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const tooltipId = useId()

  // Close when tapping/clicking outside (mobile-friendly dismissal)
  useEffect(() => {
    if (!open) return
    const handler = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [open])

  const hasTooltip = desc.length > 0

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-label={hasTooltip ? `${label}: ${desc}` : label}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={hasTooltip ? open : undefined}
        onClick={(e) => {
          e.stopPropagation()
          if (hasTooltip) setOpen((o) => !o)
        }}
        onMouseEnter={() => hasTooltip && setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className={[
          'rounded bg-slate-700/60 px-1.5 py-0.5 font-semibold leading-none transition-colors',
          size,
          meta.color,
          hasTooltip ? 'cursor-help underline decoration-dotted decoration-slate-500 underline-offset-2 hover:bg-slate-600/70' : '',
        ].join(' ')}
      >
        {label}
      </button>
      {open && hasTooltip && (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-1.5 w-48 -translate-x-1/2 rounded-lg border border-slate-600/70 bg-slate-900 px-2.5 py-1.5 text-left text-[11px] font-medium leading-snug text-slate-200 shadow-xl shadow-black/50"
        >
          <span className={`mb-0.5 block font-bold ${meta.color}`}>{label}</span>
          {desc}
          <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-b border-r border-slate-600/70 bg-slate-900" />
        </span>
      )}
    </span>
  )
}
