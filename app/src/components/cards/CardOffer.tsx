import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AdvancedActionCard, SpellCard, AnyUnit, CardColor } from '@/engine/types'
import { useCardTranslation } from '@/hooks/useCardTranslation'

type OfferItem = AdvancedActionCard | SpellCard | AnyUnit

const COLOR_STRIP: Record<string, string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
  white: 'bg-slate-200',
}

const COLOR_BG_TINT: Record<string, string> = {
  red: 'from-red-950/30',
  blue: 'from-blue-950/30',
  green: 'from-emerald-950/30',
  white: 'from-slate-600/10',
}

const OFFER_HEADER: Record<string, { title: string; accent: string; icon: string }> = {
  advanced_action: { title: 'Advanced Actions', accent: 'text-violet-400', icon: '🗡' },
  spell: { title: 'Spells', accent: 'text-cyan-400', icon: '✦' },
  unit: { title: 'Units', accent: 'text-amber-400', icon: '🛡' },
}

const TIER_STYLE: Record<string, string> = {
  regular: 'bg-slate-600/30 text-slate-400',
  elite: 'bg-amber-700/30 text-amber-300',
}

function isUnit(item: OfferItem): item is AnyUnit {
  return 'tier' in item && 'armor' in item && 'cost' in item
}

function getOfferCardColor(item: OfferItem): CardColor | undefined {
  if (isUnit(item)) return undefined
  return item.color
}

function getPrimaryColorKey(color: CardColor | undefined): string {
  if (!color) return 'white'
  if (Array.isArray(color)) return color[0] ?? 'white'
  return color
}

function renderOfferColorBar(color: CardColor | undefined) {
  if (!color) return null

  if (Array.isArray(color)) {
    return (
      <div className="flex h-1 w-full overflow-hidden rounded-t-md">
        {color.map((c, i) => (
          <div key={`${c}-${i}`} className={`flex-1 ${COLOR_STRIP[c] ?? 'bg-slate-600'}`} />
        ))}
      </div>
    )
  }

  return <div className={`h-1 w-full rounded-t-md ${COLOR_STRIP[color] ?? 'bg-slate-600'}`} />
}


