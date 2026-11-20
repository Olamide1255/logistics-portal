import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe('Logistics Core Workflow', () => {
  test('Should login, register a shipment, and see it on the dashboard', async ({ page }) => {
    test.skip(
      process.env.E2E_TESTS_ENABLED !== 'true' || !TEST_EMAIL || !TEST_PASSWORD,
      'Requires isolated staging Supabase credentials and a dedicated E2E user.'
    );

    await page.goto('/login');
    await page.locator('input[type="email"]').fill(TEST_EMAIL!);
    await page.locator('input[type="password"]').fill(TEST_PASSWORD!);
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page).toHaveURL(/.*dashboard/, { timeout: 15000 });

    await page.goto('/dashboard/register');

    const uniqueAWB = `E2E-${Date.now()}`;

    await page.getByPlaceholder('e.g. 123-45678901').fill(uniqueAWB);
    await page.getByPlaceholder('e.g. Acme Corp').fill('Automated Test Client');
    await page.locator('select[name="shipment_type"]').selectOption('Export');
    await page.locator('select[name="service_type"]').selectOption('DDP');
    await page.getByPlaceholder('e.g. 5.50').fill('10');
    await page.getByPlaceholder('e.g. 150000').fill('500');
    await page.getByPlaceholder('Name, Phone, Address').nth(0).fill('E2E Test Sender');
    await page.getByPlaceholder('Name, Phone, Address').nth(1).fill('E2E Test Receiver');
    await page.getByPlaceholder('e.g. Lagos (LOS)').fill('Lagos');
    await page.getByPlaceholder('e.g. London (LHR)').fill('London');
    await page.getByPlaceholder('e.g. Electronics').fill('Test Goods');
    await page.getByPlaceholder('e.g. 12.5').fill('10');
    await page.getByPlaceholder('e.g. 50x40x30').fill('10x10x10');

    await page.getByRole('button', { name: 'Register Shipment' }).click();
    await page.waitForURL('**/dashboard/shipments', { timeout: 10000 });
    await page.getByPlaceholder('Search AWB or Client...').fill(uniqueAWB);

    const row = page.locator('tr', { hasText: uniqueAWB });
    await expect(row).toBeVisible({ timeout: 10000 });
  });
});
