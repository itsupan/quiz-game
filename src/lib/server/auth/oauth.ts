import { base64urlEncode, randomToken, sha256 } from './encoding';
import { SignInError } from './errors';

/**
 * The Google half of the sign-in flow: authorization-code with PKCE.
 *
 * Pure apart from `fetch`, which is injectable, so the whole thing is testable without a
 * network or a Google account.
 */

export const GOOGLE_AUTHORIZATION_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/** Everything sign-in needs and nothing else. */
export const GOOGLE_SCOPE = 'openid email profile';

export type AuthorizationRequest = {
	url: string;
	/** Round-tripped through Google and compared on return: CSRF protection. */
	state: string;
	/** Kept server-side; only its hash is sent. Binds the code to this browser. */
	codeVerifier: string;
	/** Embedded in the ID token, so a token from another sign-in cannot be replayed. */
	nonce: string;
};

export async function createAuthorizationRequest(options: {
	clientId: string;
	redirectUri: string;
}): Promise<AuthorizationRequest> {
	const state = randomToken();
	const codeVerifier = randomToken();
	const nonce = randomToken();

	const url = new URL(GOOGLE_AUTHORIZATION_URL);

	url.search = new URLSearchParams({
		client_id: options.clientId,
		redirect_uri: options.redirectUri,
		response_type: 'code',
		scope: GOOGLE_SCOPE,
		state,
		nonce,
		code_challenge: base64urlEncode(await sha256(codeVerifier)),
		code_challenge_method: 'S256',
		// No refresh token is issued, so there is nothing long-lived to store or leak.
		access_type: 'online',
		// A shared machine should not silently reuse whoever signed in last.
		prompt: 'select_account'
	}).toString();

	return { url: url.toString(), state, codeVerifier, nonce };
}

/**
 * Trades the authorization code for an ID token.
 *
 * The client secret is sent here and only here, from the server, over TLS. The returned
 * token is still verified by `jwt.ts` before anything is believed.
 */
export async function exchangeCode(options: {
	code: string;
	codeVerifier: string;
	redirectUri: string;
	clientId: string;
	clientSecret: string;
	fetch?: typeof fetch;
}): Promise<string> {
	const request = options.fetch ?? fetch;

	const response = await request(GOOGLE_TOKEN_URL, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'authorization_code',
			code: options.code,
			code_verifier: options.codeVerifier,
			redirect_uri: options.redirectUri,
			client_id: options.clientId,
			client_secret: options.clientSecret
		}).toString()
	});

	const payload = (await response.json().catch(() => ({}))) as {
		id_token?: string;
		error?: string;
		error_description?: string;
	};

	if (!response.ok) {
		// Google names the cause — `invalid_grant` for a replayed or expired code,
		// `redirect_uri_mismatch` for an unregistered origin. Passing it through is the
		// difference between a five-minute fix and an afternoon.
		const reason = payload.error_description ?? payload.error ?? `HTTP ${response.status}`;

		throw new SignInError(`Google rejected the sign-in: ${reason}. Please try again.`);
	}

	if (!payload.id_token) {
		throw new Error('Google returned no ID token.');
	}

	return payload.id_token;
}
