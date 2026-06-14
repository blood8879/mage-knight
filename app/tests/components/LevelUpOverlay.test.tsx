import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import '@/i18n/config' // initialize i18next
import LevelUpOverlay from '@/components/levelup/LevelUpOverlay'
import type { PendingLevelUp, HeroSkill, AdvancedActionCard } from '@/engine/types'

const LONG_EFFECT =
  '전투 시작 시 이 카드를 낸다. 이번 전투에서 당신의 모든 유닛의 공격 및 방어 수치가 2 증가한다. 이번 턴에는 유닛에게 피해를 배분할 수 없다.'

function makeAA(id: number, name: string, effectText: string): AdvancedActionCard {
  return {
    id,
    name,
    type: 'advanced_action',
    color: 'red',
    basicEffect: { text: effectText, actions: [{ type: 'attack', value: 2 }] },
    strongEffect: { text: 'strong', actions: [{ type: 'attack', value: 4 }] },
    set: 'base',
  }
}

function makeSkill(id: number, name: string, effect: string): HeroSkill {
  return { id, name, type: 'once_per_turn', effect, actions: [], isFlipped: false, isUsedThisTurn: false }
}

const pending: PendingLevelUp = {
  level: 2,
  rewardType: 'advanced_action_and_skill',
  newArmor: 2,
  newHandLimit: 5,
  newUnitLimit: 2,
  // id absent from locale data → SkillCard falls back to this effect text
  revealedSkills: [
    makeSkill(99006, 'Power of Pain', 'TEST_SKILL_EFFECT 상처 카드 1장을 옆으로 놓아 일반 카드처럼 사용할 수 있다.'),
  ],
}

// Use ids absent from the locale data so getCardBasicEffect falls back to card text.
const aaOffer = [
  makeAA(99001, 'Into the Heat', LONG_EFFECT),
  makeAA(99002, 'Song of Wind', '이동 2. 이번 턴 평원, 사막, 황무지의 이동 비용이 1 감소한다(최소 0).'),
]

describe('LevelUpOverlay — card description rendering', () => {
  it('renders Advanced Action descriptions in full (no single-line truncation)', () => {
    render(
      <LevelUpOverlay pending={pending} commonSkills={[]} aaOffer={aaOffer} onResolve={vi.fn()} />,
    )

    // The full long description text must be present in the DOM, not cut off.
    const desc = screen.getByText(LONG_EFFECT)
    expect(desc).toBeInTheDocument()

    // It must NOT use the single-line truncate utility (which clipped it before).
    expect(desc.className).not.toContain('truncate')
    // It should allow wrapping instead.
    expect(desc.className).toContain('break-words')
  })

  it('keeps the AA card name without truncation too', () => {
    render(
      <LevelUpOverlay pending={pending} commonSkills={[]} aaOffer={aaOffer} onResolve={vi.fn()} />,
    )
    const name = screen.getByText('Into the Heat')
    expect(name.className).not.toContain('truncate')
  })

  it('renders the panel with min-w-0 guard (prevents horizontal overflow clipping)', () => {
    render(
      <LevelUpOverlay pending={pending} commonSkills={[]} aaOffer={aaOffer} onResolve={vi.fn()} />,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('min-w-0')
    expect(dialog.className).toContain('max-w-md')
  })

  it('shows the revealed skill effect fully (multi-line, already worked)', () => {
    render(
      <LevelUpOverlay pending={pending} commonSkills={[]} aaOffer={aaOffer} onResolve={vi.fn()} />,
    )
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/TEST_SKILL_EFFECT/)).toBeInTheDocument()
  })
})

describe('LevelUpOverlay — choice B (common skill + bottom action)', () => {
  const dummySkill = makeSkill(99201, 'Flight', 'TEST_COMMON_SKILL')

  it('disables B and explains why when the Common pool is empty (first level-up)', () => {
    render(<LevelUpOverlay pending={pending} commonSkills={[]} aaOffer={aaOffer} onResolve={vi.fn()} />)
    const bBtn = screen.getByRole('button', { name: /^B:/ })
    expect(bBtn).toBeDisabled()
    // The reason is shown inline (visible on mobile, not just a hover title)
    expect(screen.getByText(/Common pool|공용 풀/)).toBeInTheDocument()
  })

  it('enables B when a common skill exists and reveals it on select', () => {
    render(<LevelUpOverlay pending={pending} commonSkills={[dummySkill]} aaOffer={aaOffer} onResolve={vi.fn()} />)
    const bBtn = screen.getByRole('button', { name: /^B:/ })
    expect(bBtn).toBeEnabled()
    fireEvent.click(bBtn)
    // The common-pool skill becomes selectable
    expect(screen.getByText('Flight')).toBeInTheDocument()
    expect(screen.getByText(/TEST_COMMON_SKILL/)).toBeInTheDocument()
  })

  it('resolves with choice B (common skill index + bottom AA)', () => {
    const onResolve = vi.fn()
    render(<LevelUpOverlay pending={pending} commonSkills={[dummySkill]} aaOffer={aaOffer} onResolve={onResolve} />)
    fireEvent.click(screen.getByRole('button', { name: /^B:/ }))
    fireEvent.click(screen.getByText('Flight')) // pick the common skill
    fireEvent.click(screen.getByRole('button', { name: /Continue|계속/ }))
    expect(onResolve).toHaveBeenCalledWith(expect.objectContaining({ choice: 'B', skillIndex: 0 }))
  })
})
