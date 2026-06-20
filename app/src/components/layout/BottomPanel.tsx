import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { useGameStore } from '@/store/gameStore'
import { useUIStore } from '@/store/uiStore'
import { useDragDrop } from '@/hooks/useDragDrop'
import { useCardTranslation } from '@/hooks/useCardTranslation'
import DragPreview from '@/components/cards/DragPreview'
import CardDetail from '@/components/cards/CardDetail'
import { validateCardPlay } from '@/engine/CardPlayValidator'
import type { AnyCard, CardColor, DeedCard, ManaColor, UnitStatus } from '@/engine/types'
import { translateValidationReason } from '@/utils/validationReason'

// Translates a validator reason via its stable key, falling back to the raw English reason
const CARD_COLOR_BG: Record<string, string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  white: 'bg-slate-200',
}

const CARD_TYPE_ICON: Record<string, string> = {
  basic_action: '⚔',
  advanced_action: '🗡',
  spell: '✦',
  artifact: '◆',
  wound: '⚡',
}

const UNIT_STATUS_STYLES: Record<UnitStatus, string> = {
  ready: 'bg-emerald-500/20 text-emerald-400 ring-emerald-500/30',
  spent: 'bg-slate-500/20 text-slate-500 ring-slate-500/30',
  wounded: 'bg-red-500/20 text-red-400 ring-red-500/30',
}

function getCardId(card: AnyCard): string | number {
  return card.type === 'wound' ? card.id : card.id
}


function getCardColor(card: AnyCard): CardColor | undefined {
  if (card.type === 'wound') return undefined
  return card.color
}

function renderColorStrip(color: CardColor | undefined) {
  if (!color) return <div className="h-1.5 w-full rounded-t bg-red-800/80" />

  if (Array.isArray(color)) {
    return (
      <div className="flex h-1.5 w-full overflow-hidden rounded-t">
        {color.map((c, i) => (
          <div
            key={`${c}-${i}`}
            className={`flex-1 ${CARD_COLOR_BG[c] ?? 'bg-slate-600'}`}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={`h-1.5 w-full rounded-t ${CARD_COLOR_BG[color] ?? 'bg-slate-600'}`}
    />
  )
}

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.9 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.05,
      type: 'spring' as const,
      damping: 22,
      stiffness: 320,
    },
  }),
  exit: {
    opacity: 0,
    y: 16,
    scale: 0.92,
    transition: { duration: 0.18 },
  },
}

interface BottomPanelProps {
  onCardDrop?: (handIndex: number, zoneId: string) => void
  onCardPlay?: (index: number, mode?: 'basic' | 'strong') => void
  onCardDiscard?: (index: number) => void
  onCardPlaySideways?: (index: number, type: 'move' | 'attack' | 'block' | 'influence') => void
  onDieClick?: (dieId: string) => void
  onCrystalClick?: (color: ManaColor) => void
  onUnitHeal?: (unitIndex: number) => void
  onBannerAbility?: (unitIndex: number) => void
  dragDrop?: ReturnType<typeof useDragDrop>
}

const DIE_BG: Record<string, string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  white: 'bg-slate-200',
  gold: 'bg-amber-400',
  black: 'bg-neutral-900 ring-1 ring-neutral-600',
}

