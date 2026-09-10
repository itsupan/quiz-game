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

/** Any origin will do: it exists only so a relative path can be resolved and compared. */
const PROBE_ORIGIN = 'https://return-to.invalid';

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

	// Rejected before parsing. The URL parser STRIPS tab, CR and LF rather than failing on
	// them, so `/<TAB>/evil.test/phish` passes a naive prefix check, survives verbatim in a
	// Location header, and resolves in the browser to https://evil.test/phish. A blocklist
	// of prefixes cannot catch that; a control-character check plus the origin check below
	// can. CR and LF would also be header injection.
	// The no-control-regex rule is right in general and wrong here: matching control
	// characters is the entire point, because they are what the parser silently strips.
	// eslint-disable-next-line no-control-regex
	if (/[\u0000-\u001f\u007f]/.test(value)) {
		return '/';
	}

	// Resolve exactly as a browser would, then insist the result never left this origin.
	// This is the check that actually holds: it does not care which trick was used.
	let resolved: URL;

	try {
		resolved = new URL(value, PROBE_ORIGIN);
	} catch {
		return '/';
	}

	if (resolved.origin !== PROBE_ORIGIN) {
		return '/';
	}

	// The normalised form, not the input, so nothing unusual survives into the header.
	const candidate = resolved.pathname + resolved.search + resolved.hash;

	// Checked AGAIN, because normalising can produce a path that is itself hostile:
	// `/..//evil.test` resolves to a pathname of `//evil.test`, which is protocol-relative
	// the moment it is put in a Location header. One pass is not enough.
	try {
		if (new URL(candidate, PROBE_ORIGIN).origin !== PROBE_ORIGIN) {
			return '/';
		}
	} catch {
		return '/';
	}

	return candidate;
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
