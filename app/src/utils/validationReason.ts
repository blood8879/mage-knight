import type { CardPlayValidation } from '@/engine/CardPlayValidator'

/**
 * Translate a CardPlayValidation's reason into a localized string.
 * Shared by the hand panel (BottomPanel) and the combat tray so disabled
 * strong-play rows can explain exactly what mana is missing (e.g. at night an
 * Action's strong effect needs both its color AND black mana).
 */
export function translateValidationReason(
  validation: CardPlayValidation,
  t: (key: string, options?: Record<string, unknown>) => string,
): string | undefined {
  if (!validation.reason) return undefined
  if (!validation.reasonKey) return validation.reason
  const color = validation.reasonParams?.color
  return t(`validation.${validation.reasonKey}`, {
    defaultValue: validation.reason,
    color: color ? t(`colors.${color}`, { defaultValue: color }) : undefined,
  })
}
