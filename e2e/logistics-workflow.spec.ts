import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'it@marchloglimited.org.ng';
const TEST_PASSWORD = 'Marchlog'; // <--- ENSURE THIS IS CORRECT

test.describe('Logistics Core Workflow', () => {
  
  test('Should login, register a shipment, and see it on the dashboard', async ({ page }) => {
    
    // 1. Go to Login Page
    await page.goto('/login');
    
    // 2. Fill Login Form
    await page.locator('input[type="email"]').fill(TEST_EMAIL);
    await page.locator('input[type="password"]').fill(TEST_PASSWORD);
    
    // 3. Click Login
    await page.getByRole('button', { name: 'Login' }).click();

    // 4. Wait up to 15 seconds for the dashboard to load
    try {
      await expect(page).toHaveURL(/.*dashboard/, { timeout: 15000 });
    } catch (error) {
      // If it fails, check if there is a red error text on the screen
      const errorEl = page.locator('.text-red-500');
      if (await errorEl.isVisible()) {
        const errorMsg = await errorEl.textContent();
        throw new Error(`LOGIN FAILED: ${errorMsg}`);
      }
      throw error;
    }

    // 5. Go directly to the Register page
    await page.goto('/dashboard/register');
    
    // 6. Fill out the Registration Form
    const uniqueAWB = `TEST-${Date.now()}`;
    
    await page.getByPlaceholder('e.g. 123-45678901').fill(uniqueAWB);
    await page.getByPlaceholder('e.g. Acme Corp').fill('Automated Test Client');
    
    await page.locator('select[name="shipment_type"]').selectOption('Export');
    await page.locator('select[name="service_type"]').selectOption('DDP');
    
    await page.getByPlaceholder('e.g. 5.50').fill('10');
    await page.getByPlaceholder('e.g. 150000').fill('500');
    
    await page.getByPlaceholder('Name, Phone, Address').nth(0).fill('Test Sender');
    await page.getByPlaceholder('Name, Phone, Address').nth(1).fill('Test Receiver');
    
    await page.getByPlaceholder('e.g. Lagos (LOS)').fill('Lagos');
    await page.getByPlaceholder('e.g. London (LHR)').fill('London');
    await page.getByPlaceholder('e.g. Electronics').fill('Test Goods');
    
    await page.getByPlaceholder('e.g. 12.5').fill('10');
    await page.getByPlaceholder('e.g. 50x40x30').fill('10x10x10');

    // 7. Submit
    await page.getByRole('button', { name: 'Register Shipment' }).click();

    // 8. Verify redirect to shipments page
    await page.waitForURL('**/dashboard/shipments', { timeout: 10000 });

    // 9. WAIT for the initial table to load before searching
    await page.waitForTimeout(2000); 

    // 10. Verify the new shipment is visible in the table
    await page.getByPlaceholder('Search AWB or Client...').fill(uniqueAWB);
    
    // Wait a moment for the search debounce to hit the database
    await page.waitForTimeout(1000); 
    
    // Check if the specific row containing the AWB exists in the table
    const row = page.locator('tr', { hasText: uniqueAWB });
    await expect(row).toBeVisible({ timeout: 10000 });
  });

});