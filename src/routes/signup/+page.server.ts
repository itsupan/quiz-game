import { fail, redirect } from '@sveltejs/kit';
import { registerUser } from '$lib/server/auth/credentials';
import { SignInError } from '$lib/server/auth/errors';
import { safeReturnTo } from '$lib/server/auth/flow';
import { createSession, setSessionCookie } from '$lib/server/auth/session';
import type { Actions, PageServerLoad } from './$types';

function getDestination(target: string | null | undefined, role: string | undefined): string {
	const returnTo = safeReturnTo(target);
	return returnTo === '/' && role !== 'ADMIN' ? '/home' : returnTo;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) {
		redirect(303, getDestination(url.searchParams.get('redirectTo'), locals.user.role));
	}

	return {};
};

export const actions: Actions = {
	default: async ({ request, locals, cookies, url }) => {
		const data = await request.formData();
		const name = String(data.get('name') ?? '');
		const email = String(data.get('email') ?? '');
		const password = String(data.get('password') ?? '');
		const rawTarget =
			(data.get('redirectTo') as string | null) ?? url.searchParams.get('redirectTo');

		let destination: string;

		try {
			const user = await registerUser(locals.db, { email, password, displayName: name });
			const session = await createSession(locals.db, user.id);
			setSessionCookie(cookies, session.token, session.expiresAt);
			destination = getDestination(rawTarget, user.role);
		} catch (error) {
			if (error instanceof SignInError) {
				return fail(400, { error: error.message, name, email });
			}

			console.error('[auth] signup error', error);
			return fail(500, {
				error: 'Registration is temporarily unavailable. Please try again.',
				name,
				email
			});
		}

		redirect(303, destination);
	}
};
