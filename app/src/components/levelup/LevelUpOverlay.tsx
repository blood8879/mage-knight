import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useCardTranslation } from '@/hooks/useCardTranslation'
import type { PendingLevelUp, HeroSkill, AdvancedActionCard } from '@/engine/types'

interface LevelUpOverlayProps {
  pending: PendingLevelUp | null
  commonSkills: HeroSkill[]
  aaOffer: AdvancedActionCard[]
  onResolve: (params: { choice?: 'A' | 'B'; skillIndex?: number; aaCardId?: number }) => void
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

const AA_COLOR_DOT: Record<string, string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
  white: 'bg-slate-200',
}

function SkillCard({
  skill,
  selected,
  onClick,
}: {
  skill: HeroSkill
  selected: boolean
  onClick: () => void
}) {
  const { t } = useTranslation('ui')
  const { t: tSkills } = useTranslation('heroSkills')
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full rounded-xl border px-3 py-2.5 text-left transition-all active:scale-[0.98]',
        selected
          ? 'border-amber-400 bg-amber-950/40 ring-1 ring-amber-400/60'
          : 'border-slate-700/50 bg-slate-800/60 hover:border-amber-500/40',
      ].join(' ')}
    >
      <span className="block text-sm font-bold text-slate-100">
        {tSkills(`${skill.id}.name`, { defaultValue: skill.name })}
      </span>
      <span className="mt-0.5 block text-[11px] leading-snug text-slate-400">
        {tSkills(`${skill.id}.effect`, { defaultValue: skill.effect })}
      </span>
      <span className="mt-1 inline-block rounded bg-slate-700/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
        {t(`skills.type.${skill.type}`, { defaultValue: skill.type.replace(/_/g, ' ') })}
      </span>
    </button>
  )
}

