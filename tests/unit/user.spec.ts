import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestDatabase, type TestDatabase } from '$lib/server/db/test-harness';
import { oauthAccounts, sessions, users } from '$lib/server/db/schema';
import type { GoogleProfile } from '$lib/server/auth/jwt';
import { createSession } from '$lib/server/auth/session';
import { isBootstrapAdmin, resolveUser, upsertGoogleUser } from '$lib/server/auth/user';

let db: TestDatabase;

const profile = (overrides: Partial<GoogleProfile> = {}): GoogleProfile => ({
	sub: '110169484474386276334',
	email: 'learner@example.com',
	emailVerified: true,
	name: '学習者テスト',
	picture: 'https://lh3.googleusercontent.com/a/abc',
	...overrides
});

beforeEach(() => {
	db = createTestDatabase().db;
});

describe('isBootstrapAdmin', () => {
	it('matches an address on the list', () => {
		expect(isBootstrapAdmin('me@example.com', 'me@example.com')).toBe(true);
	});

	it('ignores spacing around the separators', () => {
		expect(isBootstrapAdmin('b@example.com', ' a@example.com , b@example.com ')).toBe(true);
	});

	it('ignores case, because Google may return either', () => {
		expect(isBootstrapAdmin('Me@Example.com', 'me@example.com')).toBe(true);
	});

	it.each([undefined, '', '   ', ','])('treats %j as nobody', (list) => {
		expect(isBootstrapAdmin('me@example.com', list)).toBe(false);
	});

	it('does not match on a substring', () => {
		// A prefix match would hand the dashboard to anyone who can register
		// `xme@example.com` at their own domain.
		expect(isBootstrapAdmin('xme@example.com', 'me@example.com')).toBe(false);
		expect(isBootstrapAdmin('me@example.com.evil.test', 'me@example.com')).toBe(false);
	});
});

describe('upsertGoogleUser', () => {
	it('creates exactly one user and one linked identity on first sign-in', async () => {
		const user = await upsertGoogleUser(db, profile());

		expect(user).toMatchObject({ email: 'learner@example.com', role: 'USER', status: 'ACTIVE' });
		expect(await db.select().from(users)).toHaveLength(1);

		const [link] = await db.select().from(oauthAccounts);
		expect(link).toMatchObject({
			provider: 'google',
			providerAccountId: '110169484474386276334',
			userId: user.id
		});
	});

	it('creates no second record however often the same person signs in', async () => {
		const first = await upsertGoogleUser(db, profile());
		const second = await upsertGoogleUser(db, profile());
		await upsertGoogleUser(db, profile());

		expect(second.id).toBe(first.id);
		expect(await db.select().from(users)).toHaveLength(1);
		expect(await db.select().from(oauthAccounts)).toHaveLength(1);
	});

	it('follows the Google subject when the email address changes', async () => {
		const first = await upsertGoogleUser(db, profile());
		const renamed = await upsertGoogleUser(db, profile({ email: 'new-address@example.com' }));

		// `sub` is the stable identity; an email is not. Matching on email would have
		// created a second account for the same person.
		expect(renamed.id).toBe(first.id);
		expect(renamed.email).toBe('new-address@example.com');
		expect(await db.select().from(users)).toHaveLength(1);
	});

	it('refreshes the display name and avatar on every sign-in', async () => {
		await upsertGoogleUser(db, profile());
		const updated = await upsertGoogleUser(
			db,
			profile({ name: '新しい名前', picture: 'https://example.com/new.png' })
		);

		expect(updated.displayName).toBe('新しい名前');

		const [stored] = await db.select().from(users);
		expect(stored.avatarUrl).toBe('https://example.com/new.png');
		expect(stored.lastLoginAt).toBeInstanceOf(Date);
	});

	it('falls back to the email address when Google sends no name', async () => {
		const user = await upsertGoogleUser(db, profile({ name: null }));

		// `display_name` is NOT NULL, and an empty header is worse than a plain address.
		expect(user.displayName).toBe('learner@example.com');
	});

	describe('the bootstrap allowlist', () => {
		it('creates a listed address as an administrator', async () => {
			const user = await upsertGoogleUser(db, profile(), 'learner@example.com');

			expect(user.role).toBe('ADMIN');
		});

		it('promotes an existing user who is later added to the list', async () => {
			await upsertGoogleUser(db, profile());
			const promoted = await upsertGoogleUser(db, profile(), 'learner@example.com');

			expect(promoted.role).toBe('ADMIN');
		});

		it('leaves everyone else a learner', async () => {
			const user = await upsertGoogleUser(db, profile(), 'someone-else@example.com');

			expect(user.role).toBe('USER');
		});

		it('never demotes an administrator who is not on the list', async () => {
			// The list bootstraps the first administrator; it is not the source of truth
			// for who is one. Issue #15 owns that.
			await upsertGoogleUser(db, profile(), 'learner@example.com');
			const again = await upsertGoogleUser(db, profile(), 'someone-else@example.com');

			expect(again.role).toBe('ADMIN');
		});

		it('does not resurrect a suspended account', async () => {
			await upsertGoogleUser(db, profile());
			await db.update(users).set({ status: 'SUSPENDED' }).where(eq(users.email, profile().email));

			const user = await upsertGoogleUser(db, profile(), 'learner@example.com');

			expect(user.status).toBe('SUSPENDED');
		});
	});
});

