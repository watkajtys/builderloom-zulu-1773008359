import { test, expect } from '@playwright/test';

test('App initializes correctly', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('text=Loom Initialized')).toBeVisible();
});

test('Verify that the HTML app loads and displays the main dashboard shell with the required tabs without errors.', async ({ page }) => {
  await page.goto('/viewer/index.html');
  
  // Verify tabs are visible
  await expect(page.getByRole('link', { name: 'analytics Telemetry' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'monitor_heart System Health' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'view_kanban Kanban' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'map Roadmap' })).toBeVisible();

  // Navigate to different tabs to check URLSearchParams deep linking
  await page.getByRole('link', { name: 'monitor_heart System Health' }).click();
  await expect(page).toHaveURL(/.*view=health.*/);
  await expect(page.getByText('System Health Overview')).toBeVisible();

  await page.getByRole('link', { name: 'view_kanban Kanban' }).click();
  await expect(page).toHaveURL(/.*view=kanban.*/);
  await expect(page.getByText('Sprint Backlog (Kanban)')).toBeVisible();

  await page.getByRole('link', { name: 'map Roadmap' }).click();
  await expect(page).toHaveURL(/.*view=roadmap.*/);
  await expect(page.getByText('Strategic Roadmap').first()).toBeVisible();

  // Test screenshot
  await page.screenshot({ path: 'evidence.png' });
});
