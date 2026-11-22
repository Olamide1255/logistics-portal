import { expect, test } from '@playwright/test';

test('login page renders accessible sign-in controls', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in to your workspace' })).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: /sign in/i })).toBeEnabled();
});

test('deployment version endpoint returns a version without caching', async ({ request }) => {
  const response = await request.get('/api/version');
  expect(response.ok()).toBeTruthy();
  expect(response.headers()['cache-control']).toContain('no-store');
  expect((await response.json()).version).toBeTruthy();
});

test('invitation endpoint rejects unauthenticated requests', async ({ request }) => {
  const response = await request.post('/api/invite', {
    data: { email: 'unauthorized@example.test', role: 'Super Admin', department: 'Management', companyId: '00000000-0000-4000-8000-000000000000' },
  });
  expect(response.status()).toBe(401);
});

test('workspace signup explains email verification and enforces strong passwords', async ({ page }) => {
  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: 'Create your Workspace' })).toBeVisible();

  const companyName = page.getByLabel('Company Name');
  const adminEmail = page.getByLabel('Admin Email');
  const password = page.getByLabel('Password');

  await expect(companyName).toHaveAttribute('minlength', '2');
  await expect(companyName).toHaveAttribute('maxlength', '120');
  await expect(adminEmail).toHaveAttribute('type', 'email');
  await expect(password).toHaveAttribute('minlength', '12');
  await expect(password).toHaveAttribute('maxlength', '128');
  await expect(page.getByText(/verification link to the admin email/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create Workspace' })).toBeEnabled();
});