function renderUnitCard(
  item: AnyUnit,
  idx: number,
  isSelected: boolean,
  onSelect: (idx: number) => void,
  translatedName: string,
  translatedEffect: string,
  vertical: boolean,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  return (
    <button
      key={`unit-${item.id}-${idx}`}
      onClick={() => onSelect(idx)}
      className={[
        'group flex overflow-hidden rounded-lg',
        vertical ? 'w-full flex-col' : 'w-[130px] shrink-0 flex-col sm:w-[150px]',
        'border transition-all duration-200',
        'border-slate-700/60 bg-slate-800/80',
        isSelected
          ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-900 -translate-y-1 shadow-lg shadow-amber-500/20'
          : vertical ? 'hover:border-slate-600' : 'hover:-translate-y-0.5 hover:border-slate-600',
      ].join(' ')}
    >
      <div className="flex items-center justify-between bg-slate-700/30 px-2.5 py-1.5">
        <span className="truncate text-xs font-bold text-slate-100">{translatedName}</span>
        <span className={`ml-1 shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold ${TIER_STYLE[item.tier] ?? ''}`}>
          {item.tier === 'elite' ? 'ELITE' : 'REG'}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 px-2.5 py-2">
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-slate-500">{t('offer.levelShort', { defaultValue: 'Lv' })}</span>
          <span className="font-bold text-slate-200">{item.level}</span>
          <span className="text-slate-700">│</span>
          <span className="text-slate-500">{t('offer.costShort', { defaultValue: 'Cost' })}</span>
          <span className="font-bold text-amber-400">{item.cost}</span>
          <span className="text-slate-700">│</span>
          <span className="text-slate-500">{t('offer.armorShort', { defaultValue: 'Arm' })}</span>
          <span className="font-bold text-blue-400">{item.armor}</span>
        </div>

        <p className="line-clamp-2 text-[10px] leading-snug text-slate-400">
          {translatedEffect}
        </p>

        {item.recruitSites.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-0.5">
            {item.recruitSites.map((site) => (
              <span
                key={site}
                className="rounded bg-slate-700/50 px-1 py-0.5 text-[8px] font-medium text-slate-500"
              >
                {t(`recruitSite.${site}`, { defaultValue: site })}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  )
}

function renderDeedCard(
  item: AdvancedActionCard | SpellCard,
  idx: number,
  isSelected: boolean,
  onSelect: (idx: number) => void,
  translatedName: string,
  translatedEffect: string,
  vertical: boolean,
  typeLabels: Record<'spell' | 'advanced_action', string>,
) {
  const color = getOfferCardColor(item)
  const primary = getPrimaryColorKey(color)
  const bgTint = COLOR_BG_TINT[primary] ?? COLOR_BG_TINT.white

  const typeLabel = typeLabels[item.type === 'spell' ? 'spell' : 'advanced_action']
  const typeIcon = item.type === 'spell' ? '✦' : '🗡'

  return (
    <button
      key={`deed-${item.id}-${idx}`}
      onClick={() => onSelect(idx)}
      className={[
        'group flex overflow-hidden rounded-lg',
        vertical ? 'w-full flex-col' : 'w-[130px] shrink-0 flex-col sm:w-[150px]',
        `border bg-gradient-to-b ${bgTint} to-slate-800/80`,
        'transition-all duration-200',
        isSelected
          ? 'border-violet-500/60 ring-2 ring-violet-400 ring-offset-1 ring-offset-slate-900 -translate-y-1 shadow-lg shadow-violet-500/20'
          : vertical ? 'border-slate-700/60 hover:border-slate-600' : 'border-slate-700/60 hover:-translate-y-0.5 hover:border-slate-600',
      ].join(' ')}
    >
      {renderOfferColorBar(color)}

      <div className="flex items-center justify-between px-2.5 py-1.5">
        <span className="truncate text-xs font-bold text-slate-100">{translatedName}</span>
        <span className="ml-1 shrink-0 text-sm">{typeIcon}</span>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 px-2.5 pb-2">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
          {typeLabel}
        </span>

        <p className="line-clamp-3 text-[10px] leading-snug text-slate-400">
          {translatedEffect}
        </p>
      </div>
    </button>
  )
}

interface CardOfferProps {
  cards: Array<AdvancedActionCard | SpellCard | AnyUnit>
  type: 'advanced_action' | 'spell' | 'unit'
  onSelect?: (index: number) => void
  title?: string
  /** 'horizontal' = fixed-width cards in a scrollable row (default).
   *  'vertical' = full-width cards stacked in a column (for sidebar / drawer). */
  layout?: 'horizontal' | 'vertical'
}

export default function CardOffer({ cards, type, onSelect, title, layout = 'horizontal' }: CardOfferProps) {
  const { t } = useTranslation('ui')
  const { getOfferItemName, getOfferItemEffect } = useCardTranslation()
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const header = OFFER_HEADER[type] ?? OFFER_HEADER.advanced_action
  const headerTitle = t(`game.offerHeader.${type}`, { defaultValue: header.title })
  const typeLabels = {
    spell: t('game.offerTypeSpell', { defaultValue: 'Spell' }),
    advanced_action: t('game.offerTypeAdvAction', { defaultValue: 'Adv. Action' }),
  }

  function handleSelect(idx: number) {
    const next = selectedIndex === idx ? null : idx
    setSelectedIndex(next)
    if (next != null) onSelect?.(next)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <span className="text-base">{header.icon}</span>
        <h3 className={`text-sm font-bold tracking-wide ${header.accent}`}>
          {title ?? headerTitle}
        </h3>
        <span className="ml-auto rounded-full bg-slate-700/40 px-2 py-0.5 text-[10px] font-medium text-slate-500">
          {cards.length}
        </span>
      </div>

      <div className={layout === 'vertical' ? 'flex flex-col gap-2' : 'flex gap-2 overflow-x-auto pb-1'}>
        {cards.length === 0 && (
          <span className="py-4 text-xs text-slate-600 italic">{t('game.noCardsAvailable', { defaultValue: 'No cards available' })}</span>
        )}

        {cards.map((item, idx) => {
          const isSelected = selectedIndex === idx
          const isVertical = layout === 'vertical'

          if (isUnit(item)) {
            return renderUnitCard(item, idx, isSelected, handleSelect, getOfferItemName(item), getOfferItemEffect(item), isVertical, t)
          }

          return renderDeedCard(
            item as AdvancedActionCard | SpellCard,
            idx,
            isSelected,
            handleSelect,
            getOfferItemName(item),
            getOfferItemEffect(item),
            isVertical,
            typeLabels,
          )
        })}
      </div>
    </div>
  )
}
