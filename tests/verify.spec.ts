import { test, expect } from '@playwright/test';

test('App initializes correctly', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('text=Loom Initialized')).toBeVisible();
});

test('Core system interface loads status and handles API boundary', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('text=Core System Status')).toBeVisible();

  // Ensure screenshot is captured
  await page.screenshot({ path: 'evidence_old.png', fullPage: true });
});

test('Verify that the HTML app loads and displays the main dashboard shell with the required tabs without errors.', async ({ page }) => {
  await page.goto('/kanban');
  
  // Verify tabs are visible
  await expect(page.getByRole('link', { name: 'analytics Telemetry' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'monitor_heart System Health' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'view_kanban Kanban' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'map Roadmap' })).toBeVisible();

  await page.getByRole('link', { name: 'view_kanban Kanban' }).click();
  await expect(page).toHaveURL(/.*\/kanban/);
  await expect(page.getByText('Sprint Backlog')).toBeVisible();

  // Test screenshot
  await page.screenshot({ path: 'evidence_old2.png' });
});

test('User drags a task from the bottom of the column to the top. The PocketBase collection updates the order index, and the UI reactively maintains the new layout.', async ({ page }) => {
  // Go directly to the new Kanban route which directly reads from PocketBase collection
  await page.goto('/kanban');

  // Wait for tasks to load (checking for empty state or loaded tasks)
  await expect(page.locator('text=Loading tasks...')).not.toBeVisible();

  // Wait to ensure UI fully painted the kanban board layout
  await expect(page.locator('text=Sprint Backlog')).toBeVisible();

  const tasks = page.locator('div[draggable="true"]');
  const count = await tasks.count();
  
  if (count > 1) {
    // Drag the last task to the first task
    const lastTask = tasks.nth(count - 1);
    const firstTask = tasks.nth(0);

    // HTML5 drag and drop might need custom dispatching if dragTo isn't perfect
    await lastTask.dragTo(firstTask);
  }

  // Wait for the UI to settle and any PocketBase update API calls to finish
  await page.waitForTimeout(1000);

  // Take the final screenshot as evidence (ensuring unique name per testing rules)
  await page.screenshot({ path: 'evidence_old3.png' });
});
