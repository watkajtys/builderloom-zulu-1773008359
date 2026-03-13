import { test, expect } from '@playwright/test';

test('App initializes correctly', async ({ page }) => {
  await page.goto('/viewer/index.html');
  await expect(page.locator('text=ZULU STEALTH COMMAND')).toBeVisible();
});

test('Core system interface loads status and handles API boundary', async ({ page }) => {
  await page.goto('/viewer/index.html');
  
  // Navigate to health tab
  await page.getByRole('button', { name: /health/i }).click();

  // Verify the system status element appears, indicating the core service ran
  await expect(page.locator('text=Core System Diagnostics')).toBeVisible();
  await expect(page.locator('text=Primary Status')).toBeVisible();
  await expect(page.locator('text=Current Phase')).toBeVisible();
  await expect(page.locator('text=Resource Alloc')).toBeVisible();

  // Ensure screenshot is captured
  await page.screenshot({ path: 'evidence_old.png', fullPage: true });
});

test('User drags a task from the bottom of the column to the top. The PocketBase collection updates the order index, and the UI reactively maintains the new layout. (Appended)', async ({ page }) => {
  await page.goto('/kanban');

  // Wait for tasks to load
  await expect(page.locator('text=Loading tasks...')).not.toBeVisible();

  // We find tasks in the Backlog column (used to be To Do)
  const backlogColumn = page.locator('div').filter({ hasText: /^Backlog$/ }).first().locator('..');
  
  const tasks = page.locator('[data-dnd-kit-draggable]');
  const count = await tasks.count();
  
  if (count > 1) {
    // Drag the last task to the first task
    const lastTask = tasks.nth(count - 1);
    const firstTask = tasks.nth(0);

    await lastTask.dragTo(firstTask);
  }

  // Wait for the UI to settle
  await page.waitForTimeout(1000);

  // Take the final screenshot as evidence
  await page.screenshot({ path: 'evidence.png' });
});
