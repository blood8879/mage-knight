import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useGameEngine } from '@/hooks/useGameEngine'
import { useGameStore } from '@/store/gameStore'
import { useCardTranslation } from '@/hooks/useCardTranslation'
import ManaStrip from '@/components/common/ManaStrip'
import { validateCardPlay } from '@/engine/CardPlayValidator'
import type {
  InteractionSiteType,
  AnyUnit,
  AdvancedActionCard,
  SpellCard,
  ArtifactCard,
  CityColor,
  ManaColor,
  DeedCard,
  CardEffect,
} from '@/engine/types'

// ── Site metadata ────────────────────────
const SITE_ICONS: Record<InteractionSiteType, string> = {
  village: '🏘️',
  monastery: '⛪',
  mageTower: '🗼',
  keep: '🏰',
  city: '🏙️',
}

const HEALING_COSTS: Partial<Record<InteractionSiteType, number>> = {
  village: 3,
  monastery: 2,
}

const AA_COST = 6
const SPELL_COST = 7
const ARTIFACT_COST = 12

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

// ── Helpers ──────────────────────────────
function canHealAtSite(siteType: InteractionSiteType): boolean {
  return siteType === 'village' || siteType === 'monastery'
}

function influenceValueOf(effect: CardEffect | null | undefined): number {
  if (!effect?.actions) return 0
  return effect.actions
    .filter((a) => a.type === 'influence')
    .reduce((sum, a) => sum + (a.value ?? 0), 0)
}

function getAvailableCardType(
  siteType: InteractionSiteType,
  cityColor?: CityColor,
): 'advanced_action' | 'spell' | 'artifact' | null {
  if (siteType === 'monastery') return 'advanced_action'
  if (siteType === 'mageTower') return 'spell'
  if (siteType === 'city' && cityColor === 'green') return 'advanced_action'
  if (siteType === 'city' && cityColor === 'blue') return 'spell'
  if (siteType === 'city' && cityColor === 'red') return 'artifact'
  return null
}

function getCityColorHint(
  cityColor: CityColor | undefined,
  t: (key: string) => string,
): string | null {
  if (!cityColor) return null
  const keyMap: Record<CityColor, string> = {
    green: 'interaction.cityGreen',
    blue: 'interaction.cityBlue',
    white: 'interaction.cityWhite',
    red: 'interaction.cityRed',
  }
  return t(keyMap[cityColor])
}

