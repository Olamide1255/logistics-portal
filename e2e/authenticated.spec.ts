import { expect, test } from '@playwright/test';

const platformEmail = process.env.E2E_PLATFORM_ADMIN_EMAIL;
const platformPassword = process.env.E2E_PLATFORM_ADMIN_PASSWORD;
const tenantEmail = process.env.E2E_TENANT_EMAIL;
const tenantPassword = process.env.E2E_TENANT_PASSWORD;

async function signIn(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
}

test('Platform Admin can navigate, reload and sign out cleanly', async ({ page }) => {
  test.skip(!process.env.E2E_BASE_URL || !platformEmail || !platformPassword, 'Dedicated staging Platform Admin credentials are not configured.');
  await signIn(page, platformEmail!, platformPassword!);
  await expect(page).toHaveURL(/\/platform(?:$|\?)/);
  await expect(page.getByRole('heading', { name: 'SaaS Dashboard' })).toBeVisible();

  await page.getByRole('link', { name: /Tenant companies/i }).click();
  await expect(page).toHaveURL(/#tenant-companies$/);
  await expect(page.locator('#tenant-companies')).toBeInViewport();

  await page.getByRole('link', { name: /Onboard company/i }).click();
  await expect(page).toHaveURL(/#onboard-company$/);
  await expect(page.locator('#onboard-company')).toBeInViewport();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'SaaS Dashboard' })).toBeVisible();
  await page.getByRole('button', { name: /sign out|logout/i }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Sign in to your workspace' })).toBeVisible();
});

test('Tenant user can open the dashboard and sign out', async ({ page }) => {
  test.skip(!process.env.E2E_BASE_URL || !tenantEmail || !tenantPassword, 'Dedicated staging tenant credentials are not configured.');
  await signIn(page, tenantEmail!, tenantPassword!);
  await expect(page).toHaveURL(/\/dashboard(?:$|\?)/);
  await expect(page.getByRole('heading').first()).toBeVisible();
  await page.getByRole('button', { name: /sign out|logout/i }).click();
  await expect(page).toHaveURL(/\/login$/);
});
