import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useCardTranslation } from '@/hooks/useCardTranslation'
import type { PendingReward, SpellCard, ManaColor } from '@/engine/types'

interface RewardOverlayProps {
  reward: PendingReward | null
  spellOffer: SpellCard[]
  onClaim: (params: {
    artifactKeepIds?: number[]
    spellCardId?: number
    crystalColor?: ManaColor
    chooseArtifact?: boolean
  }) => void
}

const CRYSTAL_STYLE: Record<string, string> = {
  red: 'bg-red-500/20 text-red-300 ring-red-500/40',
  blue: 'bg-blue-500/20 text-blue-300 ring-blue-500/40',
  green: 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/40',
  white: 'bg-slate-200/20 text-slate-200 ring-slate-200/40',
  gold: 'bg-amber-500/20 text-amber-300 ring-amber-500/40',
  black: 'bg-slate-900 text-slate-400 ring-slate-500/40',
}

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

export default function RewardOverlay({ reward, spellOffer, onClaim }: RewardOverlayProps) {
  const { t } = useTranslation('ui')
  const { getCardName, getCardBasicEffect } = useCardTranslation()
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [crystalColor, setCrystalColor] = useState<ManaColor | null>(null)

  useEffect(() => {
    setSelectedIds([])
    setCrystalColor(null)
  }, [reward])

  if (!reward) return null

  const renderBody = () => {
    switch (reward.type) {
      case 'artifact_choice':
        return (
          <>
            <p className="text-center text-xs text-slate-400">
              {t('game.rewardArtifactPick', { defaultValue: `Choose ${reward.pickCount} artifact(s) to keep — the rest return to the deck.` })}
            </p>
            <div className="space-y-1.5">
              {reward.options.map((card) => {
                const isSelected = selectedIds.includes(card.id)
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => {
                      setSelectedIds((prev) =>
                        isSelected
                          ? prev.filter((id) => id !== card.id)
                          : prev.length < reward.pickCount
                            ? [...prev, card.id]
                            : [...prev.slice(1), card.id],
                      )
                    }}
                    className={[
                      'w-full rounded-xl border px-3 py-2.5 text-left transition-all active:scale-[0.98]',
                      isSelected
                        ? 'border-orange-400 bg-orange-950/40 ring-1 ring-orange-400/60'
                        : 'border-slate-700/50 bg-slate-800/60 hover:border-orange-500/40',
                    ].join(' ')}
                  >
                    <span className="block text-sm font-bold text-slate-100">◆ {getCardName(card)}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-slate-400">
                      {getCardBasicEffect(card)}
                    </span>
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              disabled={selectedIds.length !== reward.pickCount}
              onClick={() => onClaim({ artifactKeepIds: selectedIds })}
              className={[
                'w-full min-h-[44px] rounded-lg py-2.5 text-sm font-bold transition-all active:scale-[0.97]',
                selectedIds.length === reward.pickCount
                  ? 'bg-orange-600 text-white shadow-lg hover:bg-orange-500'
                  : 'cursor-not-allowed bg-slate-700 text-slate-500',
              ].join(' ')}
            >
              {t('game.claimReward', 'Claim Reward')}
            </button>
          </>
        )

      case 'spell_choice':
        return (
          <>
            <p className="text-center text-xs text-slate-400">
              {t('game.rewardSpellPick', 'Choose a spell from the offer — it goes on top of your deed deck.')}
            </p>
            <div className="space-y-1.5">
              {spellOffer.map((card) => {
                const isSelected = selectedIds[0] === card.id
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setSelectedIds([card.id])}
                    className={[
                      'w-full rounded-xl border px-3 py-2.5 text-left transition-all active:scale-[0.98]',
                      isSelected
                        ? 'border-cyan-400 bg-cyan-950/40 ring-1 ring-cyan-400/60'
                        : 'border-slate-700/50 bg-slate-800/60 hover:border-cyan-500/40',
                    ].join(' ')}
                  >
                    <span className="block text-sm font-bold text-slate-100">✦ {getCardName(card)}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-slate-400">
                      {getCardBasicEffect(card)}
                    </span>
                  </button>
                )
              })}
              {spellOffer.length === 0 && (
                <p className="py-2 text-center text-xs italic text-slate-600">
                  {t('game.rewardNoSpells', 'No spells available')}
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={spellOffer.length > 0 && selectedIds.length === 0}
              onClick={() => onClaim({ spellCardId: selectedIds[0] })}
              className={[
                'w-full min-h-[44px] rounded-lg py-2.5 text-sm font-bold transition-all active:scale-[0.97]',
                spellOffer.length === 0 || selectedIds.length > 0
                  ? 'bg-cyan-600 text-white shadow-lg hover:bg-cyan-500'
                  : 'cursor-not-allowed bg-slate-700 text-slate-500',
              ].join(' ')}
            >
              {t('game.claimReward', 'Claim Reward')}
            </button>
          </>
        )

      case 'artifact_or_spell':
        return (
          <>
            <p className="text-center text-xs text-slate-400">
              {t('game.rewardChooseType', 'The ancient ruins hold treasure. Choose your reward:')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onClaim({ chooseArtifact: true })}
                className="min-h-[56px] rounded-xl border border-orange-500/40 bg-orange-950/30 px-3 py-3 text-sm font-bold text-orange-200 transition-all hover:bg-orange-950/50 active:scale-[0.97]"
              >
                ◆ {t('game.artifact', 'Artifact')}
              </button>
              <button
                type="button"
                onClick={() => onClaim({ chooseArtifact: false })}
                className="min-h-[56px] rounded-xl border border-cyan-500/40 bg-cyan-950/30 px-3 py-3 text-sm font-bold text-cyan-200 transition-all hover:bg-cyan-950/50 active:scale-[0.97]"
              >
                ✦ {t('game.spell', 'Spell')}
              </button>
            </div>
          </>
        )

      case 'crystal_roll': {
        const rolled = reward.rolledColor
        return (
          <>
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs text-slate-400">{t('game.rewardCrystalRolled', 'Mana die rolled:')}</span>
              <span
                className={`flex h-14 w-14 items-center justify-center rounded-xl text-lg font-black uppercase ring-2 ${CRYSTAL_STYLE[rolled] ?? ''}`}
              >
                {rolled === 'black' ? '+1⭐' : rolled === 'gold' ? '✨' : '◆'}
              </span>
              <p className="text-center text-xs text-slate-400">
                {rolled === 'black'
                  ? t('game.rewardCrystalBlack', 'Black: you gain 1 Fame instead of a crystal.')
                  : rolled === 'gold'
                    ? t('game.rewardCrystalGold', 'Gold: choose any basic color crystal!')
                    : t('game.rewardCrystalBasic', { defaultValue: `You gain a ${rolled} crystal.` })}
              </p>
            </div>
            {rolled === 'gold' && (
              <div className="grid grid-cols-4 gap-2">
                {(['red', 'blue', 'green', 'white'] as ManaColor[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCrystalColor(c)}
                    className={[
                      'flex h-12 items-center justify-center rounded-lg text-xs font-bold uppercase ring-2 transition-all active:scale-[0.95]',
                      CRYSTAL_STYLE[c],
                      crystalColor === c ? 'ring-offset-2 ring-offset-slate-900 scale-105' : 'opacity-70',
                    ].join(' ')}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              disabled={rolled === 'gold' && crystalColor === null}
              onClick={() => onClaim({ crystalColor: crystalColor ?? undefined })}
              className={[
                'w-full min-h-[44px] rounded-lg py-2.5 text-sm font-bold transition-all active:scale-[0.97]',
                rolled !== 'gold' || crystalColor !== null
                  ? 'bg-violet-600 text-white shadow-lg hover:bg-violet-500'
                  : 'cursor-not-allowed bg-slate-700 text-slate-500',
              ].join(' ')}
            >
              {t('game.claimReward', 'Claim Reward')}
            </button>
          </>
        )
      }

      case 'unit_choice':
        return (
          <button
            type="button"
            onClick={() => onClaim({})}
            className="w-full min-h-[44px] rounded-lg bg-violet-600 py-2.5 text-sm font-bold text-white transition-all hover:bg-violet-500 active:scale-[0.97]"
          >
            {t('game.continue', 'Continue')}
          </button>
        )
    }
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        key={`reward-${reward.type}`}
        className="fixed inset-0 z-50 flex items-center justify-center p-3"
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="hidden"
        transition={{ duration: 0.22 }}
      >
        <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />
        <motion.div
          role="dialog"
          aria-modal="true"
          className="relative z-50 flex max-h-[85vh] w-full max-w-sm flex-col gap-3 overflow-y-auto rounded-xl border border-violet-700/40 bg-slate-900 p-4 shadow-2xl shadow-violet-900/20 ring-1 ring-white/5"
          variants={panelVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <div className="text-center">
            <span className="text-2xl">🎁</span>
            <h2 className="mt-0.5 text-lg font-black tracking-wide text-violet-300">
              {t('game.combatReward', 'Reward!')}
            </h2>
          </div>
          {renderBody()}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
