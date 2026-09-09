import { error, type Cookies } from '@sveltejs/kit';

/**
 * The short-lived state carried across the redirect to Google, and the configuration the
 * flow needs.
 */

export const STATE_COOKIE = 'oauth_state';
export const VERIFIER_COOKIE = 'oauth_verifier';
export const NONCE_COOKIE = 'oauth_nonce';
export const RETURN_TO_COOKIE = 'oauth_return_to';

/** Long enough to read a consent screen, short enough not to linger. */
const FLOW_TTL_SECONDS = 10 * 60;

const FLOW_COOKIE = {
	httpOnly: true,
	secure: true,
	// Lax, not Strict: these have to survive Google's redirect back, which is a cross-site
	// top-level navigation. Strict would drop them and every sign-in would fail on state.
	sameSite: 'lax',
	path: '/',
	maxAge: FLOW_TTL_SECONDS
} as const;

export type GoogleConfig = { clientId: string; clientSecret: string; bootstrapEmails?: string };

/**
 * Reads the Google credentials, failing loudly when they are missing.
 *
 * They are secrets, so they live in `.dev.vars` locally and are pushed with
 * `wrangler secret put` per environment. A deploy without them would otherwise fail deep
 * inside the token exchange with something unhelpful.
 */
export function googleConfig(platform: App.Platform | undefined): GoogleConfig {
	const clientId = platform?.env?.GOOGLE_CLIENT_ID;
	const clientSecret = platform?.env?.GOOGLE_CLIENT_SECRET;

	if (!clientId || !clientSecret) {
		error(
			500,
			'Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .dev.vars, or push them with `wrangler secret put --env <environment>`.'
		);
	}

	return { clientId, clientSecret, bootstrapEmails: platform?.env?.BOOTSTRAP_ADMIN_EMAILS };
}

/**
 * Where to send someone after signing in.
 *
 * Only a path on this site is ever accepted. Anything else — an absolute URL, a
 * protocol-relative `//evil.test`, a backslash some parsers treat as a slash — is an open
 * redirect, which turns the sign-in link into a convincing way to bounce someone off to a
 * phishing page.
 */
export function safeReturnTo(value: string | null | undefined): string {
	if (!value || !value.startsWith('/')) {
		return '/';
	}

	if (value.startsWith('//') || value.startsWith('/\\')) {
		return '/';
	}

	// A newline in a Location header is header injection.
	if (/[\r\n]/.test(value)) {
		return '/';
	}

	return value;
}

export function setFlowCookies(
	cookies: Cookies,
	flow: { state: string; codeVerifier: string; nonce: string; returnTo: string }
): void {
	cookies.set(STATE_COOKIE, flow.state, FLOW_COOKIE);
	cookies.set(VERIFIER_COOKIE, flow.codeVerifier, FLOW_COOKIE);
	cookies.set(NONCE_COOKIE, flow.nonce, FLOW_COOKIE);
	cookies.set(RETURN_TO_COOKIE, flow.returnTo, FLOW_COOKIE);
}

export function readFlowCookies(cookies: Cookies) {
	return {
		state: cookies.get(STATE_COOKIE),
		codeVerifier: cookies.get(VERIFIER_COOKIE),
		nonce: cookies.get(NONCE_COOKIE),
		returnTo: safeReturnTo(cookies.get(RETURN_TO_COOKIE))
	};
}

/** Cleared as soon as the callback has read them: they are good for one attempt only. */
export function clearFlowCookies(cookies: Cookies): void {
	for (const name of [STATE_COOKIE, VERIFIER_COOKIE, NONCE_COOKIE, RETURN_TO_COOKIE]) {
		cookies.delete(name, { path: '/' });
	}
}
