import { test, expect } from '@playwright/test'

test.describe('Internationalization (i18n)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('heading', { level: 1 }),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('should switch to Korean when clicking the Korean language button', async ({
    page,
  }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Mage Knight Board Game',
    )

    await page.getByRole('button', { name: '한국어' }).click()

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      '메이지 나이트 보드 게임',
    )
  })

  test('should switch back to English from Korean', async ({ page }) => {
    await page.getByRole('button', { name: '한국어' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      '메이지 나이트 보드 게임',
    )

    await page.getByRole('button', { name: 'English' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Mage Knight Board Game',
    )
  })

  test('should switch to Spanish', async ({ page }) => {
    await page.getByRole('button', { name: 'Español' }).click()

    const title = page.getByRole('heading', { level: 1 })
    await expect(title).not.toHaveText('Mage Knight Board Game')
  })

  test('should persist language when navigating to settings and back', async ({
    page,
  }) => {
    await page.getByRole('button', { name: '한국어' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      '메이지 나이트 보드 게임',
    )

    await page.getByRole('button', { name: '설정' }).click()
    await expect(
      page.getByRole('heading', { level: 1, name: '설정' }),
    ).toBeVisible({ timeout: 5_000 })

    // menu.back is now properly localized (뒤로 in Korean)
    await page.getByRole('button', { name: /^(뒤로|Back)$/ }).click()

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      '메이지 나이트 보드 게임',
    )
  })
})
