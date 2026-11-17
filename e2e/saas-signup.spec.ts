import { test, expect } from '@playwright/test';

test.describe('SaaS Signup & Tenant Isolation', () => {
  
  test('Should create a new company workspace, log in, and verify branding', async ({ page }) => {
    // 1. Generate a unique email every time we run the test
    const timestamp = Date.now();
    const testEmail = `testadmin${timestamp}@example.com`;
    const testCompanyName = `Test Company ${timestamp}`;
    const testPassword = 'Password123!';

    // 2. Go to Landing Page and click "Get Started"
    await page.goto('/');
    await page.getByRole('link', { name: 'Get Started', exact: true }).click();
    
    // Verify we are on the signup page
    await expect(page).toHaveURL('/signup');
    await expect(page.getByRole('heading', { name: 'Create your Workspace' })).toBeVisible();

    // 3. Fill out the Signup Form
    await page.getByPlaceholder('e.g. Acme Freight Ltd').fill(testCompanyName);
    await page.getByPlaceholder('admin@acmefreight.com').fill(testEmail);
    await page.getByPlaceholder('Min. 6 characters').fill(testPassword);
    
    // Click Create Workspace
    const responsePromise = page.waitForResponse(response => response.url().includes('/api/signup-company'));
    await page.getByRole('button', { name: 'Create Workspace' }).click();

    const response = await responsePromise;
    if (response.status() !== 200) {
      const errorData = await response.json();
      throw new Error(`API FAILED: ${errorData.error}`);
    }

    // 4. Wait for the success message and redirect to login
    await expect(page.locator('text=Workspace created! Redirecting to login...')).toBeVisible();    
    await page.waitForURL('**/login', { timeout: 10000 });

    // 5. Scope the locators to the Login form ONLY
    const loginForm = page.locator('form').filter({ hasText: 'Marchlog Portal' });
    
    await loginForm.locator('input[type="email"]').fill(testEmail);
    await loginForm.locator('input[type="password"]').fill(testPassword);
    await loginForm.getByRole('button', { name: 'Login' }).click();

    // 6. Verify we reached the dashboard
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // 7. Verify the Tenant Isolation and Branding
    await expect(page.locator('aside').getByText(testCompanyName)).toBeVisible({ timeout: 15000 });
    await expect(page.locator('aside').getByText('Super Admin', { exact: true })).toBeVisible();

    // Verify the Company Admin links are visible
    await expect(page.getByRole('link', { name: 'Employees' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Company Settings' })).toBeVisible();

    // 8. Check Employee Isolation
    await page.getByRole('link', { name: 'Employees' }).click();
    await page.waitForURL('**/dashboard/employees');
    
    // SCOPE the locator to ONLY the table with the "Employee Email" header
    const employeeTable = page.locator('table').filter({ hasText: 'Employee Email' });
    const employeeRows = employeeTable.locator('tbody tr');
    
    await expect(employeeRows).toHaveCount(1); 
    await expect(employeeRows.first()).toContainText(testEmail);
  });

});