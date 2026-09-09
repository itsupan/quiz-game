import { and, eq } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';

import type { Database } from '$lib/server/db';
import { oauthAccounts, users } from '$lib/server/db/schema';
import type { GoogleProfile } from './jwt';
import { SESSION_COOKIE, setSessionCookie, validateSession } from './session';
import type { AuthUser } from './types';

export type { AuthUser };

const SELECTED = {
	id: users.id,
	publicId: users.publicId,
	email: users.email,
	displayName: users.displayName,
	role: users.role,
	status: users.status
} as const;

/**
 * Populates `locals.user` from the session cookie.
 *
 * Replaces the `ALLOW_DEV_AUTH` stub that stood here until Google sign-in existed. There is
 * no bypass any more: the only way to become a user is to hold a token whose hash matches a
 * live row in `sessions`.
 */
export async function resolveUser(event: RequestEvent): Promise<AuthUser | null> {
	const token = event.cookies.get(SESSION_COOKIE);

	if (!token) {
		return null;
	}

	const session = await validateSession(event.locals.db, token);

	if (!session) {
		// The row is gone or expired — signed out elsewhere, or reaped. Drop the cookie so
		// the browser stops sending a value that can never work again.
		event.cookies.delete(SESSION_COOKIE, { path: '/' });

		return null;
	}

	if (session.renewed) {
		setSessionCookie(event.cookies, token, session.expiresAt);
	}

	return session.user;
}

/**
 * Whether an address is on the bootstrap allowlist.
 *
 * `BOOTSTRAP_ADMIN_EMAILS` is how the first administrator comes to exist: without it every
 * account created by Google sign-in is a learner, and nobody could ever reach `/admin` on a
 * fresh database. Compared whole and case-insensitively — a prefix match would hand the
 * dashboard to anyone who can register a lookalike address at their own domain.
 */
export function isBootstrapAdmin(email: string, list: string | undefined): boolean {
	if (!list) {
		return false;
	}

	const wanted = email.trim().toLowerCase();

	return list
		.split(',')
		.map((entry) => entry.trim().toLowerCase())
		.filter((entry) => entry.length > 0)
		.includes(wanted);
}

/**
 * Turns a verified Google profile into the one `users` row that represents that person.
 *
 * Identity is Google's `sub`, held in `oauth_accounts`, because an email address can
 * change and `sub` cannot. An account that already exists under the same address — the
 * seeded administrator, or anyone created before sign-in existed — is adopted rather than
 * duplicated, which is safe only because `jwt.ts` refuses unverified addresses and is
 * necessary because `users.email` is unique.
 */
export async function upsertGoogleUser(
	db: Database,
	profile: GoogleProfile,
	bootstrapEmails?: string
): Promise<AuthUser> {
	const displayName = profile.name?.trim() || profile.email;
	const shouldBootstrap = isBootstrapAdmin(profile.email, bootstrapEmails);

	const [linked] = await db
		.select({ userId: oauthAccounts.userId })
		.from(oauthAccounts)
		.where(
			and(eq(oauthAccounts.provider, 'google'), eq(oauthAccounts.providerAccountId, profile.sub))
		)
		.limit(1);

	const [byEmail] = linked
		? []
		: await db.select({ id: users.id }).from(users).where(eq(users.email, profile.email)).limit(1);

	const existingId = linked?.userId ?? byEmail?.id;

	if (existingId === undefined) {
		const [created] = await db
			.insert(users)
			.values({
				email: profile.email,
				displayName,
				avatarUrl: profile.picture,
				role: shouldBootstrap ? 'ADMIN' : 'USER',
				lastLoginAt: new Date()
			})
			.returning(SELECTED);

		await db.insert(oauthAccounts).values({
			userId: created.id,
			provider: 'google',
			providerAccountId: profile.sub
		});

		return created;
	}

	const [updated] = await db
		.update(users)
		.set({
			email: profile.email,
			displayName,
			avatarUrl: profile.picture,
			lastLoginAt: new Date(),
			// Promote only. The list bootstraps the first administrator; it is not the
			// source of truth for who is one, and demoting on every sign-in would undo
			// anything the user-management screens do. Status is untouched, so a
			// suspended account stays suspended.
			...(shouldBootstrap ? { role: 'ADMIN' as const } : {})
		})
		.where(eq(users.id, existingId))
		.returning(SELECTED);

	if (!linked) {
		await db.insert(oauthAccounts).values({
			userId: existingId,
			provider: 'google',
			providerAccountId: profile.sub
		});
	}

	return updated;
}
