// seed.spec.ts — exemplar for all E2E tests in this project.
// Demonstrates: getByRole/getByText locators, wait-for-state, test independence, risk-tied names.
// Every generated test should follow these patterns.
import { test, expect } from '@playwright/test';

// risk: test-plan.md #3 — RBAC: unauthenticated user cannot access admin routes
test('unauthenticated user is redirected to login page', async ({ page }) => {
  // Override storageState for this test only — run as guest
  await page.context().clearCookies();

  await page.goto('/admin/users');
  await page.waitForURL('/');
  await expect(page.getByRole('link', { name: /google/i })).toBeVisible();
});

// risk: test-plan.md #3 — RBAC: Admin can access admin routes (storageState from auth.setup.ts)
test('admin can access user management page', async ({ page }) => {
  await page.goto('/admin/users');
  await expect(page.locator('.title-badge').filter({ hasText: 'USERS' })).toBeVisible();
});

