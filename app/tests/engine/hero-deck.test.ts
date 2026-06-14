import { describe, it, expect } from 'vitest'
import { ScenarioSetup } from '@/engine/ScenarioSetup'
import { SeededRandom } from '@/utils/random'
import { getBasicActions, PLAYABLE_HEROES, getHeroSkills } from '@/data/loader'
import type { BasicActionCard } from '@/engine/types'

const HERO_UNIQUE: Record<string, string> = {
  Arythea: 'Battle Versatility',
  Tovak: 'Cold Toughness',
  Goldyx: 'Will Focus',
  Norowas: 'Noble Manners',
}

describe('Hero starting decks — all playable heroes', () => {
  const ba = getBasicActions()
  const allCards = (ba.commonCards as BasicActionCard[]).concat(ba.heroSpecificCards as BasicActionCard[])

  for (const hero of PLAYABLE_HEROES) {
    it(`${hero}: 16-card deck with its unique card and no other hero's card`, () => {
      const setup = new ScenarioSetup(new SeededRandom(1))
      const deck = setup.setupPlayerDeck(hero, allCards)
      const names = deck.map((c) => ('name' in c ? c.name : ''))

      // Standard 16-card starting deck
      expect(deck.length).toBe(16)
      // Includes this hero's unique card
      expect(names).toContain(HERO_UNIQUE[hero])
      // Excludes every other hero's unique card
      for (const other of PLAYABLE_HEROES) {
        if (other !== hero) expect(names).not.toContain(HERO_UNIQUE[other])
      }
    })
  }

  it('each hero has a non-empty skill set', () => {
    for (const hero of PLAYABLE_HEROES) {
      expect(getHeroSkills(hero).length).toBeGreaterThan(0)
    }
  })
})
