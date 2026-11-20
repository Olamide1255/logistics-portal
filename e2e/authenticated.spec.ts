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

test('Platform Admin can navigate, reload, see both tenant fixtures and sign out cleanly', async ({ page }) => {
  test.skip(!platformEmail || !platformPassword, 'Dedicated staging Platform Admin credentials are not configured.');
  await signIn(page, platformEmail!, platformPassword!);
  await expect(page).toHaveURL(/\/platform(?:$|\?)/);
  await expect(page.getByRole('heading', { name: 'SaaS Dashboard' })).toBeVisible();

  await page.getByRole('link', { name: /Tenant companies/i }).click();
  await expect(page).toHaveURL(/#tenant-companies$/);
  await expect(page.locator('#tenant-companies')).toBeInViewport();

  await page.getByRole('link', { name: /Onboard company/i }).click();
  await expect(page).toHaveURL(/#onboard-company$/);
  await expect(page.locator('#onboard-company')).toBeInViewport();

  await page.goto('/dashboard/shipments');
  await expect(page.getByText('STG-ALPHA-0001')).toBeVisible();
  await expect(page.getByText('STG-BETA-0001')).toBeVisible();

  await page.goto('/platform');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'SaaS Dashboard' })).toBeVisible();
  await page.getByRole('button', { name: /sign out|logout/i }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Sign in to your workspace' })).toBeVisible();
});

test('Tenant user sees its own shipments but cannot see another tenant', async ({ page }) => {
  test.skip(!tenantEmail || !tenantPassword, 'Dedicated staging tenant credentials are not configured.');
  await signIn(page, tenantEmail!, tenantPassword!);
  await expect(page).toHaveURL(/\/dashboard(?:$|\?)/);

  await page.goto('/dashboard/shipments');
  await expect(page.getByRole('heading', { name: 'All Shipments' })).toBeVisible();
  await expect(page.getByText('STG-ALPHA-0001')).toBeVisible();
  await expect(page.getByText('STG-BETA-0001')).toHaveCount(0);

  await page.getByRole('button', { name: /sign out|logout/i }).click();
  await expect(page).toHaveURL(/\/login$/);
});