export default function LevelUpOverlay({
  pending,
  commonSkills,
  aaOffer,
  onResolve,
}: LevelUpOverlayProps) {
  const { t } = useTranslation('ui')
  const { getCardName, getCardBasicEffect } = useCardTranslation()
  const [choice, setChoice] = useState<'A' | 'B'>('A')
  const [skillIndex, setSkillIndex] = useState<number | null>(null)
  const [aaCardId, setAaCardId] = useState<number | null>(null)

  // Reset selections whenever a new pending level-up arrives
  useEffect(() => {
    setChoice('A')
    setSkillIndex(null)
    setAaCardId(null)
  }, [pending?.level])

  const isVisible = pending !== null
  const isSkillReward = pending?.rewardType === 'advanced_action_and_skill'
  const hasSkills = (pending?.revealedSkills.length ?? 0) > 0
  const canChooseB = commonSkills.length > 0

  // Choice B always takes the bottom card of the AA offer
  const bottomAA = aaOffer.length > 0 ? aaOffer[aaOffer.length - 1] : null

  const skillReady = !hasSkills || skillIndex !== null
  const aaReady = aaOffer.length === 0 || (choice === 'B' ? true : aaCardId !== null)
  const confirmReady = !isSkillReward || (skillReady && aaReady)

  const handleConfirm = () => {
    if (!pending) return
    if (!isSkillReward) {
      onResolve({})
      return
    }
    onResolve({
      choice,
      skillIndex: skillIndex ?? 0,
      aaCardId: choice === 'B' ? bottomAA?.id : (aaCardId ?? undefined),
    })
  }

  return createPortal(
    <AnimatePresence>
      {isVisible && pending && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-3"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          transition={{ duration: 0.22 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-hidden="true"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative z-50 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-amber-700/40 bg-slate-900 shadow-2xl shadow-amber-900/20 ring-1 ring-white/5"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Header */}
            <div className="border-b border-amber-700/30 bg-gradient-to-b from-amber-950/40 to-slate-900 px-5 py-3 text-center">
              <span className="text-2xl">{'⬆️'}</span>
              <h2 className="mt-0.5 text-lg font-black tracking-wide text-amber-300">
                {t('game.levelUp', 'Level Up!')}
              </h2>
              <p className="text-xs text-slate-400">
                {t('game.reachedLevel', 'Reached Level')} {pending.level}
              </p>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {/* Stat changes — always shown */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-slate-800/60 px-2 py-1.5">
                  <span className="block text-[9px] font-semibold uppercase tracking-widest text-slate-500">
                    {t('game.armor', 'Armor')}
                  </span>
                  <span className="font-mono text-base font-bold text-sky-300">{pending.newArmor}</span>
                </div>
                <div className="rounded-lg bg-slate-800/60 px-2 py-1.5">
                  <span className="block text-[9px] font-semibold uppercase tracking-widest text-slate-500">
                    {t('game.handLimit', 'Hand')}
                  </span>
                  <span className="font-mono text-base font-bold text-violet-300">{pending.newHandLimit}</span>
                </div>
                <div className="rounded-lg bg-slate-800/60 px-2 py-1.5">
                  <span className="block text-[9px] font-semibold uppercase tracking-widest text-slate-500">
                    {t('game.unitLimit', 'Units')}
                  </span>
                  <span className="font-mono text-base font-bold text-emerald-300">{pending.newUnitLimit}</span>
                </div>
              </div>

              {isSkillReward && (
                <>
                  {/* Choice A / B toggle */}
                  {hasSkills && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setChoice('A'); setSkillIndex(null); setAaCardId(null) }}
                        className={[
                          'flex-1 rounded-lg px-2 py-2 text-xs font-bold transition-all',
                          choice === 'A'
                            ? 'bg-amber-600 text-white shadow'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700',
                        ].join(' ')}
                      >
                        {t('game.levelUpChoiceA', 'A: New skill + any action')}
                      </button>
                      <button
                        type="button"
                        onClick={() => { if (canChooseB) { setChoice('B'); setSkillIndex(null); setAaCardId(null) } }}
                        disabled={!canChooseB}
                        className={[
                          'flex-1 rounded-lg px-2 py-2 text-xs font-bold transition-all',
                          choice === 'B'
                            ? 'bg-amber-600 text-white shadow'
                            : canChooseB
                              ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                              : 'cursor-not-allowed bg-slate-800/40 text-slate-600',
                        ].join(' ')}
                        title={!canChooseB ? t('game.levelUpNoCommon', 'No common skills available yet') : undefined}
                      >
                        {t('game.levelUpChoiceB', 'B: Common skill + bottom action')}
                      </button>
                    </div>
                  )}

                  {/* Skill selection */}
                  {hasSkills ? (
                    <div className="space-y-1.5">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                        {choice === 'A'
                          ? t('game.levelUpPickRevealed', 'Pick one of your revealed skills')
                          : t('game.levelUpPickCommon', 'Pick a skill from the common pool')}
                      </h3>
                      {(choice === 'A' ? pending.revealedSkills : commonSkills).map((skill, idx) => (
                        <SkillCard
                          key={skill.id}
                          skill={skill}
                          selected={skillIndex === idx}
                          onClick={() => setSkillIndex(idx)}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg bg-slate-800/50 px-3 py-2 text-xs text-slate-400">
                      {t('game.levelUpNoSkills', 'Your skill deck is empty — you still gain an Advanced Action.')}
                    </p>
                  )}

                  {/* AA selection */}
                  {aaOffer.length > 0 && (
                    <div className="space-y-1.5">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-violet-400">
                        {choice === 'B'
                          ? t('game.levelUpAABottom', 'You receive the bottom Advanced Action')
                          : t('game.levelUpPickAA', 'Pick an Advanced Action from the offer')}
                      </h3>
                      {(choice === 'B' && bottomAA ? [bottomAA] : aaOffer).map((card) => {
                        const colorKey = Array.isArray(card.color) ? card.color[0] : card.color
                        const isSelected = choice === 'B' || aaCardId === card.id
                        return (
                          <button
                            key={card.id}
                            type="button"
                            onClick={() => { if (choice === 'A') setAaCardId(card.id) }}
                            className={[
                              'flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all active:scale-[0.98]',
                              isSelected
                                ? 'border-violet-400 bg-violet-950/40 ring-1 ring-violet-400/60'
                                : 'border-slate-700/50 bg-slate-800/60 hover:border-violet-500/40',
                            ].join(' ')}
                          >
                            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${AA_COLOR_DOT[colorKey] ?? 'bg-slate-500'}`} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-bold text-slate-100">{getCardName(card)}</span>
                              <span className="block truncate text-[10px] text-slate-500">{getCardBasicEffect(card)}</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-700/50 bg-slate-800/60 px-4 py-3">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!confirmReady}
                className={[
                  'w-full min-h-[44px] rounded-lg py-2.5 text-sm font-bold shadow-lg transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2',
                  confirmReady
                    ? 'bg-amber-600 text-white shadow-amber-900/30 hover:bg-amber-500 focus-visible:ring-amber-400'
                    : 'cursor-not-allowed bg-slate-700 text-slate-500 shadow-none',
                ].join(' ')}
              >
                {t('game.continue', 'Continue')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
