import { test, expect } from '@playwright/test';

test('App initializes correctly', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('text=Loom Initialized')).toBeVisible();
});

test('Core system interface loads status and handles API boundary', async ({ page }) => {
  await page.goto('/');
  
  // Verify the system status element appears, indicating the core service ran
  const statusElement = page.locator('[data-testid="system-status"]');
  await expect(statusElement).toBeVisible();
  
  // It should contain the "Core System Status" header
  await expect(statusElement.locator('text=Core System Status')).toBeVisible();
  
  // It should show a status (online/offline)
  await expect(statusElement.locator('text=Status:')).toBeVisible();

  // Ensure screenshot is captured
  await page.screenshot({ path: 'evidence.png', fullPage: true });
});
