import type { Page } from '@playwright/test'

// Helper to wait for page hydration
export async function waitForHydration(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
}
