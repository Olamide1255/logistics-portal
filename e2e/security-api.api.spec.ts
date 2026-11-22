import { expect, test } from '@playwright/test';

const TEST_COMPANY_ID = '00000000-0000-4000-8000-000000000001';

test('employee invitation endpoint rejects unauthenticated requests', async ({ request }) => {
  const response = await request.post('/api/invite', {
    data: {
      email: 'unauthorized@example.com',
      role: 'Super Admin',
      department: 'Management',
      companyId: TEST_COMPANY_ID,
    },
  });

  expect(response.status()).toBe(401);
});

test('company deletion endpoint rejects unauthenticated requests', async ({ request }) => {
  const response = await request.post('/api/delete-company', {
    data: { companyId: TEST_COMPANY_ID },
  });

  expect(response.status()).toBe(401);
});


test('public tracking logo endpoint rejects malformed tracking tokens', async ({ request }) => {
  const response = await request.get('/api/track/not-a-valid-token/logo');

  expect(response.status()).toBe(404);
});
