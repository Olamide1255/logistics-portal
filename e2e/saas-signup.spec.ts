import { test, expect } from '@playwright/test';

test.describe('SaaS Signup & Tenant Isolation', () => {
  test('Should create a new company workspace, log in, and verify branding', async ({ page }) => {
    test.skip(
      process.env.E2E_TESTS_ENABLED !== 'true',
      'Requires an isolated staging Supabase project and service-role secret.'
    );

    const timestamp = Date.now();
    const testEmail = `testadmin${timestamp}@example.com`;
    const testCompanyName = `E2E Test Company ${timestamp}`;
    const testPassword = `E2E-${timestamp}-SafePass!`;

    await page.goto('/');
    await page.getByRole('link', { name: 'Get Started', exact: true }).click();
    await expect(page).toHaveURL('/signup');
    await expect(page.getByRole('heading', { name: 'Create your Workspace' })).toBeVisible();

    await page.getByPlaceholder('e.g. Acme Freight Ltd').fill(testCompanyName);
    await page.getByPlaceholder('admin@acmefreight.com').fill(testEmail);
    await page.getByPlaceholder('Min. 6 characters').fill(testPassword);

    const responsePromise = page.waitForResponse(response => response.url().includes('/api/signup-company'));
    await page.getByRole('button', { name: 'Create Workspace' }).click();

    const response = await responsePromise;
    if (response.status() !== 200) {
      const errorData = await response.json();
      throw new Error(`API FAILED: ${errorData.error}`);
    }

    await expect(page.locator('text=Workspace created! Redirecting to login...')).toBeVisible();
    await page.waitForURL('**/login', { timeout: 10000 });

    const loginForm = page.locator('form').filter({ hasText: 'Marchlog Portal' });
    await loginForm.locator('input[type="email"]').fill(testEmail);
    await loginForm.locator('input[type="password"]').fill(testPassword);
    await loginForm.getByRole('button', { name: 'Login' }).click();

    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await expect(page.locator('aside').getByText(testCompanyName)).toBeVisible({ timeout: 15000 });
    await expect(page.locator('aside').getByText('Super Admin', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Employees' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Company Settings' })).toBeVisible();

    await page.getByRole('link', { name: 'Employees' }).click();
    await page.waitForURL('**/dashboard/employees');

    const employeeTable = page.locator('table').filter({ hasText: 'Employee Email' });
    const employeeRows = employeeTable.locator('tbody tr');
    await expect(employeeRows).toHaveCount(1);
    await expect(employeeRows.first()).toContainText(testEmail);
  });
});
