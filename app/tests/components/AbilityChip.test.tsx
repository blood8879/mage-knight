import { describe, it, expect, afterAll, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import i18n from '@/i18n/config'
import AbilityChip from '@/components/combat/AbilityChip'

describe('AbilityChip — ability tooltips (mobile tap + desktop hover)', () => {
  beforeEach(async () => { await i18n.changeLanguage('ko') })
  afterAll(async () => { await i18n.changeLanguage('en') })

  it('shows the localized label and is collapsed by default', () => {
    render(<AbilityChip ability="paralyze" />)
    expect(screen.getByRole('button', { name: /마비/ })).toBeInTheDocument()
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('tap (click) toggles the description tooltip — mobile path', () => {
    render(<AbilityChip ability="paralyze" />)
    const chip = screen.getByRole('button')
    fireEvent.click(chip)
    const tip = screen.getByRole('tooltip')
    expect(tip).toBeInTheDocument()
    expect(tip.textContent).toMatch(/비상처 카드를 전부 버립니다/)
    // tap again closes
    fireEvent.click(chip)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('hover shows and unhover hides — desktop path', () => {
    render(<AbilityChip ability="brutal" />)
    const chip = screen.getByRole('button')
    fireEvent.mouseEnter(chip)
    expect(screen.getByRole('tooltip').textContent).toMatch(/두 배만큼 피해/)
    fireEvent.mouseLeave(chip)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('tapping outside dismisses the tooltip', () => {
    render(
      <div>
        <AbilityChip ability="poison" />
        <button type="button">elsewhere</button>
      </div>,
    )
    fireEvent.click(screen.getByRole('button', { name: /독/ }))
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    fireEvent.pointerDown(screen.getByRole('button', { name: 'elsewhere' }))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('English locale renders English label + description', async () => {
    await i18n.changeLanguage('en')
    render(<AbilityChip ability="swift" />)
    fireEvent.click(screen.getByRole('button', { name: /Swift/i }))
    expect(screen.getByRole('tooltip').textContent).toMatch(/double the Block value/i)
  })
})
