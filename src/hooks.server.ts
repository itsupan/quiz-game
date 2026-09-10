import { sequence } from '@sveltejs/kit/hooks';
import { error, redirect, type Handle } from '@sveltejs/kit';

import { getDb } from '$lib/server/db';
import { assertAdmin } from '$lib/server/auth/guards';
import { resolveUser } from '$lib/server/auth/user';

/**
 * Attaches a per-request Drizzle client to `event.locals`, so routes query the
 * database through `locals.db` and never touch `platform` directly.
 */
const database: Handle = async ({ event, resolve }) => {
	event.locals.db = getDb(event.platform);

	return resolve(event);
};

/**
 * Attaches the signed-in user, or null. Runs after `database` because resolving the
 * user reads from `locals.db`.
 */
const authentication: Handle = async ({ event, resolve }) => {
	event.locals.user = await resolveUser(event);

	return resolve(event);
};

/**
 * The authorization gate for the whole dashboard.
 *
 * It lives here, not in `/admin/+layout.server.ts`, because SvelteKit runs a form action
 * BEFORE the loads of the page it belongs to. A guard in the layout load therefore never
 * sees a POST to `/admin/quizzes?/archive` until after the quiz is already archived —
 * hiding the button would have been the only thing standing in the way. A hook runs for
 * every request to the path, whatever its method, so the guard cannot be routed around.
 *
 * `/media/[publicId]` is deliberately outside `/admin`: learners must be able to load the
 * image or audio a question uses.
 */
const adminOnly: Handle = async ({ event, resolve }) => {
	const isAdminPath = event.url.pathname === '/admin' || event.url.pathname.startsWith('/admin/');

	if (isAdminPath) {
		const isNavigation = event.request.method === 'GET' || event.request.method === 'HEAD';

		if (!event.locals.user && isNavigation) {
			// Someone who has simply not signed in yet gets sent to do that, and comes back
			// to where they were going. Throwing 401 here instead renders SvelteKit's
			// fallback error page — which, because an error from a hook has no layout, has
			// no header and so no way to sign in at all.
			//
			// Navigations only. Redirecting a POST to Google would lose the form body and
			// silently discard whatever the person was submitting, so those still get 401.
			redirect(
				302,
				`/auth/google?redirectTo=${encodeURIComponent(event.url.pathname + event.url.search)}`
			);
		}

		// Signed in but not an administrator is a genuine 403: signing in again changes
		// nothing, so there is nowhere useful to send them.
		assertAdmin(event.locals.user);
	}

	return resolve(event);
};

/**
 * The authorization gate for learner dashboard routes.
 *
 * Prevents unauthorized users from accessing /home and other learner sections.
 * Navigations are redirected to /login with returnTo query param; API/POST requests receive 401.
 */
const learnerAuth: Handle = async ({ event, resolve }) => {
	const pathname = event.url.pathname;
	const isLearnerProtected =
		pathname === '/home' ||
		pathname.startsWith('/home/') ||
		pathname === '/practice' ||
		pathname.startsWith('/practice/') ||
		pathname === '/leaderboard' ||
		pathname.startsWith('/leaderboard/') ||
		pathname === '/analytics' ||
		pathname.startsWith('/analytics/');

	if (isLearnerProtected && !event.locals.user) {
		const isNavigation = event.request.method === 'GET' || event.request.method === 'HEAD';

		if (isNavigation) {
			redirect(
				302,
				`/login?redirectTo=${encodeURIComponent(event.url.pathname + event.url.search)}`
			);
		}

		error(401, 'Unauthorized');
	}

	if (isLearnerProtected && event.locals.user?.role === 'ADMIN') {
		const isNavigation = event.request.method === 'GET' || event.request.method === 'HEAD';
		if (isNavigation) {
			redirect(302, '/admin');
		}
	}

	if (pathname === '/' && event.locals.user && event.locals.user.role !== 'ADMIN') {
		const isNavigation = event.request.method === 'GET' || event.request.method === 'HEAD';
		if (isNavigation) {
			redirect(302, '/home');
		}
	}

	return resolve(event);
};

export const handle = sequence(database, authentication, learnerAuth, adminOnly);
