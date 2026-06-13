import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { EnemyAbility } from '@/engine/types'
import { getAbilityMeta } from '@/components/combat/enemyAbilityMeta'

interface AbilityChipProps {
  ability: EnemyAbility
  /** Tailwind text-size class for the chip label (default text-[10px]) */
  size?: string
}

const TOOLTIP_W = 208 // px (matches w-52); clamped to viewport on open

/**
 * Enemy ability chip with an explanatory tooltip.
 * Works on both desktop and mobile:
 *  - desktop: hover shows the tooltip
 *  - mobile: tap toggles it; tapping elsewhere (or another chip) closes it
 * The tooltip is portaled to <body> and clamped inside the viewport so it is
 * never clipped at the screen edges.
 */
export default function AbilityChip({ ability, size = 'text-[10px]' }: AbilityChipProps) {
  const { t } = useTranslation('ui')
  const meta = getAbilityMeta(ability)
  const label = t(meta.labelKey, { defaultValue: ability.replace(/_/g, ' ') })
  const desc = meta.descKey ? t(meta.descKey, { defaultValue: '' }) : ''
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null)
  const ref = useRef<HTMLSpanElement>(null)
  const tooltipId = useId()
  const hasTooltip = desc.length > 0

  const place = () => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const vw = window.innerWidth || 360
    const width = Math.min(TOOLTIP_W, vw - 16)
    const left = Math.max(8, Math.min(r.left + r.width / 2 - width / 2, vw - width - 8))
    setPos({ left, top: r.top, width })
  }

  const show = () => {
    if (!hasTooltip) return
    place()
    setOpen(true)
  }

  // Close when tapping/clicking or scrolling outside (mobile-friendly dismissal)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onScroll = () => setOpen(false)
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-label={hasTooltip ? `${label}: ${desc}` : label}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={hasTooltip ? open : undefined}
        onClick={(e) => {
          e.stopPropagation()
          if (hasTooltip) (open ? setOpen(false) : show())
        }}
        onMouseEnter={show}
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
      {open && hasTooltip && pos &&
        createPortal(
          <span
            id={tooltipId}
            role="tooltip"
            style={{ left: pos.left, top: pos.top, width: pos.width }}
            className="pointer-events-none fixed z-[80] -translate-y-full -mt-1.5 rounded-lg border border-slate-600/70 bg-slate-900 px-2.5 py-1.5 text-left text-[11px] font-medium leading-snug text-slate-200 shadow-xl shadow-black/50"
          >
            <span className={`mb-0.5 block font-bold ${meta.color}`}>{label}</span>
            {desc}
          </span>,
          document.body,
        )}
    </span>
  )
}