describe('adopting an account by email', () => {
	it('refuses when that account is already a different Google identity', async () => {
		// REGRESSION. A Workspace address can be deleted and re-created; the replacement
		// verifies the same email but gets a new `sub`. Without this check the stranger is
		// merged into the original account and inherits its role, history and public id.
		await upsertGoogleUser(db, profile({ sub: 'the-original-person' }));

		await expect(
			upsertGoogleUser(db, profile({ sub: 'a-different-person-same-address' }))
		).rejects.toThrow(/different Google identity/i);

		// Nothing was created or altered on the way to refusing.
		expect(await db.select().from(users)).toHaveLength(1);
		expect(await db.select().from(oauthAccounts)).toHaveLength(1);
	});

	it('still adopts an account that has never been linked', async () => {
		// The seeded administrator, or anyone created before Google sign-in existed. Safe
		// because only verified addresses reach this point — and necessary because
		// `users.email` is unique, so a second row would simply fail to insert.
		const [seeded] = await db
			.insert(users)
			.values({ email: 'learner@example.com', displayName: 'seeded', role: 'ADMIN' })
			.returning();

		const user = await upsertGoogleUser(db, profile());

		expect(user.id).toBe(seeded.id);
		expect(user.role).toBe('ADMIN');
		expect(await db.select().from(users)).toHaveLength(1);
		expect(await db.select().from(oauthAccounts)).toHaveLength(1);
	});
});

describe('resolveUser', () => {
	/** The slice of a RequestEvent that resolveUser actually touches. */
	function fakeEvent(token: string | undefined) {
		const deleted: string[] = [];

		return {
			deleted,
			event: {
				cookies: {
					get: () => token,
					set: () => {},
					delete: (name: string) => deleted.push(name)
				},
				locals: { db }
			}
		};
	}

	it('resolves an active user', async () => {
		const user = await upsertGoogleUser(db, profile());
		const { token } = await createSession(db, user.id);

		const resolved = await resolveUser(fakeEvent(token).event as never);

		expect(resolved?.email).toBe('learner@example.com');
	});

	it('treats a suspended user as signed out, and destroys the session', async () => {
		// REGRESSION. `assertAdmin` was the only guard reading status, and it covers /admin
		// alone — so suspending a learner revoked nothing, and would have become a real
		// hole the moment attempt routes started reading `locals.user`.
		const user = await upsertGoogleUser(db, profile());
		const { token } = await createSession(db, user.id);

		await db.update(users).set({ status: 'SUSPENDED' }).where(eq(users.id, user.id));

		const fake = fakeEvent(token);

		expect(await resolveUser(fake.event as never)).toBeNull();
		// Ejected on the next request, not merely refused: the row is gone.
		expect(await db.select().from(sessions)).toHaveLength(0);
		expect(fake.deleted).toContain('session');
	});

	it('is signed out when there is no cookie at all', async () => {
		expect(await resolveUser(fakeEvent(undefined).event as never)).toBeNull();
	});

	it('clears a cookie whose session no longer exists', async () => {
		const fake = fakeEvent('a-token-that-was-never-issued');

		expect(await resolveUser(fake.event as never)).toBeNull();
		expect(fake.deleted).toContain('session');
	});
});
