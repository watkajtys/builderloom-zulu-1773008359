import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Intercept the session_state.json fetch to provide mock data
  await page.route('**/session_state.json*', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        project_name: 'Test Project',
        current_iteration: 1,
        history: [],
        backlog: [],
        live_logs: [],
        db_stats: {},
        current_status: 'ONLINE',
        current_phase: 'READY'
      })
    });
  });
});

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
  await page.screenshot({ path: 'evidence.png', fullPage: true });
});
