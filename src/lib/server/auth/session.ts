import { eq } from 'drizzle-orm';
import type { Cookies } from '@sveltejs/kit';

import type { Database } from '$lib/server/db';
import { sessions, users } from '$lib/server/db/schema';
import { randomToken, sha256Hex } from './encoding';
import type { AuthUser } from './types';

/**
 * Server-side sessions.
 *
 * The only module that touches the `sessions` table. The cookie holds a random token; the
 * database holds its SHA-256, so a leaked dump cannot be replayed as a set of live
 * sessions — and sign-out deletes the row, which is what makes invalidation real rather
 * than a matter of asking the browser nicely to forget something.
 */

export const SESSION_COOKIE = 'session';

/** How long a session lasts without being used. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Renew once a session has less than this left.
 *
 * Renewing on every request would be a database write per page view; never renewing would
 * sign an active learner out mid-exam.
 */
export const SESSION_RENEW_WITHIN_MS = 15 * 24 * 60 * 60 * 1000;

export type ValidatedSession = {
	user: AuthUser;
	expiresAt: Date;
	/** True when the expiry was just extended, so the caller re-sets the cookie. */
	renewed: boolean;
};

/** 32 bytes of randomness — the value that goes in the cookie, and nowhere else. */
export function createSessionToken(): string {
	return randomToken();
}

/** The database key for a token. Plain SHA-256: the token is already high-entropy. */
export async function hashSessionToken(token: string): Promise<string> {
	return sha256Hex(token);
}

export async function createSession(
	db: Database,
	userId: number,
	now: Date = new Date()
): Promise<{ token: string; expiresAt: Date }> {
	const token = createSessionToken();
	const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

	await db.insert(sessions).values({ id: await hashSessionToken(token), userId, expiresAt });

	return { token, expiresAt };
}

export async function validateSession(
	db: Database,
	token: string,
	now: Date = new Date()
): Promise<ValidatedSession | null> {
	if (!token) {
		return null;
	}

	const id = await hashSessionToken(token);

	const [found] = await db
		.select({
			expiresAt: sessions.expiresAt,
			user: {
				id: users.id,
				publicId: users.publicId,
				email: users.email,
				displayName: users.displayName,
				avatarUrl: users.avatarUrl,
				role: users.role,
				status: users.status
			}
		})
		.from(sessions)
		.innerJoin(users, eq(users.id, sessions.userId))
		.where(eq(sessions.id, id))
		.limit(1);

	if (!found) {
		return null;
	}

	if (found.expiresAt.getTime() <= now.getTime()) {
		// Reaped on the way past, so an abandoned session does not sit there forever
		// waiting for the scheduled sweep.
		await db.delete(sessions).where(eq(sessions.id, id));

		return null;
	}

	const renewed = found.expiresAt.getTime() - now.getTime() < SESSION_RENEW_WITHIN_MS;
	const expiresAt = renewed ? new Date(now.getTime() + SESSION_TTL_MS) : found.expiresAt;

	if (renewed) {
		await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id));
	}

	return { user: found.user, expiresAt, renewed };
}

/** Signing out. Deleting the row is the point; clearing the cookie is housekeeping. */
export async function invalidateSession(db: Database, token: string): Promise<void> {
	if (!token) {
		return;
	}

	await db.delete(sessions).where(eq(sessions.id, await hashSessionToken(token)));
}

export function setSessionCookie(cookies: Cookies, token: string, expiresAt: Date): void {
	cookies.set(SESSION_COOKIE, token, {
		httpOnly: true,
		secure: true,
		// Lax rather than Strict: the OAuth callback is a cross-site top-level navigation,
		// and a Strict cookie would not be sent on it — sign-in would appear to succeed and
		// land the user straight back on a signed-out page.
		sameSite: 'lax',
		path: '/',
		expires: expiresAt
	});
}

export function clearSessionCookie(cookies: Cookies): void {
	// Same path it was set with, or the browser keeps the old cookie alongside the new.
	cookies.delete(SESSION_COOKIE, { path: '/' });
}
