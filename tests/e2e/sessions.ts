/**
 * Session tokens the Playwright suite signs in with.
 *
 * These are REAL sessions, not a bypass: `seeds/e2e-sessions.sql` inserts rows whose id is
 * the SHA-256 of each token below, exactly as `createSession` would, and the tests set the
 * token as the `session` cookie. Every request then goes through the same
 * `validateSession` path a signed-in person does — there is no test-only code path in the
 * application at all.
 *
 * The seed file is applied with `--local` only, so these tokens never exist anywhere but a
 * developer's machine and CI. If you change a token here, regenerate its id:
 *
 *   node -e "console.log(require('node:crypto').createHash('sha256').update('<token>').digest('hex'))"
 */
export const ADMIN_SESSION = 'e2e-admin-session-token';
export const LEARNER_SESSION = 'e2e-learner-session-token';

/**
 * Used only by the sign-out test, which deletes the row it signs in with. Sharing the
 * administrator's session would sign every other test out halfway through.
 */
export const SIGNOUT_SESSION = 'e2e-signout-session-token';

export const BASE_URL = 'http://localhost:4173';

/** Signs a browser context in as one of the seeded users. */
export async function signIn(
	context: { addCookies(cookies: { name: string; value: string; url: string }[]): Promise<void> },
	token: string
): Promise<void> {
	await context.addCookies([{ name: 'session', value: token, url: BASE_URL }]);
}
