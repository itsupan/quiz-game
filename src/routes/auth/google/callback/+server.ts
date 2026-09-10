import { error, redirect } from '@sveltejs/kit';

import { SignInError } from '$lib/server/auth/errors';
import { clearFlowCookies, googleConfig, readFlowCookies } from '$lib/server/auth/flow';
import { verifyIdToken } from '$lib/server/auth/jwt';
import { exchangeCode } from '$lib/server/auth/oauth';
import { createSession, setSessionCookie } from '$lib/server/auth/session';
import { upsertGoogleUser } from '$lib/server/auth/user';
import type { RequestHandler } from './$types';

/**
 * Finishes sign-in.
 *
 * Four things have to hold before anyone is signed in: the returned `state` matches the
 * cookie (this request came from a flow we started), Google accepts the code together with
 * the PKCE verifier (this browser started that flow), the ID token's signature and claims
 * verify, and its nonce matches. Only then does a user row or a session appear.
 */
export const GET: RequestHandler = async ({ cookies, fetch, locals, platform, url }) => {
	const flow = readFlowCookies(cookies);

	// Read once, then discarded: these are good for a single attempt.
	clearFlowCookies(cookies);

	// The consent screen's Cancel button. Not an error worth a stack trace.
	if (url.searchParams.get('error')) {
		redirect(303, '/');
	}

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');

	if (!code || !state || !flow.state || !flow.codeVerifier || !flow.nonce) {
		error(400, 'That sign-in link has expired. Please try again.');
	}

	if (state !== flow.state) {
		// Either a stale tab or a cross-site forgery; from here the two look identical.
		error(400, 'That sign-in could not be verified. Please try again.');
	}

	const { clientId, clientSecret, bootstrapEmails } = googleConfig(platform);

	let session: { token: string; expiresAt: Date };
	let userRole: string;

	try {
		const idToken = await exchangeCode({
			code,
			codeVerifier: flow.codeVerifier,
			redirectUri: new URL('/auth/google/callback', url.origin).toString(),
			clientId,
			clientSecret,
			fetch
		});

		const profile = await verifyIdToken(idToken, { clientId, nonce: flow.nonce });
		const user = await upsertGoogleUser(locals.db, profile, bootstrapEmails);
		userRole = user.role;

		if (user.status !== 'ACTIVE') {
			// Refused here as well as in `resolveUser`: issuing a session and then ignoring
			// it would leave a usable row in the table for no reason.
			throw new SignInError('This account has been suspended.');
		}

		session = await createSession(locals.db, user.id);
	} catch (cause) {
		// A deliberate refusal explains itself; anything else is a fault, and a stranger
		// gets a generic message while the detail goes to the log.
		if (cause instanceof SignInError) {
			error(400, cause.message);
		}

		console.error('[auth] sign-in failed', cause);

		error(502, 'Sign-in is temporarily unavailable. Please try again in a moment.');
	}

	setSessionCookie(cookies, session.token, session.expiresAt);

	const destination = flow.returnTo === '/' && userRole !== 'ADMIN' ? '/home' : flow.returnTo;
	redirect(303, destination);
};
