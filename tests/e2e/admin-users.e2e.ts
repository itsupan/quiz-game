import { expect, test, type Page } from '@playwright/test';
import { ADMIN_SESSION, LEARNER_SESSION, signIn } from './sessions';

async function signInAsAdmin({ page }: { page: Page }) {
	await signIn(page.context(), ADMIN_SESSION);
}

test.describe('admin users management', () => {
	test.beforeEach(signInAsAdmin);

	test('shows users list', async ({ page }) => {
		await page.goto('/admin/users');
		await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
		
		// The admin user from e2e-sessions should be present
		await expect(page.getByRole('cell', { name: '管理者テスト' })).toBeVisible();
		await expect(page.getByRole('cell', { name: 'admin@example.com' })).toBeVisible();
	});

	test('search filters users', async ({ page }) => {
		await page.goto('/admin/users');
		
		// Type a non-existent email
		await page.getByPlaceholder('Search name or email...').fill('nonexistent@example.com');
		await page.getByRole('button', { name: 'Search' }).click();
		
		await expect(page.getByText('No users match these filters.')).toBeVisible();
		
		// Type the admin email
		await page.getByPlaceholder('Search name or email...').fill('admin@example.com');
		await page.getByRole('button', { name: 'Search' }).click();
		
		await expect(page.getByRole('cell', { name: '管理者テスト' })).toBeVisible();
	});

	test('prevents admin from removing their own final administrator role', async ({ page }) => {
		await page.goto('/admin/users');
		
		const adminRow = page.getByRole('row').filter({ hasText: 'admin@example.com' });
		const roleSelect = adminRow.locator('select[name="role"]');
		await roleSelect.selectOption('USER');
		
		await expect(page.getByText('You are the last administrator and cannot remove your own admin role.')).toBeVisible();
	});
});
