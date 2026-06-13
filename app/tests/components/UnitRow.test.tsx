import { describe, it, expect, afterAll, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import i18n from '@/i18n/config'
import { UnitRow } from '@/components/interaction/InteractionPanel'
import type { RegularUnit } from '@/engine/types'

// Thugs (id 13): armor 5, Block 3 / Attack 3 / Influence 4 — matches data/units_regular.json
const thugs: RegularUnit = {
  id: 13,
  name: 'Thugs',
  type: 'unit',
  tier: 'regular',
  level: 1,
  cost: 5,
  armor: 5,
  recruitSites: ['village', 'keep'],
  abilities: [
    { name: 'Block', text: 'Block 3', manaCost: null, actions: [{ type: 'block', value: 3 }] },
    { name: 'Attack', text: 'Attack 3', manaCost: null, actions: [{ type: 'attack', value: 3 }, { type: 'special', description: 'Reputation -1' }] },
    { name: 'Influence', text: 'Influence 4', manaCost: null, actions: [{ type: 'influence', value: 4 }, { type: 'special', description: 'Reputation -1' }] },
  ],
  resistance: null,
  copies: 2,
  set: 'expansion',
}

function renderRow() {
  const t = i18n.getFixedT(i18n.language, 'ui')
  return render(
    <UnitRow unit={thugs} canAfford unitLimitReached={false} onRecruit={vi.fn()} t={t} />,
  )
}

describe('UnitRow — Korean localization & ability stats', () => {
  afterAll(async () => { await i18n.changeLanguage('en') })

  it('shows the translated unit name (not raw English) in Korean', async () => {
    await i18n.changeLanguage('ko')
    renderRow()
    // id 13 → "깡패" in ko/cards/units_regular.json
    expect(screen.getByText('깡패')).toBeInTheDocument()
    expect(screen.queryByText('Thugs')).toBeNull()
  })

  it('uses a localized armor label (방어력), not hardcoded English "Armor"', async () => {
    await i18n.changeLanguage('ko')
    const { container } = renderRow()
    const text = container.textContent ?? ''
    expect(text).toContain('방어력')
    expect(text).not.toContain('Armor')
  })

  it('renders ability stat chips with icons + values (block/attack/influence)', async () => {
    await i18n.changeLanguage('ko')
    const { container } = renderRow()
    const text = container.textContent ?? ''
    // Block 3, Attack 3, Influence 4 → icon+number chips
    expect(text).toMatch(/🛡\s*3/)
    expect(text).toMatch(/⚔\s*3/)
    expect(text).toMatch(/🤝\s*4/)
  })

  it('English mode shows the English name', async () => {
    await i18n.changeLanguage('en')
    renderRow()
    expect(screen.getByText('Thugs')).toBeInTheDocument()
  })
})
