import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const LOCALES_DIR = resolve(__dirname, '../../../locales')
const LANGUAGES = ['en', 'ko', 'es'] as const

function loadJson(lang: string, ...pathParts: string[]): Record<string, unknown> {
  const filePath = resolve(LOCALES_DIR, lang, ...pathParts)
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function getLeafKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return [prefix]
  }
  let keys: string[] = []
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    keys = keys.concat(getLeafKeys((obj as Record<string, unknown>)[key], fullKey))
  }
  return keys.sort()
}

function getTopLevelIds(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).sort((a, b) => Number(a) - Number(b))
}

function getFieldKeys(entry: unknown): string[] {
  if (typeof entry !== 'object' || entry === null) return []
  return Object.keys(entry as Record<string, unknown>).sort()
}

describe('i18n completeness', () => {
  describe('ui.json — all languages have the same leaf keys', () => {
    const uiData: Record<string, Record<string, unknown>> = {}
    for (const lang of LANGUAGES) {
      uiData[lang] = loadJson(lang, 'ui.json')
    }

    it('EN, KO, ES have the same number of leaf keys', () => {
      const enKeys = getLeafKeys(uiData.en)
      const koKeys = getLeafKeys(uiData.ko)
      const esKeys = getLeafKeys(uiData.es)

      expect(koKeys.length).toBe(enKeys.length)
      expect(esKeys.length).toBe(enKeys.length)
    })

    it('KO has all EN keys', () => {
      const enKeys = getLeafKeys(uiData.en)
      const koKeys = getLeafKeys(uiData.ko)
      const missing = enKeys.filter((k) => !koKeys.includes(k))
      expect(missing).toEqual([])
    })

    it('ES has all EN keys', () => {
      const enKeys = getLeafKeys(uiData.en)
      const esKeys = getLeafKeys(uiData.es)
      const missing = enKeys.filter((k) => !esKeys.includes(k))
      expect(missing).toEqual([])
    })

    it('no extra keys in KO beyond EN', () => {
      const enKeys = getLeafKeys(uiData.en)
      const koKeys = getLeafKeys(uiData.ko)
      const extra = koKeys.filter((k) => !enKeys.includes(k))
      expect(extra).toEqual([])
    })

    it('no extra keys in ES beyond EN', () => {
      const enKeys = getLeafKeys(uiData.en)
      const esKeys = getLeafKeys(uiData.es)
      const extra = esKeys.filter((k) => !enKeys.includes(k))
      expect(extra).toEqual([])
    })
  })

  const CARD_FILES = [
    'advanced_actions',
    'spells',
    'artifacts',
    'units_regular',
    'units_elite',
    'enemies',
    'hero_skills',
    'sites',
    'tactics',
  ]

  for (const cardFile of CARD_FILES) {
    describe(`cards/${cardFile}.json — all languages have the same entries`, () => {
      const cardData: Record<string, Record<string, unknown>> = {}
      for (const lang of LANGUAGES) {
        cardData[lang] = loadJson(lang, 'cards', `${cardFile}.json`)
      }

      it('EN, KO, ES have the same number of entries', () => {
        const enIds = getTopLevelIds(cardData.en)
        const koIds = getTopLevelIds(cardData.ko)
        const esIds = getTopLevelIds(cardData.es)

        expect(koIds.length).toBe(enIds.length)
        expect(esIds.length).toBe(enIds.length)
      })

      it('KO has all EN entry IDs', () => {
        const enIds = getTopLevelIds(cardData.en)
        const koIds = getTopLevelIds(cardData.ko)
        const missing = enIds.filter((id) => !koIds.includes(id))
        expect(missing).toEqual([])
      })

      it('ES has all EN entry IDs', () => {
        const enIds = getTopLevelIds(cardData.en)
        const esIds = getTopLevelIds(cardData.es)
        const missing = enIds.filter((id) => !esIds.includes(id))
        expect(missing).toEqual([])
      })

      it('each entry has the same field keys across languages', () => {
        const enIds = getTopLevelIds(cardData.en)
        const mismatches: string[] = []

        for (const id of enIds) {
          const enFields = getFieldKeys(cardData.en[id])
          const koFields = getFieldKeys(cardData.ko[id])
          const esFields = getFieldKeys(cardData.es[id])

          if (JSON.stringify(enFields) !== JSON.stringify(koFields)) {
            mismatches.push(`${cardFile}#${id} KO fields differ: EN=${JSON.stringify(enFields)} KO=${JSON.stringify(koFields)}`)
          }
          if (JSON.stringify(enFields) !== JSON.stringify(esFields)) {
            mismatches.push(`${cardFile}#${id} ES fields differ: EN=${JSON.stringify(enFields)} ES=${JSON.stringify(esFields)}`)
          }
        }

        expect(mismatches).toEqual([])
      })

      it('no values are empty strings', () => {
        const emptyValues: string[] = []

        for (const lang of LANGUAGES) {
          const ids = getTopLevelIds(cardData[lang])
          for (const id of ids) {
            const entry = cardData[lang][id] as Record<string, unknown>
            for (const [field, value] of Object.entries(entry)) {
              if (typeof value === 'string' && value.trim() === '') {
                emptyValues.push(`${lang}/${cardFile}#${id}.${field}`)
              }
            }
          }
        }

        expect(emptyValues).toEqual([])
      })
    })
  }

  describe('structural consistency across all locale files', () => {
    it('all expected card files exist for each language', () => {
      const missingFiles: string[] = []
      for (const lang of LANGUAGES) {
        for (const cf of CARD_FILES) {
          try {
            loadJson(lang, 'cards', `${cf}.json`)
          } catch {
            missingFiles.push(`${lang}/cards/${cf}.json`)
          }
        }
        try {
          loadJson(lang, 'ui.json')
        } catch {
          missingFiles.push(`${lang}/ui.json`)
        }
      }
      expect(missingFiles).toEqual([])
    })

    it('no ui.json values contain [TODO] (all translations complete)', () => {
      const todoValues: string[] = []
      for (const lang of LANGUAGES) {
        const data = loadJson(lang, 'ui.json')
        const keys = getLeafKeys(data)
        for (const key of keys) {
          const parts = key.split('.')
          let value: unknown = data
          for (const part of parts) {
            value = (value as Record<string, unknown>)[part]
          }
          if (typeof value === 'string' && value.includes('[TODO]')) {
            todoValues.push(`${lang}/ui.json: ${key}`)
          }
        }
      }
      expect(todoValues).toEqual([])
    })

    it('no card file values contain [TODO] (all translations complete)', () => {
      const todoValues: string[] = []
      for (const lang of LANGUAGES) {
        for (const cf of CARD_FILES) {
          const data = loadJson(lang, 'cards', `${cf}.json`)
          for (const [id, entry] of Object.entries(data)) {
            const checkValue = (val: unknown, path: string) => {
              if (typeof val === 'string' && val.includes('[TODO]')) {
                todoValues.push(`${lang}/cards/${cf}#${id}: ${path}`)
              } else if (Array.isArray(val)) {
                val.forEach((item, i) => checkValue(item, `${path}[${i}]`))
              } else if (typeof val === 'object' && val !== null) {
                for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
                  checkValue(v, `${path}.${k}`)
                }
              }
            }
            checkValue(entry, '')
          }
        }
      }
      expect(todoValues).toEqual([])
    })
  })
})
