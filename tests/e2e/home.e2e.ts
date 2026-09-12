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

	test('unauthorized access to /leaderboard, /analytics redirects to login', async ({ page }) => {
		for (const path of ['/leaderboard', '/analytics']) {
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
		await expect(page.getByRole('link', { name: 'LEADERBOARD' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'ANALYTICS' })).toBeVisible();
		await expect(page.getByPlaceholder('SEARCH TOPICS...')).toBeVisible();

		// Overview section
		await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
		await expect(page.getByText(/Welcome back/i)).toBeVisible();
		// Other suites can complete an attempt for this shared learner while running in parallel.
		await expect(page.getByTestId('streak-days')).toHaveText(/^\d+$/);
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

		// A seeded quiz card, linking straight into its own overview — one card, one mode,
		// one link, rather than the two dead buttons this replaced. Scoped to this card by
		// its own title, not `.first()`: admin tests elsewhere in this suite publish their
		// own quizzes, which sort ahead of the seed by creation date.
		const n4Card = page.getByRole('listitem').filter({ hasText: 'JLPT N4 模擬本試験' });
		await expect(n4Card.getByRole('link', { name: 'Start' })).toHaveAttribute(
			'href',
			'/quiz/01JSEEDQZN4EXAM00000000000'
		);
	});

	test('filters sets reactively when level buttons are clicked', async ({ page }) => {
		await page.goto('/home');

		const filterBar = page.getByLabel('Filter quizzes by JLPT level');

		// Default is N4 in mockup: the seeded N4 exam is visible
		await expect(page.getByRole('heading', { name: 'JLPT N4 模擬本試験' })).toBeVisible();

		// Click N2, a level nothing is seeded at
		await filterBar.getByRole('button', { name: 'N2' }).click();
		await expect(page.getByText(/No quiz sets found for level N2/i)).toBeVisible();

		// Click ALL LEVELS in the filter bar: the N4 exam reappears
		await filterBar.getByRole('button', { name: 'ALL LEVELS' }).click();
		await expect(page.getByRole('heading', { name: 'JLPT N4 模擬本試験' })).toBeVisible();
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
