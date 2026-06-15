// risk: test-plan.md #3 — RBAC: Manager cannot access admin routes
// seed: tests/seed.spec.ts
import { test, expect } from '@playwright/test';

test('Manager is blocked from admin user management page', async ({ page }) => {
  // Setup: create Manager session inline (independent — no shared storageState)
  const res = await page.request.post('/test-session', {
    data: { role: 'Manager' },
  });
  if (!res.ok()) throw new Error(`/test-session failed: ${res.status()}`);

  // Fix: wrangler dev runs HTTP, strip secure flag so browser sends the cookie
  const ctx = page.context();
  const cookies = await ctx.cookies();
  await ctx.clearCookies();
  await ctx.addCookies(cookies.map(c => ({ ...c, secure: false })));

  // Action: navigate to admin-only route
  await page.goto('/admin/users');

  // Assert: Manager is redirected away — admin panel must NOT be visible
  await expect(page.locator('.title-badge').filter({ hasText: 'USERS' })).not.toBeVisible();
  // Assert: ended up back at login or a non-admin page
  await expect(page).not.toHaveURL(/\/admin/);
});
