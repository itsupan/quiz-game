import { expect, test } from '@playwright/test';
import { ADMIN_SESSION, LEARNER_SESSION, signIn } from './sessions';

test.describe('learner dashboard authorization guard', () => {
	test('unauthorized GET /home redirects to /login with redirectTo', async ({ page }) => {
		const response = await page.request.get('/home', { maxRedirects: 0 });

		expect(response.status()).toBe(302);
		expect(response.headers()['location']).toBe('/login?redirectTo=%2Fhome');
	});

	test('unauthorized POST /home returns 401', async ({ page }) => {
		const response = await page.request.post('/home', {
			headers: {
				'content-type': 'application/x-www-form-urlencoded',
				origin: 'http://localhost:4173'
			},
			data: 'test=1',
			maxRedirects: 0
		});

		expect(response.status()).toBe(401);
	});

	test('unauthorized access to /practice, /leaderboard, /analytics redirects to login', async ({
		page
	}) => {
		for (const path of ['/practice', '/leaderboard', '/analytics']) {
			const response = await page.request.get(path, { maxRedirects: 0 });
			expect(response.status()).toBe(302);
			expect(response.headers()['location']).toBe(`/login?redirectTo=${encodeURIComponent(path)}`);
		}
	});

	test('authorized user with role not admin navigating to / is redirected to /home', async ({
		page
	}) => {
		await signIn(page.context(), LEARNER_SESSION);
		await page.goto('/');
		await expect(page).toHaveURL('/home');
	});

	test('user with role ADMIN navigating to /home is redirected to /admin', async ({ page }) => {
		await signIn(page.context(), ADMIN_SESSION);
		await page.goto('/home');
		await expect(page).toHaveURL(/\/admin/);
	});
});

test.describe('learner home page (authenticated)', () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page.context(), LEARNER_SESSION);
	});

	test('renders the full brutalist home page matching mockup', async ({ page }) => {
		await page.goto('/home');

		// Navbar elements
		await expect(page.getByText('QUIZGAME')).toBeVisible();
		await expect(page.getByRole('link', { name: 'DASHBOARD' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'PRACTICE' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'LEADERBOARD' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'ANALYTICS' })).toBeVisible();
		await expect(page.getByPlaceholder('SEARCH TOPICS...')).toBeVisible();

		// Section 01: Overview
		await expect(page.getByRole('heading', { name: /01\s*\/ OVERVIEW/i })).toBeVisible();
		await expect(page.getByText(/Welcome back/i)).toBeVisible();
		// Exact: earlier admin tests publish quizzes titled with a Date.now() stamp, and a
		// loose match finds "14" inside one of those timestamps whenever it happens to
		// contain those two digits.
		await expect(page.getByText('14', { exact: true })).toBeVisible();
		await expect(page.getByText('DAY STREAK')).toBeVisible();
		await expect(page.getByText('ACTIVE METRIC')).toBeVisible();

		// Level filters
		await expect(page.getByText('FILTER BY LEVEL:')).toBeVisible();
		const filterBar = page.getByLabel('Filter quizzes by JLPT level');
		await expect(filterBar.getByRole('button', { name: 'ALL LEVELS' })).toBeVisible();
		await expect(filterBar.getByRole('button', { name: 'N4' })).toBeVisible();
		await expect(filterBar.getByRole('button', { name: 'N3' })).toBeVisible();

		// Section 02: Featured Sets
		await expect(page.getByRole('heading', { name: /FEATURED SETS/i })).toBeVisible();
		await expect(page.getByText('BANSHI SHEJI')).toBeVisible();

		// Featured cards & action buttons
		await expect(page.getByRole('heading', { name: 'Advanced Typography & Layout' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'LEARN MODE' }).first()).toBeVisible();
		await expect(page.getByRole('button', { name: 'EXAM MODE' }).first()).toBeVisible();

		// Bottom brutalist status bar
		await expect(page.getByText('SYSTEM STATUS: ACTIVE')).toBeVisible();
	});

	test('filters sets reactively when level buttons are clicked', async ({ page }) => {
		await page.goto('/home');

		const filterBar = page.getByLabel('Filter quizzes by JLPT level');

		// Default is N4 in mockup: N4 cards visible
		await expect(page.getByRole('heading', { name: 'Advanced Typography & Layout' })).toBeVisible();

		// Click N5 where no cards exist
		await filterBar.getByRole('button', { name: 'N5' }).click();
		await expect(page.getByText(/No quiz sets found for level N5/i)).toBeVisible();

		// Click ALL LEVELS in the filter bar: all cards visible
		await filterBar.getByRole('button', { name: 'ALL LEVELS' }).click();
		await expect(page.getByRole('heading', { name: 'Advanced Typography & Layout' })).toBeVisible();
	});

	test('user dropdown displays account info and sign out button', async ({ page }) => {
		await page.goto('/home');

		// Click avatar
		await page.getByLabel('User menu').click();

		// Check learner info and sign out
		await expect(page.getByText('ROLE: USER')).toBeVisible();
		await expect(page.getByRole('button', { name: /Sign out/i })).toBeVisible();
	});
});
