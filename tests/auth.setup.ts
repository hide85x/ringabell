// Setup: creates an Admin session via /test-session and saves storageState.
// Requires NUXT_TEST_MODE=1 in the running server (wrangler dev --var NUXT_TEST_MODE:1).
import { test as setup, expect } from '@playwright/test';

const authFile = 'tests/.auth/admin.json';

setup('create admin session', async ({ page }) => {
  // Use page.request so the session cookie lands in the page context
  const res = await page.request.post('/test-session', {
    data: { role: 'Admin' },
  });

  if (!res.ok()) {
    throw new Error(`/test-session failed: ${res.status()} — is NUXT_TEST_MODE=1 set?`);
  }

  // Navigate to a protected page to confirm session is active
  await page.goto('/admin/users');
  await expect(page).not.toHaveURL('/');

  // Fix: wrangler dev uses HTTP, so strip the secure flag so the browser sends the cookie
  const ctx = page.context();
  const cookies = await ctx.cookies();
  const fixed = cookies.map(c => ({ ...c, secure: false }));
  await ctx.clearCookies();
  await ctx.addCookies(fixed);

  await page.context().storageState({ path: authFile });
});
