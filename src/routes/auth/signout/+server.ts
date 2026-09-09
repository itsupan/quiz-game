import { redirect } from '@sveltejs/kit';

import { SESSION_COOKIE, clearSessionCookie, invalidateSession } from '$lib/server/auth/session';
import type { RequestHandler } from './$types';

/**
 * Signs out.
 *
 * POST only, so a stray link or an <img> cannot sign someone out, and so SvelteKit's
 * origin check applies. Deleting the row is what makes this real: a browser that keeps the
 * cookie still has nothing to match against.
 */
export const POST: RequestHandler = async ({ cookies, locals }) => {
	const token = cookies.get(SESSION_COOKIE);

	if (token) {
		await invalidateSession(locals.db, token);
	}

	clearSessionCookie(cookies);

	redirect(303, '/');
};
