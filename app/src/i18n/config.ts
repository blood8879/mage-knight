import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import enUI from '@locales/en/ui.json'
import enBasicActions from '@locales/en/cards/basic_actions.json'
import enAdvancedActions from '@locales/en/cards/advanced_actions.json'
import enSpells from '@locales/en/cards/spells.json'
import enArtifacts from '@locales/en/cards/artifacts.json'
import enUnitsRegular from '@locales/en/cards/units_regular.json'
import enUnitsElite from '@locales/en/cards/units_elite.json'
import enTactics from '@locales/en/cards/tactics.json'
import enEnemies from '@locales/en/cards/enemies.json'
import enSites from '@locales/en/cards/sites.json'
import enHeroSkills from '@locales/en/cards/hero_skills.json'

import koUI from '@locales/ko/ui.json'
import koBasicActions from '@locales/ko/cards/basic_actions.json'
import koAdvancedActions from '@locales/ko/cards/advanced_actions.json'
import koSpells from '@locales/ko/cards/spells.json'
import koArtifacts from '@locales/ko/cards/artifacts.json'
import koUnitsRegular from '@locales/ko/cards/units_regular.json'
import koUnitsElite from '@locales/ko/cards/units_elite.json'
import koTactics from '@locales/ko/cards/tactics.json'
import koEnemies from '@locales/ko/cards/enemies.json'
import koSites from '@locales/ko/cards/sites.json'
import koHeroSkills from '@locales/ko/cards/hero_skills.json'

import esUI from '@locales/es/ui.json'
import esAdvancedActions from '@locales/es/cards/advanced_actions.json'
import esSpells from '@locales/es/cards/spells.json'
import esArtifacts from '@locales/es/cards/artifacts.json'
import esUnitsRegular from '@locales/es/cards/units_regular.json'
import esUnitsElite from '@locales/es/cards/units_elite.json'

const resources = {
  en: {
    ui: enUI,
    basicActions: enBasicActions,
    advancedActions: enAdvancedActions,
    spells: enSpells,
    artifacts: enArtifacts,
    unitsRegular: enUnitsRegular,
    unitsElite: enUnitsElite,
    tactics: enTactics,
    enemies: enEnemies,
    sites: enSites,
    heroSkills: enHeroSkills,
  },
  ko: {
    ui: koUI,
    basicActions: koBasicActions,
    advancedActions: koAdvancedActions,
    spells: koSpells,
    artifacts: koArtifacts,
    unitsRegular: koUnitsRegular,
    unitsElite: koUnitsElite,
    tactics: koTactics,
    enemies: koEnemies,
    sites: koSites,
    heroSkills: koHeroSkills,
  },
  es: {
    ui: esUI,
    advancedActions: esAdvancedActions,
    spells: esSpells,
    artifacts: esArtifacts,
    unitsRegular: esUnitsRegular,
    unitsElite: esUnitsElite,
  },
}

const savedLang = localStorage.getItem('mageknightLang') || 'en'

void i18n.use(initReactI18next).init({
  resources,
  lng: savedLang,
  fallbackLng: 'en',
  defaultNS: 'ui',
  interpolation: {
    escapeValue: false,
  },
})

export default i18n
