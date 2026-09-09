import { error } from '@sveltejs/kit';

import type { AuthUser } from './user';

/**
 * The authorization rule for every `/admin` route.
 *
 * Takes a user rather than a `RequestEvent` so it stays a pure decision that can be
 * exhaustively tested, and so it survives the switch from the dev identity stub to real
 * sessions untouched.
 */
export function assertAdmin(user: AuthUser | null): asserts user is AuthUser {
	// 401 rather than 403: signing in could plausibly fix this one.
	if (!user) {
		error(401, 'Sign in to use the admin dashboard.');
	}

	if (user.role !== 'ADMIN') {
		error(403, 'This area is for administrators.');
	}

	// A suspended administrator keeps role = ADMIN, so status has to be checked too —
	// suspension that did not revoke admin access would not be suspension.
	if (user.status !== 'ACTIVE') {
		error(403, 'This account is suspended.');
	}
}
