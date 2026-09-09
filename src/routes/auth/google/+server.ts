import { redirect } from '@sveltejs/kit';

import { googleConfig, safeReturnTo, setFlowCookies } from '$lib/server/auth/flow';
import { createAuthorizationRequest } from '$lib/server/auth/oauth';
import type { RequestHandler } from './$types';

/**
 * Starts sign-in.
 *
 * The state, PKCE verifier and nonce are generated here and kept in short-lived HTTP-only
 * cookies; only the state and the hashed challenge travel to Google. `redirect_uri` is
 * derived from this request's origin, so local, preview, staging and production all share
 * one code path — each origin simply has to be registered with Google.
 */
export const GET: RequestHandler = async ({ cookies, url, platform }) => {
	const { clientId } = googleConfig(platform);

	const request = await createAuthorizationRequest({
		clientId,
		redirectUri: new URL('/auth/google/callback', url.origin).toString()
	});

	setFlowCookies(cookies, {
		state: request.state,
		codeVerifier: request.codeVerifier,
		nonce: request.nonce,
		// So signing in from /admin comes back to /admin. Validated, or the sign-in link
		// becomes an open redirect.
		returnTo: safeReturnTo(url.searchParams.get('redirectTo'))
	});

	redirect(302, request.url);
};
