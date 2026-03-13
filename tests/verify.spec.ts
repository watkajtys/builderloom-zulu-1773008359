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
