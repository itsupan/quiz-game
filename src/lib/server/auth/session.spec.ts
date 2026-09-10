import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestDatabase, type TestDatabase } from '$lib/server/db/test-harness';
import { sessions, users } from '$lib/server/db/schema';
import {
	SESSION_COOKIE,
	SESSION_TTL_MS,
	clearSessionCookie,
	createSession,
	createSessionToken,
	hashSessionToken,
	invalidateSession,
	setSessionCookie,
	validateSession
} from './session';

const DAY = 24 * 60 * 60 * 1000;

let db: TestDatabase;
let userId: number;

beforeEach(async () => {
	db = createTestDatabase().db;

	const [created] = await db
		.insert(users)
		.values({ email: 'learner@example.com', displayName: '学習者' })
		.returning({ id: users.id });

	userId = created.id;
});

/** Captures what a route would have sent to the browser. */
function fakeCookies() {
	const calls: { name: string; value: string; options: Record<string, unknown> }[] = [];

	return {
		calls,
		cookies: {
			set: (name: string, value: string, options: Record<string, unknown>) =>
				calls.push({ name, value, options }),
			delete: (name: string, options: Record<string, unknown>) =>
				calls.push({ name, value: '', options })
		}
	};
}

describe('createSessionToken', () => {
	it('is 32 bytes of randomness, base64url encoded', () => {
		const token = createSessionToken();

		expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
	});

	it('never repeats', () => {
		const tokens = new Set(Array.from({ length: 500 }, () => createSessionToken()));

		expect(tokens.size).toBe(500);
	});
});

describe('hashSessionToken', () => {
	it('produces a 64-character hex digest', async () => {
		expect(await hashSessionToken('abc')).toMatch(/^[0-9a-f]{64}$/);
	});

	it('is deterministic, and different for different tokens', async () => {
		expect(await hashSessionToken('abc')).toBe(await hashSessionToken('abc'));
		expect(await hashSessionToken('abc')).not.toBe(await hashSessionToken('abd'));
	});
});

describe('createSession', () => {
	it('stores the hash of the token and never the token itself', async () => {
		const { token } = await createSession(db, userId);
		const [stored] = await db.select().from(sessions);

		// The whole point of the sessions table's design: a leaked database dump cannot
		// be replayed as a set of live sessions.
		expect(stored.id).not.toBe(token);
		expect(stored.id).toBe(await hashSessionToken(token));
	});

	it('expires thirty days out', async () => {
		const now = new Date('2026-09-09T12:00:00Z');
		const { expiresAt } = await createSession(db, userId, now);

		expect(expiresAt.getTime()).toBe(now.getTime() + SESSION_TTL_MS);
	});

	it('gives each sign-in its own session', async () => {
		await createSession(db, userId);
		await createSession(db, userId);

		// Signing in on a phone must not sign you out on a laptop.
		expect(await db.select().from(sessions)).toHaveLength(2);
	});
});

describe('validateSession', () => {
	it('returns the user behind a live session', async () => {
		const { token } = await createSession(db, userId);
		const result = await validateSession(db, token);

		expect(result?.user).toMatchObject({
			id: userId,
			email: 'learner@example.com',
			role: 'USER',
			status: 'ACTIVE'
		});
	});

	it('rejects a token that was never issued', async () => {
		expect(await validateSession(db, createSessionToken())).toBeNull();
	});

	it('rejects a token that is not even the right shape', async () => {
		expect(await validateSession(db, '')).toBeNull();
		expect(await validateSession(db, 'nonsense')).toBeNull();
	});

	it('rejects an expired session and deletes the row', async () => {
		const issued = new Date('2026-01-01T00:00:00Z');
		const { token } = await createSession(db, userId, issued);

		const later = new Date(issued.getTime() + SESSION_TTL_MS + 1000);

		expect(await validateSession(db, token, later)).toBeNull();
		// Reaped on the way past, so an abandoned session does not linger forever.
		expect(await db.select().from(sessions)).toHaveLength(0);
	});

	it('slides the expiry when a session is close to running out', async () => {
		const issued = new Date('2026-01-01T00:00:00Z');
		const { token } = await createSession(db, userId, issued);

		// 20 days in: 10 days left, inside the 15-day renewal window.
		const now = new Date(issued.getTime() + 20 * DAY);
		const result = await validateSession(db, token, now);

		expect(result?.renewed).toBe(true);
		expect(result?.expiresAt.getTime()).toBe(now.getTime() + SESSION_TTL_MS);

		const [stored] = await db.select().from(sessions);
		expect(stored.expiresAt.getTime()).toBe(now.getTime() + SESSION_TTL_MS);
	});

	it('leaves a fresh session alone', async () => {
		const issued = new Date('2026-01-01T00:00:00Z');
		const { token, expiresAt } = await createSession(db, userId, issued);

		// One day in: 29 days left, well outside the renewal window. Renewing on every
		// request would be a database write per page view.
		const result = await validateSession(db, token, new Date(issued.getTime() + DAY));

		expect(result?.renewed).toBe(false);
		expect(result?.expiresAt.getTime()).toBe(expiresAt.getTime());
	});

	it('reports a suspended user rather than hiding them', async () => {
		// A session lookup answers who the token belongs to; `resolveUser` is what refuses
		// to sign a non-ACTIVE account in, and destroys the session while it is there.
		await db.update(users).set({ status: 'SUSPENDED' }).where(eq(users.id, userId));

		const { token } = await createSession(db, userId);

		expect((await validateSession(db, token))?.user.status).toBe('SUSPENDED');
	});
});

describe('invalidateSession', () => {
	it('deletes the row, so the cookie is worthless afterwards', async () => {
		const { token } = await createSession(db, userId);

		await invalidateSession(db, token);

		expect(await db.select().from(sessions)).toHaveLength(0);
		// This is what makes signing out real rather than cosmetic: even a browser that
		// keeps the cookie has nothing to match against.
		expect(await validateSession(db, token)).toBeNull();
	});

	it('leaves other sessions of the same user alone', async () => {
		const phone = await createSession(db, userId);
		const laptop = await createSession(db, userId);

		await invalidateSession(db, phone.token);

		expect(await validateSession(db, laptop.token)).not.toBeNull();
	});

	it('is silent about a token that does not exist', async () => {
		await expect(invalidateSession(db, createSessionToken())).resolves.toBeUndefined();
	});
});

describe('session cookie', () => {
	it('is set http-only, secure, lax and site-wide', () => {
		const { calls, cookies } = fakeCookies();
		const expiresAt = new Date('2026-10-09T12:00:00Z');

		setSessionCookie(cookies as never, 'the-token', expiresAt);

		expect(calls[0].name).toBe(SESSION_COOKIE);
		expect(calls[0].value).toBe('the-token');
		expect(calls[0].options).toMatchObject({
			httpOnly: true,
			secure: true,
			// Lax, not Strict: the OAuth callback is a cross-site top-level navigation, and
			// a Strict cookie would not be sent on it, so sign-in would appear to succeed
			// and then drop you straight back to signed-out.
			sameSite: 'lax',
			path: '/',
			expires: expiresAt
		});
	});

	it('is cleared with the same path, or the browser keeps it', () => {
		const { calls, cookies } = fakeCookies();

		clearSessionCookie(cookies as never);

		expect(calls[0].name).toBe(SESSION_COOKIE);
		expect(calls[0].options).toMatchObject({ path: '/' });
	});
});