export default function BottomPanel({ onCardDrop, onCardPlay, onCardDiscard, onCardPlaySideways, onDieClick, onCrystalClick, onUnitHeal, onBannerAbility, dragDrop }: BottomPanelProps) {
  const { t } = useTranslation('ui')
  const engineState = useGameStore((s) => s.engineState)
  const selectedCardId = useUIStore((s) => s.selectedCardId)
  const selectCard = useUIStore((s) => s.selectCard)
  const { getCardName, getUnitName } = useCardTranslation()
  // Card detail modal state
  const [detailCard, setDetailCard] = useState<DeedCard | null>(null)
  const [detailCardIndex, setDetailCardIndex] = useState<number>(-1)
  const [detailOpen, setDetailOpen] = useState(false)

  const localDrag = useDragDrop()
  const drag = dragDrop ?? localDrag

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      e.preventDefault()
      drag.updateDrag({ x: e.clientX, y: e.clientY })
    },
    [drag.updateDrag],
  )

  const handlePointerUp = useCallback(() => {
    const dragItem = drag.dragItem
    const target = drag.endDrag()
    if (target && dragItem !== null && onCardDrop) {
      onCardDrop(dragItem, target)
    }
  }, [drag.endDrag, drag.dragItem, onCardDrop])

  useEffect(() => {
    if (!drag.isDragging) return

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [drag.isDragging, handlePointerMove, handlePointerUp])

  if (!engineState) {
    return (
      <footer className="flex h-[140px] shrink-0 items-center justify-center border-t border-amber-500/15 bg-gradient-to-t from-slate-900 to-slate-800/90">
        <span className="text-sm text-slate-600">{t('game.loading', 'Loading...')}</span>
      </footer>
    )
  }

  const hand = engineState.player.deck.hand
  const units = engineState.player.units

  // Validate basic/strong playability for the card shown in the detail modal
  const dayNight = engineState.dayNight
  const mana = engineState.player.mana
  const manaAvailability = {
    hasColor: (c: ManaColor) =>
      mana.playerMana.some((tk) => tk.color === c) || mana.crystals[c] > 0,
    hasBlack: dayNight === 'night' && mana.playerMana.some((tk) => tk.color === 'black'),
    hasGold: dayNight === 'day' && mana.playerMana.some((tk) => tk.color === 'gold'),
  }
  const SUPPORTED_BANNER_STRONGS = new Set(['Banner of Courage', 'Banner of Fortitude'])
  const baseValidation = detailCard
    ? validateCardPlay(detailCard, dayNight, manaAvailability)
    : null
  // Banner strong effects not yet engine-supported are disabled rather than
  // silently doing nothing when thrown away
  const detailValidation =
    baseValidation &&
    detailCard?.type === 'artifact' &&
    detailCard.subtype === 'banner' &&
    !SUPPORTED_BANNER_STRONGS.has(detailCard.name)
      ? { ...baseValidation, canPlayStrong: false, reason: 'This banner’s strong effect is not supported yet' }
      : baseValidation

  const handleCardPointerDown = (index: number, e: React.PointerEvent) => {
    e.preventDefault()
    drag.startDrag(index, { x: e.clientX, y: e.clientY })
  }

  const selectedCardIndex = hand.findIndex((card) => getCardId(card) === selectedCardId)

  return (
    <footer className="flex shrink-0 flex-col border-t border-amber-500/15 bg-gradient-to-t from-slate-900 to-slate-800/90">
      {/* ── Compact mana strip (mobile only — desktop uses the sidebar) ── */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-800/80 px-2 py-1 lg:hidden">
        <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-violet-400/80">
          {t('track.manaSource', 'Source')}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {mana.dice.filter((d) => d.isInSource).map((die) => {
            const usable =
              (die.color !== 'gold' && die.color !== 'black') ||
              (die.color === 'gold' && dayNight === 'day') ||
              (die.color === 'black' && dayNight === 'night')
            return (
              <button
                key={die.id}
                type="button"
                onClick={() => usable && onDieClick?.(die.id)}
                disabled={!usable}
                className={`h-6 w-6 shrink-0 rounded-md ${DIE_BG[die.color] ?? 'bg-slate-600'} ${usable ? 'active:scale-90' : 'opacity-35 grayscale'} shadow transition-transform`}
                aria-label={`${die.color} mana die`}
              />
            )
          })}
        </div>
        {mana.playerMana.length > 0 && (
          <>
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-amber-400/80">
              {t('track.manaTokens', 'Mana')}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              {mana.playerMana.map((token, i) => (
                <span key={i} className={`h-4 w-4 shrink-0 rounded-full ${DIE_BG[token.color] ?? 'bg-slate-600'} shadow`} />
              ))}
            </div>
          </>
        )}
        <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-violet-400/80">
          💎
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {(['red', 'blue', 'green', 'white'] as ManaColor[]).map((color) => {
            const count = mana.crystals[color]
            return (
              <button
                key={color}
                type="button"
                disabled={count === 0}
                onClick={() => onCrystalClick?.(color)}
                className={`flex shrink-0 items-center gap-0.5 rounded-full bg-slate-800 px-1.5 py-0.5 active:scale-90 ${count === 0 ? 'opacity-35' : ''}`}
                aria-label={`${color} crystal`}
              >
                <span className={`h-2.5 w-2.5 rotate-45 ${DIE_BG[color]}`} />
                <span className="text-[10px] font-bold text-slate-300">{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Card hand ── */}
      <div data-tutorial="card-hand" className="relative flex min-h-[120px] items-end gap-2 overflow-x-auto px-2 pt-2 pb-1.5 sm:min-h-0 sm:gap-2 sm:px-3">
        {hand.length === 0 && (
          <span className="py-4 text-xs text-slate-600 italic">
            {t('game.noCards', 'No cards in hand')}
          </span>
        )}

        <AnimatePresence mode="popLayout">
          {hand.map((card, index) => {
            const id = getCardId(card)
            const isWound = card.type === 'wound'
            const isSelected = selectedCardId === id
            const isBeingDragged = drag.isDragging && drag.dragItem === index
            // Learn-by-Playing: tag what this card's basic effect provides so the
            // teaching guide can spotlight a specific card (e.g. a Move card).
            const effActs: Array<{ type?: string }> =
              (!isWound && ((card as unknown as { basicEffect?: { actions?: Array<{ type?: string }> }; basicSpell?: { actions?: Array<{ type?: string }> } }).basicEffect?.actions
                ?? (card as unknown as { basicSpell?: { actions?: Array<{ type?: string }> } }).basicSpell?.actions)) || []
            const givesMove = effActs.some((a) => a.type === 'move')
            const givesInfluence = effActs.some((a) => a.type === 'influence')
            const givesAttack = effActs.some((a) => (a.type ?? '').includes('attack'))

            return (
              <motion.button
                key={`${id}-${index}`}
                layout
                custom={index}
                data-learn-move={givesMove ? 'true' : undefined}
                data-learn-influence={givesInfluence ? 'true' : undefined}
                data-learn-attack={givesAttack ? 'true' : undefined}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onPointerDown={(e) => handleCardPointerDown(index, e)}
                onClick={() => {
                  if (!drag.isDragging) {
                    if (card.type !== 'wound') {
                      setDetailCard(card as DeedCard)
                      setDetailCardIndex(index)
                      setDetailOpen(true)
                    }
                    selectCard(isSelected ? null : (id as number))
                  }
                }}
                className={[
                  'group relative flex w-[68px] shrink-0 flex-col overflow-hidden rounded-md sm:w-[58px]',
                  'border touch-none select-none',
                  isWound
                    ? 'border-red-800/60 bg-red-950/60'
                    : 'border-slate-700/70 bg-slate-800',
                  isSelected
                    ? 'ring-2 ring-violet-400 ring-offset-1 ring-offset-slate-900 -translate-y-1 shadow-lg shadow-violet-500/20'
                    : 'hover:-translate-y-0.5 hover:border-slate-600',
                  isBeingDragged ? 'opacity-30 scale-95' : '',
                ].join(' ')}
              >
                {renderColorStrip(getCardColor(card))}

                <div className="flex flex-1 flex-col items-center justify-center px-1 py-2 sm:py-1.5">
                  <span className="text-base leading-none sm:text-sm">
                    {CARD_TYPE_ICON[card.type] ?? '?'}
                  </span>
                  <span
                    className={`mt-1 w-full truncate text-center text-[10px] font-medium leading-tight sm:text-[10px] ${
                      isWound ? 'text-red-400' : 'text-slate-300'
                    }`}
                  >
                    {getCardName(card)}
                  </span>
                </div>
              </motion.button>
            )
          })}
        </AnimatePresence>

        {/* ── Action buttons when card selected ── */}
        {selectedCardId != null && selectedCardIndex !== -1 && (
          <div className="sticky right-0 ml-auto flex shrink-0 flex-col gap-1.5 pl-2">
            <button
              data-tutorial="play-button"
              onClick={() => onCardPlay?.(selectedCardIndex)}
              className="min-h-[44px] rounded-md bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow transition-colors hover:bg-violet-500 sm:min-h-0 sm:px-2 sm:py-1 sm:text-xs"
            >
              {t('game.play', 'Play')}
            </button>
            <button
              data-tutorial="discard-button"
              onClick={() => onCardDiscard?.(selectedCardIndex)}
              className="min-h-[44px] rounded-md bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 shadow transition-colors hover:bg-slate-600 sm:min-h-0 sm:px-2 sm:py-1 sm:text-xs"
            >
              {t('game.discard', 'Discard')}
            </button>
          </div>
        )}
      </div>

      {/* ── Unit slots ── */}
      <div data-tutorial="units" className={`flex items-center gap-1.5 overflow-x-auto border-t border-slate-800 px-2 sm:gap-2 sm:px-3 ${units.length === 0 ? 'py-0.5' : 'py-1.5'}`}>
        {units.length === 0 && (
          <span className="text-[10px] text-slate-600 italic">
            {t('game.noUnits', 'No units recruited')}
          </span>
        )}

        {units.map((u, idx) => {
          const healCost = u.unit.level * u.woundCount
          const healing = engineState.player.turn.healingAvailable ?? 0
          const canHeal = u.woundCount > 0 && healing >= healCost && !!onUnitHeal
          const canCourageReady =
            u.bannerCard?.name === 'Banner of Courage' &&
            !u.bannerFlipped &&
            u.status === 'spent' &&
            !engineState.combat.isActive &&
            !!onBannerAbility
          if (canCourageReady) {
            return (
              <button
                key={`${u.unit.id}-${idx}`}
                type="button"
                onClick={() => onBannerAbility?.(idx)}
                title={t('game.courageReady', 'Banner of Courage: flip to ready this unit')}
                className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 sm:text-xs ${UNIT_STATUS_STYLES[u.status]} cursor-pointer ring-amber-400/70 hover:bg-amber-900/40 active:scale-95`}
              >
                <span className="max-w-[60px] truncate sm:max-w-[80px]">{getUnitName(u.unit)}</span>
                <span>🚩</span>
                <span className="font-bold text-amber-300">{t('game.ready', 'Ready')}↺</span>
              </button>
            )
          }
          return (
            <button
              key={`${u.unit.id}-${idx}`}
              type="button"
              disabled={!canHeal}
              onClick={() => canHeal && onUnitHeal?.(idx)}
              title={u.woundCount > 0 ? t('game.healUnitCost', { defaultValue: `Heal: ${healCost} healing point(s)`, cost: healCost }) : undefined}
              className={[
                'flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 sm:text-xs',
                UNIT_STATUS_STYLES[u.status],
                canHeal ? 'cursor-pointer ring-emerald-400/70 hover:bg-emerald-900/40 active:scale-95' : '',
              ].join(' ')}
            >
              <span className="max-w-[60px] truncate sm:max-w-[80px]">{getUnitName(u.unit)}</span>
              {u.bannerCard && <span title={getCardName(u.bannerCard)}>🚩</span>}
              {u.woundCount > 0 && (
                <span className="text-red-400">×{u.woundCount}</span>
              )}
              {canHeal && <span>💚</span>}
            </button>
          )
        })}
      </div>

      {/* ── Drag preview portal ── */}
      {drag.isDragging && drag.dragItem !== null && hand[drag.dragItem] && (
        <DragPreview
          card={hand[drag.dragItem]}
          x={drag.dragPosition.x}
          y={drag.dragPosition.y}
        />
      )}

      {/* ── Card detail modal ── */}
      <CardDetail
        card={detailCard}
        isOpen={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailCard(null) }}
        onPlayBasic={detailCardIndex >= 0 && onCardPlay && detailCard ? () => { onCardPlay(detailCardIndex, 'basic'); setDetailOpen(false); setDetailCard(null) } : undefined}
        onPlayStrong={detailCardIndex >= 0 && onCardPlay && detailCard ? () => { onCardPlay(detailCardIndex, 'strong'); setDetailOpen(false); setDetailCard(null) } : undefined}
        canPlayBasic={detailValidation?.canPlayBasic ?? true}
        basicDisabledReason={detailValidation && !detailValidation.canPlayBasic ? translateValidationReason(detailValidation, t) : undefined}
        canPlayStrong={detailValidation?.canPlayStrong ?? false}
        strongDisabledReason={detailValidation && !detailValidation.canPlayStrong ? translateValidationReason(detailValidation, t) : undefined}
        onDiscard={detailCardIndex >= 0 && onCardDiscard ? () => { onCardDiscard(detailCardIndex); setDetailOpen(false); setDetailCard(null) } : undefined}
        onPlaySideways={detailCardIndex >= 0 && onCardPlaySideways ? (type) => { onCardPlaySideways(detailCardIndex, type); setDetailOpen(false); setDetailCard(null) } : undefined}
      />
    </footer>
  )
}
