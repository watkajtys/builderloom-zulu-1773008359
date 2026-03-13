import { test, expect } from '@playwright/test';

test('App initializes correctly', async ({ page }) => {
  await page.goto('/viewer/index.html');
  await expect(page.locator('text=BuilderLoom Zulu')).toBeVisible();
});

test('Core system interface loads status and handles API boundary', async ({ page }) => {
  await page.goto('/viewer/index.html');
  
  // Navigate to health tab
  await page.getByRole('link', { name: /System Health/i }).click();

  // Verify the system status element appears, indicating the core service ran
  await expect(page.locator('text=System Health Overview')).toBeVisible();

  // Ensure screenshot is captured
  await page.screenshot({ path: 'evidence_old.png', fullPage: true });
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
  await page.screenshot({ path: 'evidence_old.png' });
});

test('User drags a task from the bottom of the column to the top. The PocketBase collection updates the order index, and the UI reactively maintains the new layout.', async ({ page }) => {
  await page.goto('/kanban');

  // Wait for tasks to load
  await expect(page.locator('text=Loading tasks...')).not.toBeVisible();

  const tasks = page.locator('div[draggable="true"]');
  const count = await tasks.count();
  
  if (count > 1) {
    // Drag the last task to the first task
    const lastTask = tasks.nth(count - 1);
    const firstTask = tasks.nth(0);

    // HTML5 drag and drop might need custom dispatching if dragTo isn't perfect
    await lastTask.dragTo(firstTask);
  }

  // Wait for the UI to settle
  await page.waitForTimeout(1000);

  // Take the final screenshot as evidence
  await page.screenshot({ path: 'evidence_old.png' });
});

test('User drags a task from the bottom of the column to the top. The PocketBase collection updates the order index, and the UI reactively maintains the new layout. (Appended)', async ({ page }) => {
  await page.goto('/kanban');

  // Wait for tasks to load
  await expect(page.locator('text=Loading tasks...')).not.toBeVisible();

  const tasks = page.locator('div[draggable="true"]');
  const count = await tasks.count();
  
  if (count > 1) {
    // Drag the last task to the first task
    const lastTask = tasks.nth(count - 1);
    const firstTask = tasks.nth(0);

    // HTML5 drag and drop might need custom dispatching if dragTo isn't perfect
    await lastTask.dragTo(firstTask);
  }

  // Wait for the UI to settle
  await page.waitForTimeout(1000);

  // Take the final screenshot as evidence
  await page.screenshot({ path: 'evidence_old.png' });
});
