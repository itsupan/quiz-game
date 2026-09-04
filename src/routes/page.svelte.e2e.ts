import { expect, test } from '@playwright/test';

test('home page renders the login experience', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { level: 1 })).toContainText('Login');
	await expect(page.getByLabel('Email address')).toBeVisible();
	await expect(page.getByRole('button', { name: /authenticate/i })).toBeVisible();
});

test('health endpoint reports a reachable database', async ({ request }) => {
	const response = await request.get('/api/health');

	expect(response.status()).toBe(200);
	expect(await response.json()).toMatchObject({ status: 'ok', database: 'ok' });
});
