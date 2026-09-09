import { expect, test, type Page } from '@playwright/test';

import { ADMIN_SESSION, LEARNER_SESSION, SIGNOUT_SESSION, signIn } from '../../../e2e/sessions';

/**
 * Sign-in, sign-out and the guard, against a real worker and a real D1 database.
 *
 * The round trip through Google cannot be automated, so this covers everything on either
 * side of the redirect: what is sent to Google, and what a session is worth once it exists.
 * `jwt.spec.ts` and `oauth.spec.ts` cover the middle.
 */

/** The path the callback would send you to, as the browser holds it. */
async function returnToCookie(page: Page): Promise<string> {
	const cookie = (await page.context().cookies()).find((entry) => entry.name === 'oauth_return_to');

	return cookie?.value ?? '';
}

test.describe('signed out', () => {
	test('the header offers Google sign-in', async ({ page }) => {
		await page.goto('/');

		await expect(page.getByRole('link', { name: 'Sign in with Google' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0);
	});

	test('visiting the dashboard sends you to sign in, remembering the destination', async ({
		page
	}) => {
		// Not a 401 page: an error thrown from a hook renders without any layout, so it
		// would have no header and no way to sign in — a dead end.
		const response = await page.request.get('/admin/quizzes', { maxRedirects: 0 });

		expect(response.status()).toBe(302);

		const location = response.headers()['location'];

		expect(location).toContain('/auth/google');
		expect(location).toContain(encodeURIComponent('/admin/quizzes'));
	});

	test('a form action still gets a 401 rather than being bounced to Google', async ({ page }) => {
		// Redirecting a POST would discard the form body, so whatever was being submitted
		// would vanish without a word.
		const response = await page.request.post('/admin/quizzes?/archive', {
			headers: {
				'content-type': 'application/x-www-form-urlencoded',
				origin: 'http://localhost:4173'
			},
			data: 'publicId=01JSEEDQZN4EXAM00000000000',
			maxRedirects: 0
		});

		expect(response.status()).toBe(401);
	});

	test('starting sign-in redirects to Google with PKCE and state', async ({ page }) => {
		const response = await page.request.get('/auth/google', { maxRedirects: 0 });

		expect(response.status()).toBe(302);

		const target = new URL(response.headers()['location']);

		expect(target.origin + target.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
		expect(target.searchParams.get('code_challenge_method')).toBe('S256');
		expect(target.searchParams.get('state')).toBeTruthy();
		expect(target.searchParams.get('nonce')).toBeTruthy();
		expect(target.searchParams.get('scope')).toBe('openid email profile');

		// The verifier is kept server-side; only its hash goes to Google.
		expect(target.searchParams.get('code_verifier')).toBeNull();
	});

	test('the flow cookies are http-only, so no script can read them', async ({ page }) => {
		await page.request.get('/auth/google', { maxRedirects: 0 });

		const cookies = await page.context().cookies();
		const flow = cookies.filter((cookie) => cookie.name.startsWith('oauth_'));

		expect(flow.length).toBeGreaterThanOrEqual(3);
		expect(flow.every((cookie) => cookie.httpOnly)).toBe(true);
	});

	test('a callback with no matching state is refused', async ({ page }) => {
		// No flow cookies were ever set, so this is either a stale tab or a forgery.
		const response = await page.request.get('/auth/google/callback?code=x&state=y', {
			maxRedirects: 0
		});

		expect(response.status()).toBe(400);
	});

	test('cancelling at Google returns home rather than erroring', async ({ page }) => {
		const response = await page.request.get('/auth/google/callback?error=access_denied', {
			maxRedirects: 0
		});

		expect(response.status()).toBe(303);
		expect(response.headers()['location']).toBe('/');
	});

	test('remembers where you were going', async ({ page }) => {
		await page.request.get('/auth/google?redirectTo=%2Fadmin%2Fquizzes', { maxRedirects: 0 });

		// SvelteKit percent-encodes cookie values on the way out and decodes them on the
		// way in, so the raw jar value is encoded.
		expect(decodeURIComponent(await returnToCookie(page))).toBe('/admin/quizzes');
	});

	for (const hostile of ['https://evil.test/phish', '//evil.test/phish']) {
		test(`refuses to send you onward to ${hostile}`, async ({ page }) => {
			// Otherwise the sign-in link is an open redirect: a convincing way to bounce
			// someone off this site to a phishing page.
			await page.request.get(`/auth/google?redirectTo=${encodeURIComponent(hostile)}`, {
				maxRedirects: 0
			});

			expect(decodeURIComponent(await returnToCookie(page))).toBe('/');
		});
	}
});

test.describe('signed in as a learner', () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page.context(), LEARNER_SESSION);
	});

	test('the header shows the account, with no admin link', async ({ page }) => {
		await page.goto('/');

		await expect(page.getByText('学習者テスト')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Admin', exact: true })).toHaveCount(0);
	});

	test('the dashboard is forbidden, not merely hidden', async ({ page }) => {
		expect((await page.goto('/admin'))?.status()).toBe(403);
	});
});

test.describe('signed in as an administrator', () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page.context(), ADMIN_SESSION);
	});

	test('the header links to the dashboard', async ({ page }) => {
		await page.goto('/');

		await expect(page.getByText('管理者テスト')).toBeVisible();
		await expect(page.getByRole('link', { name: 'Admin', exact: true })).toBeVisible();
	});

	test('the dashboard opens', async ({ page }) => {
		expect((await page.goto('/admin'))?.status()).toBe(200);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Overview');
	});
});

test.describe('signing out', () => {
	test('invalidates the session server-side and returns to the homepage', async ({ page }) => {
		// Its own session: signing out deletes the row, and sharing one would sign every
		// other test out halfway through.
		await signIn(page.context(), SIGNOUT_SESSION);

		await page.goto('/admin');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Overview');

		await page.getByRole('button', { name: 'Sign out' }).click();

		await expect(page).toHaveURL('/');
		await expect(page.getByRole('link', { name: 'Sign in with Google' })).toBeVisible();

		// The row is gone, so even a browser that kept the cookie has nothing to match
		// against. This is the difference between signing out and clearing a cookie.
		await page
			.context()
			.addCookies([{ name: 'session', value: SIGNOUT_SESSION, url: 'http://localhost:4173' }]);

		const denied = await page.request.get('/admin', { maxRedirects: 0 });

		expect(denied.status()).toBe(302);
		expect(denied.headers()['location']).toContain('/auth/google');
	});

	test('cannot be triggered by a GET', async ({ page }) => {
		await signIn(page.context(), ADMIN_SESSION);

		const response = await page.request.get('/auth/signout', { maxRedirects: 0 });

		// 405: a link, an <img> or a prefetch must not be able to sign someone out.
		expect(response.status()).toBe(405);
		expect((await page.goto('/admin'))?.status()).toBe(200);
	});
});
