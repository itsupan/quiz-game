import { and, eq, sql } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';

import type { Database } from '$lib/server/db';
import { oauthAccounts, users } from '$lib/server/db/schema';
import { SignInError } from './errors';
import type { GoogleProfile } from './jwt';
import { SESSION_COOKIE, invalidateSession, setSessionCookie, validateSession } from './session';
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

	if (session.user.status !== 'ACTIVE') {
		// Suspension has to take effect on the next request, not the next sign-in. Only
		// `assertAdmin` used to check status, which covers /admin and nothing else — so
		// suspending a learner revoked nothing at all, and would have quietly become a
		// real hole the moment attempt routes started reading `locals.user`.
		await invalidateSession(event.locals.db, token);
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
 * change and `sub` cannot.
 *
 * An account that already exists under the same address is adopted rather than duplicated
 * — the seeded administrator, or anyone created before sign-in existed. That is safe only
 * because `jwt.ts` refuses unverified addresses, and it is necessary because `users.email`
 * is unique, so a new row would simply fail to insert.
 *
 * Adoption is refused when the account is ALREADY linked to a different Google identity.
 * A Workspace address can be deleted and re-created, and the replacement gets a new `sub`
 * while verifying the same email; without this check that stranger would be merged into
 * the original account and inherit its role, its history and its public id.
 */
export async function upsertGoogleUser(
	db: Database,
	profile: GoogleProfile,
	bootstrapEmails?: string
): Promise<AuthUser> {
	const email = profile.email.trim().toLowerCase();
	const displayName = profile.name?.trim() || email;
	const shouldBootstrap = isBootstrapAdmin(email, bootstrapEmails);

	const [linked] = await db
		.select({ userId: oauthAccounts.userId })
		.from(oauthAccounts)
		.where(
			and(eq(oauthAccounts.provider, 'google'), eq(oauthAccounts.providerAccountId, profile.sub))
		)
		.limit(1);

	const [byEmail] = linked
		? []
		: await db
				.select({
					id: users.id,
					passwordHash: users.passwordHash,
					linkedTo: oauthAccounts.providerAccountId
				})
				.from(users)
				.leftJoin(
					oauthAccounts,
					and(eq(oauthAccounts.userId, users.id), eq(oauthAccounts.provider, 'google'))
				)
				.where(sql`lower(${users.email}) = ${email}`)
				.limit(1);

	if (byEmail?.linkedTo) {
		throw new SignInError(
			'An account already exists for that email address under a different Google identity. Contact an administrator.'
		);
	}

	if (byEmail?.passwordHash) {
		throw new SignInError(
			'An account already exists for that email address with password sign-in. Sign in with your password instead.'
		);
	}

	const existingId = linked?.userId ?? byEmail?.id;

	if (existingId === undefined) {
		const [created] = await db
			.insert(users)
			.values({
				email,
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
			email,
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