// ── Component ────────────────────────────
export default function InteractionPanel() {
  const { t } = useTranslation('ui')
  const phase = useGameStore((s) => s.phase)
  const engineState = useGameStore((s) => s.engineState)

  const engine = useGameEngine()

  const interaction = engineState?.interaction
  const isVisible = interaction?.isActive === true && phase === 'interaction'

  const siteType = interaction?.siteType ?? 'village'
  const influencePool = interaction?.influencePool ?? 0
  const cityColor = interaction?.cityColor
  const purchasesMade = interaction?.purchasesMade ?? []

  const { getCardName } = useCardTranslation()

  // Wounds in hand (for healing)
  const woundsInHand = useMemo(() => {
    if (!engineState) return 0
    return engineState.player.deck.hand.filter((c) => c.type === 'wound').length
  }, [engineState])

  // Hand cards playable for influence while the interaction is open.
  // Every non-wound card can go sideways (+1); cards whose effect grants
  // influence can also be played basic/strong (engine adds it to the pool).
  const playableHandCards = useMemo(() => {
    if (!engineState) return []
    const dayNight = engineState.dayNight
    const mana = engineState.player.mana
    const manaAvailability = {
      hasColor: (c: ManaColor) =>
        mana.playerMana.some((tk) => tk.color === c) || mana.crystals[c] > 0,
      hasBlack: dayNight === 'night' && mana.playerMana.some((tk) => tk.color === 'black'),
      hasGold: dayNight === 'day' && mana.playerMana.some((tk) => tk.color === 'gold'),
    }
    return engineState.player.deck.hand
      .map((card, handIndex) => ({ card, handIndex }))
      .filter((entry): entry is { card: DeedCard; handIndex: number } => entry.card.type !== 'wound')
      .map(({ card, handIndex }) => {
        const basicEffect = card.type === 'spell' ? card.basicSpell : card.basicEffect
        const strongEffect = card.type === 'spell' ? card.strongSpell : card.strongEffect
        const validation = validateCardPlay(card, dayNight, manaAvailability)
        return {
          card,
          handIndex,
          basicInfluence: influenceValueOf(basicEffect),
          strongInfluence: influenceValueOf(strongEffect),
          canPlayBasic: validation.canPlayBasic,
          canPlayStrong: validation.canPlayStrong,
        }
      })
  }, [engineState])

  // Cards available based on site type
  const cardType = getAvailableCardType(siteType, cityColor)

  const availableCards = useMemo(() => {
    if (!engineState || !cardType) return []
    if (cardType === 'advanced_action') {
      // EC-06-B-2: the monastery teaches AAs placed in the UNIT offer;
      // green cities use the regular AA offer
      if (siteType === 'monastery') {
        return engineState.offers.units.filter(
          (u): u is AdvancedActionCard => u.type === 'advanced_action',
        )
      }
      return engineState.offers.advancedActions
    }
    if (cardType === 'spell') return engineState.offers.spells
    if (cardType === 'artifact') {
      const deck = engineState.offers.artifactDeck
      return deck.length > 0 ? [deck[0]] : []
    }
    return []
  }, [engineState, cardType, siteType])

  const canSpendManaForSpell = useMemo(() => {
    if (!engineState || cardType !== 'spell') return (_color: ManaColor) => false
    const mana = engineState.player.mana
    const dayNight = engineState.dayNight
    return (color: ManaColor) => {
      if (mana.playerMana.some((t) => t.color === color)) return true
      if (dayNight === 'day' && mana.playerMana.some((t) => t.color === 'gold')) return true
      if (mana.crystals[color] > 0) return true
      return false
    }
  }, [engineState, cardType])

  // Units available for recruitment at this site type
  const availableUnits = useMemo(() => {
    if (!engineState) return []
    // Unit data uses snake_case site keys ('mage_tower'), site types are camelCase
    const recruitKey = (siteType === 'mageTower' ? 'mage_tower' : siteType) as AnyUnit['recruitSites'][number]
    return engineState.offers.units.filter((u): u is AnyUnit => {
      if (!('tier' in u)) return false
      const unit = u as AnyUnit
      // White cities have all unit types
      if (siteType === 'city' && cityColor === 'white') return true
      // Regular sites filter by recruitSites
      return unit.recruitSites.includes(recruitKey)
    })
  }, [engineState, siteType, cityColor])

  const unitLimitReached = useMemo(() => {
    if (!engineState) return false
    return engineState.player.units.length >= engineState.player.unitLimit
  }, [engineState])

  // Bonds of Loyalty: recruiting into the bonus (last) Command slot costs 5 less
  const bondsDiscountActive = useMemo(() => {
    if (!engineState) return false
    const hasBonds = engineState.player.skills.some((sk) =>
      sk.actions.some((a) => a.type === 'passive_command_bonus'),
    )
    return hasBonds && engineState.player.units.length === engineState.player.unitLimit - 1
  }, [engineState])

  // Influence skills usable during this interaction (UNIT-09-B)
  const influenceSkills = useMemo(() => {
    if (!engineState) return []
    const dayNight = engineState.dayNight
    const result: Array<{
      skill: (typeof engineState.player.skills)[number]
      skillIndex: number
      action: (typeof engineState.player.skills)[number]['actions'][number]
      actionIndex: number
    }> = []
    engineState.player.skills.forEach((skill, skillIndex) => {
      const used =
        skill.type === 'once_per_turn'
          ? skill.isUsedThisTurn
          : skill.type === 'passive'
            ? true
            : skill.isFlipped
      if (used) return
      skill.actions.forEach((action, actionIndex) => {
        if (action.type !== 'influence') return
        if (action.condition === 'day' && dayNight !== 'day') return
        if (action.condition === 'night' && dayNight !== 'night') return
        result.push({ skill, skillIndex, action, actionIndex })
      })
    })
    return result
  }, [engineState])

  // Healing
  const healingCost = HEALING_COSTS[siteType] ?? -1
  const canHeal = canHealAtSite(siteType) && woundsInHand > 0 && influencePool >= healingCost

  // Card costs
  function getCardCost(type: 'advanced_action' | 'spell' | 'artifact'): number {
    if (type === 'advanced_action') return AA_COST
    if (type === 'spell') return SPELL_COST
    return ARTIFACT_COST
  }

  const cityHint = getCityColorHint(cityColor, t)

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
            aria-label={t('interaction.title')}
            className="relative z-50 flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900 shadow-2xl shadow-black/60 ring-1 ring-white/5"
            style={{ maxHeight: 'calc(100vh - 1.5rem)' }}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* ── Header ── */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-700/50 bg-slate-800/80 px-3 py-2 sm:px-5 sm:py-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-xl">{SITE_ICONS[siteType]}</span>
                <h2 className="text-base font-bold tracking-wide text-slate-100 sm:text-lg">
                  {t(`interaction.site.${siteType}`)}
                </h2>
                {cityHint && (
                  <span className="rounded-full border border-slate-700/40 bg-slate-900/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 sm:px-3 sm:py-1 sm:text-xs">
                    {cityHint}
                  </span>
                )}
              </div>

              {/* ── Influence pool badge ── */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 sm:text-xs">
                  {t('interaction.influenceAvailable')}
                </span>
                <span className="rounded-lg border border-amber-700/30 bg-amber-950/40 px-2 py-0.5 font-mono text-sm font-black text-amber-300 sm:px-3 sm:py-1 sm:text-base">
                  {influencePool}
                </span>
              </div>
            </div>

            {/* ── Scrollable body ── */}
            <div className="flex-1 space-y-4 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
              {/* ── Hint text ── */}
              <div className="flex items-center gap-2 rounded-lg border border-slate-700/30 bg-slate-800/40 px-3 py-2">
                <span className="text-sm">💡</span>
                <p className="text-xs leading-relaxed text-slate-400">
                  {t('interaction.playCardsForInfluence')}
                </p>
              </div>

              {/* ── Mana pool — take Source dice / spend crystals mid-interaction ── */}
              <ManaStrip />

              {/* ── Hand cards → influence ── */}
              <SectionBlock
                icon="🃏"
                title={t('interaction.handSection', 'Play cards from hand')}
                accent="text-emerald-300"
              >
                {playableHandCards.length === 0 ? (
                  <p className="text-xs italic text-slate-600">
                    {t('interaction.emptyHand', 'No playable cards in hand')}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {playableHandCards.map(({ card, handIndex, basicInfluence, strongInfluence, canPlayBasic, canPlayStrong }) => (
                      <div
                        key={`${card.id}-${handIndex}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-700/40 bg-slate-800/50 px-2.5 py-1.5"
                      >
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-200">
                          {getCardName(card)}
                        </span>
                        <div className="flex shrink-0 gap-1">
                          {basicInfluence > 0 && (
                            <button
                              type="button"
                              disabled={!canPlayBasic}
                              onClick={() => engine.playCard(handIndex, 'basic')}
                              className={[
                                'rounded-md px-2 py-1 text-[10px] font-bold transition-all active:scale-95',
                                canPlayBasic
                                  ? 'bg-emerald-700 text-white hover:bg-emerald-600'
                                  : 'cursor-not-allowed bg-slate-800 text-slate-600',
                              ].join(' ')}
                            >
                              {t('interaction.playBasic', { defaultValue: 'Basic +{{value}}', value: basicInfluence })}
                            </button>
                          )}
                          {strongInfluence > 0 && (
                            <button
                              type="button"
                              disabled={!canPlayStrong}
                              onClick={() => engine.playCard(handIndex, 'strong')}
                              className={[
                                'rounded-md px-2 py-1 text-[10px] font-bold transition-all active:scale-95',
                                canPlayStrong
                                  ? 'bg-violet-700 text-white hover:bg-violet-600'
                                  : 'cursor-not-allowed bg-slate-800 text-slate-600',
                              ].join(' ')}
                            >
                              {t('interaction.playStrong', { defaultValue: 'Strong +{{value}}', value: strongInfluence })}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => engine.playSidewaysCard(handIndex, 'influence')}
                            className="rounded-md bg-slate-700 px-2 py-1 text-[10px] font-bold text-slate-200 transition-all hover:bg-slate-600 active:scale-95"
                          >
                            {t('interaction.playSideways', 'Sideways +1')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionBlock>

              {/* ── Purchase history ── */}
              {purchasesMade.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    {t('interaction.purchase')}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {purchasesMade.map((p, i) => (
                      <span
                        key={i}
                        className="rounded bg-emerald-900/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-300"
                      >
                        {p.itemName ?? p.type} ({p.cost})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Influence skills (UNIT-09-B) ── */}
              {influenceSkills.length > 0 && (
                <SectionBlock
                  icon="✨"
                  title={t('interaction.skillsSection', 'Skills')}
                  accent="text-amber-300"
                >
                  <div className="flex flex-wrap gap-1.5">
                    {influenceSkills.map(({ skill, skillIndex, action, actionIndex }) => (
                      <button
                        key={`${skill.id}-${actionIndex}`}
                        type="button"
                        onClick={() => engine.activateSkill(skillIndex, { actionIndex })}
                        className="rounded-lg bg-amber-800/50 px-3 py-1.5 text-xs font-semibold text-amber-100 transition-all hover:bg-amber-700/60 active:scale-95"
                      >
                        ✨ {skill.name} (+{action.value ?? 0} {t('game.influence', 'Influence')})
                      </button>
                    ))}
                  </div>
                </SectionBlock>
              )}

              {/* ── Healing Section ── */}
              {canHealAtSite(siteType) && (
                <SectionBlock
                  icon="❤️‍🩹"
                  title={t('interaction.healingSection')}
                  accent="text-rose-300"
                >
                  <p className="mb-2 text-xs text-slate-400">
                    {t('interaction.healingCost', { cost: healingCost })}
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={!canHeal}
                      onClick={() => engine.purchaseHealing(1)}
                      className={[
                        'min-h-[40px] rounded-lg px-4 py-2 text-sm font-bold shadow transition-all active:scale-[0.97]',
                        canHeal
                          ? 'bg-rose-600 text-white hover:bg-rose-500 shadow-rose-900/30'
                          : 'cursor-not-allowed bg-slate-800 text-slate-600',
                      ].join(' ')}
                    >
                      {t('interaction.healWound')}
                    </button>
                    <span className="text-xs text-slate-500">
                      {t('interaction.woundsInHand', { defaultValue: '{{count}} wound(s) in hand', count: woundsInHand })}
                    </span>
                  </div>
                  {!canHeal && influencePool < healingCost && woundsInHand > 0 && (
                    <p className="mt-1.5 text-[10px] font-semibold text-amber-400/70">
                      {t('interaction.notEnoughInfluence')}
                    </p>
                  )}
                </SectionBlock>
              )}

              {siteType === 'village' && (
                <SectionBlock
                  icon="🧺"
                  title={t('interaction.villageAidSection', 'Village aid')}
                  accent="text-amber-300"
                >
                  <p className="mb-2 text-xs text-slate-400">
                    {t('interaction.plunderVillageHint', 'Plunder for supplies: draw 2 cards and lose 1 Reputation.')}
                  </p>
                  <button
                    type="button"
                    disabled={engineState?.player.turn.hasPlunderedThisTurn === true}
                    onClick={() => engine.plunderVillage()}
                    className="min-h-[40px] rounded-lg bg-amber-700 px-4 py-2 text-sm font-bold text-white shadow shadow-amber-900/30 transition-all hover:bg-amber-600 active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500 disabled:shadow-none"
                  >
                    {engineState?.player.turn.hasPlunderedThisTurn
                      ? t('interaction.plunderVillageDone', 'Already plundered this turn')
                      : t('interaction.plunderVillage', 'Plunder Village')}
                  </button>
                </SectionBlock>
              )}

              {/* ── Cards Section ── */}
              {cardType && (
                <SectionBlock
                  icon="📜"
                  title={t('interaction.cardsSection')}
                  accent="text-violet-300"
                >
                  {availableCards.length === 0 ? (
                    <p className="text-xs italic text-slate-600">
                      {t('interaction.noCardsAvailable')}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {availableCards.map((card) => {
                        const cost = getCardCost(cardType)
                        const spellColor = cardType === 'spell' && 'color' in card
                          ? (Array.isArray(card.color) ? card.color[0] : card.color) as ManaColor
                          : undefined
                        const hasMana = spellColor ? canSpendManaForSpell(spellColor) : true
                        const canAfford = influencePool >= cost && hasMana
                        return (
                          <CardRow
                            key={card.id}
                            card={card}
                            cardType={cardType}
                            cost={cost}
                            canAfford={canAfford}
                            hasMana={hasMana}
                            requiredManaColor={spellColor}
                            onPurchase={() => {
                              if (cardType === 'advanced_action') {
                                if (siteType === 'monastery') {
                                  engine.purchaseMonasteryAA(card.id)
                                } else {
                                  engine.purchaseAdvancedAction(card.id)
                                }
                              } else if (cardType === 'spell') {
                                engine.purchaseSpell(card.id)
                              } else if (cardType === 'artifact') {
                                engine.purchaseArtifact()
                              }
                            }}
                            t={t}
                          />
                        )
                      })}
                    </div>
                  )}
                </SectionBlock>
              )}

              {/* ── Units Section ── */}
              <SectionBlock
                icon="⚔️"
                title={t('interaction.unitsSection')}
                accent="text-sky-300"
              >
                {unitLimitReached && (
                  <div className="mb-2 space-y-1.5">
                    <p className="text-[10px] font-semibold text-amber-400/70">
                      {t('interaction.unitLimitReached')} — {t('interaction.disbandHint', 'disband a unit to make room:')}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {engineState?.player.units.map((u, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => engine.disbandUnit(idx)}
                          className="rounded-lg bg-red-900/40 px-2.5 py-1 text-[10px] font-bold text-red-300 ring-1 ring-red-700/40 transition-all hover:bg-red-900/60 active:scale-95"
                        >
                          ✕ {u.unit.name}{u.bannerCard ? ' 🚩' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {siteType === 'city' && cityColor === 'white' && (
                  <button
                    type="button"
                    disabled={influencePool < 2 || (engineState?.offers.eliteUnitDeck.length ?? 0) === 0}
                    onClick={() => engine.payForEliteOffer()}
                    className={[
                      'mb-2 rounded-lg px-3 py-1.5 text-xs font-bold shadow transition-all active:scale-[0.97]',
                      influencePool >= 2 && (engineState?.offers.eliteUnitDeck.length ?? 0) > 0
                        ? 'bg-amber-600 text-white hover:bg-amber-500 shadow-amber-900/30'
                        : 'cursor-not-allowed bg-slate-800 text-slate-600',
                    ].join(' ')}
                  >
                    ✨ {t('interaction.revealElite', 'Reveal Elite Unit (2 influence)')}
                  </button>
                )}
                {availableUnits.length === 0 ? (
                  <p className="text-xs italic text-slate-600">
                    {t('interaction.noUnitsAvailable')}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {availableUnits.map((unit) => {
                      const effectiveCost = bondsDiscountActive ? Math.max(0, unit.cost - 5) : unit.cost
                      const canAfford = influencePool >= effectiveCost
                      return (
                        <UnitRow
                          key={unit.id}
                          unit={unit}
                          effectiveCost={effectiveCost}
                          canAfford={canAfford}
                          unitLimitReached={unitLimitReached}
                          onRecruit={() => engine.purchaseUnit(unit)}
                          t={t}
                        />
                      )
                    })}
                  </div>
                )}
              </SectionBlock>
            </div>

            {/* ── Footer actions ── */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-700/50 bg-slate-800/60 px-3 py-2 sm:px-5 sm:py-3">
              {/* Undo — the interaction panel covers the top bar's undo button,
                  so expose it here. Interaction actions all push undo states. */}
              <button
                type="button"
                onClick={() => engine.undoLastAction()}
                disabled={!engine.canUndo}
                className={[
                  'min-h-[44px] rounded-lg px-4 py-2.5 text-sm font-semibold shadow transition-all active:scale-[0.97]',
                  engine.canUndo
                    ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                    : 'cursor-not-allowed bg-slate-800 text-slate-600',
                ].join(' ')}
              >
                {'↩'} {t('game.undo', 'Undo')}
              </button>
              <button
                type="button"
                onClick={() => engine.endInteraction()}
                className="min-h-[44px] rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 transition-all hover:bg-emerald-600 active:scale-[0.97]"
              >
                {t('interaction.done')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

// ── Sub-components ───────────────────────

function SectionBlock({
  icon,
  title,
  accent,
  children,
}: {
  icon: string
  title: string
  accent: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-700/30 bg-slate-900/50 p-3 sm:p-4">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-sm">{icon}</span>
        <span
          className={[
            'text-[10px] font-bold uppercase tracking-widest',
            accent,
          ].join(' ')}
        >
          {title}
        </span>
      </div>
      {children}
    </div>
  )
}

const MANA_EMOJI: Record<ManaColor, string> = {
  red: '🔴',
  blue: '🔵',
  green: '🟢',
  white: '⚪',
}

function CardRow({
  card,
  cardType,
  cost,
  canAfford,
  hasMana,
  requiredManaColor,
  onPurchase,
  t,
}: {
  card: AdvancedActionCard | SpellCard | ArtifactCard
  cardType: 'advanced_action' | 'spell' | 'artifact'
  cost: number
  canAfford: boolean
  hasMana: boolean
  requiredManaColor?: ManaColor
  onPurchase: () => void
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  const labelKey =
    cardType === 'advanced_action'
      ? 'interaction.learnAA'
      : cardType === 'spell'
        ? 'interaction.learnSpell'
        : 'interaction.buyArtifact'

  const costLabel =
    cardType === 'advanced_action'
      ? t('interaction.learnAACost')
      : cardType === 'spell'
        ? t('interaction.learnSpellCost')
        : t('interaction.buyArtifactCost')

  const colorBadge: Record<string, string> = {
    red: 'border-red-700/40 bg-red-950/30 text-red-300',
    blue: 'border-sky-700/40 bg-sky-950/30 text-sky-300',
    green: 'border-emerald-700/40 bg-emerald-950/30 text-emerald-300',
    white: 'border-slate-600/40 bg-slate-800/40 text-slate-300',
  }

  const cardColor = 'color' in card && card.color
    ? (Array.isArray(card.color) ? card.color[0] : card.color)
    : 'white'

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-700/20 bg-slate-800/30 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-slate-200">
            {card.name}
          </span>
          <span
            className={[
              'shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase',
              colorBadge[cardColor] ?? colorBadge.white,
            ].join(' ')}
          >
            {cardColor}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">{costLabel}</span>
          {requiredManaColor && !hasMana && (
            <span className="text-[10px] font-semibold text-amber-400/70">
              {MANA_EMOJI[requiredManaColor]} {t('interaction.needsMana')}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        disabled={!canAfford}
        onClick={onPurchase}
        className={[
          'shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold shadow transition-all active:scale-[0.97]',
          canAfford
            ? 'bg-violet-600 text-white hover:bg-violet-500 shadow-violet-900/30'
            : 'cursor-not-allowed bg-slate-800 text-slate-600',
        ].join(' ')}
      >
        {requiredManaColor
          ? `${t(labelKey)} (${cost} + ${MANA_EMOJI[requiredManaColor]})`
          : `${t(labelKey)} (${cost})`}
      </button>
    </div>
  )
}

// Unit ability → icon + value chips (language-independent stat display)
const UNIT_ACTION_ICON: Record<string, string> = {
  attack: '⚔', ranged_attack: '🏹', siege_attack: '💥', block: '🛡',
  influence: '🤝', move: '👟', heal: '❤️‍🩹', healing: '❤️‍🩹',
}
const UNIT_ELEMENT_ICON: Record<string, string> = {
  fire: '🔥', ice: '❄️', cold_fire: '💜',
}

function unitStatChips(unit: AnyUnit): { key: string; icon: string; value: number; element?: string }[] {
  const chips: { key: string; icon: string; value: number; element?: string }[] = []
  unit.abilities.forEach((ability, ai) => {
    ability.actions.forEach((action, idx) => {
      const icon = UNIT_ACTION_ICON[action.type]
      if (!icon || typeof action.value !== 'number') return
      const element = typeof action.element === 'string' && action.element !== 'physical' ? action.element : undefined
      chips.push({ key: `${ai}-${idx}`, icon, value: action.value, element })
    })
  })
  return chips
}

export function UnitRow({
  unit,
  effectiveCost,
  canAfford,
  unitLimitReached,
  onRecruit,
  t,
}: {
  unit: AnyUnit
  effectiveCost?: number
  canAfford: boolean
  unitLimitReached: boolean
  onRecruit: () => void
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  const { getUnitName } = useCardTranslation()
  const canRecruit = canAfford && !unitLimitReached
  const cost = effectiveCost ?? unit.cost
  const chips = unitStatChips(unit)

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-700/20 bg-slate-800/30 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-slate-200">
            {getUnitName(unit)}
          </span>
          <span className="shrink-0 rounded bg-sky-900/30 px-1.5 py-0.5 text-[9px] font-bold text-sky-300">
            L{unit.level}
          </span>
          {unit.tier === 'elite' && (
            <span className="shrink-0 rounded bg-amber-900/30 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
              ELITE
            </span>
          )}
        </div>
        <span className="text-[10px] text-slate-500">
          {t('interaction.recruitCost', { cost })} · {t('game.armor', { defaultValue: 'Armor' })} {unit.armor}
          {cost < unit.cost && (
            <span className="ml-1 font-bold text-emerald-400">(-{unit.cost - cost})</span>
          )}
        </span>
        {chips.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {chips.map((c) => (
              <span
                key={c.key}
                className="inline-flex items-center gap-0.5 rounded bg-slate-700/40 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300"
              >
                {c.icon}{c.element ? UNIT_ELEMENT_ICON[c.element] ?? '' : ''} {c.value}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        disabled={!canRecruit}
        onClick={onRecruit}
        className={[
          'shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold shadow transition-all active:scale-[0.97]',
          canRecruit
            ? 'bg-sky-600 text-white hover:bg-sky-500 shadow-sky-900/30'
            : 'cursor-not-allowed bg-slate-800 text-slate-600',
        ].join(' ')}
      >
        {t('interaction.recruitUnit')} ({cost})
      </button>
    </div>
  )
}
