import { describe, expect, it } from 'vitest';

import { base64urlEncode, sha256 } from './encoding';
import { GOOGLE_SCOPE, GOOGLE_TOKEN_URL, createAuthorizationRequest, exchangeCode } from './oauth';

const CLIENT_ID = '1234567890-abc.apps.googleusercontent.com';
const CLIENT_SECRET = 'GOCSPX-secret';
const REDIRECT_URI = 'http://localhost:5173/auth/google/callback';

const request = () =>
	createAuthorizationRequest({ clientId: CLIENT_ID, redirectUri: REDIRECT_URI });

describe('createAuthorizationRequest', () => {
	it('points at Google with the parameters the flow needs', async () => {
		const { url, state, nonce } = await request();
		const parsed = new URL(url);

		expect(parsed.origin + parsed.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
		expect(Object.fromEntries(parsed.searchParams)).toMatchObject({
			client_id: CLIENT_ID,
			redirect_uri: REDIRECT_URI,
			response_type: 'code',
			scope: GOOGLE_SCOPE,
			state,
			nonce,
			code_challenge_method: 'S256'
		});
	});

	it('asks for no more than sign-in needs', async () => {
		// openid/email/profile only: no Gmail, no Drive, nothing that would make the
		// consent screen alarming or require verification.
		expect(GOOGLE_SCOPE).toBe('openid email profile');
	});

	it('requests online access, so Google issues no refresh token to store', async () => {
		const parsed = new URL((await request()).url);

		expect(parsed.searchParams.get('access_type')).toBe('online');
	});

	it('always shows the account chooser', async () => {
		// On a shared machine, silently reusing the last Google account is a surprise.
		const parsed = new URL((await request()).url);

		expect(parsed.searchParams.get('prompt')).toBe('select_account');
	});

	it('sends the S256 challenge, never the verifier', async () => {
		const { url, codeVerifier } = await request();
		const challenge = new URL(url).searchParams.get('code_challenge');

		expect(challenge).toBe(base64urlEncode(await sha256(codeVerifier)));
		expect(url).not.toContain(codeVerifier);
	});

	it('produces a verifier within the length RFC 7636 allows', async () => {
		const { codeVerifier } = await request();

		expect(codeVerifier).toMatch(/^[A-Za-z0-9\-._~]{43,128}$/);
	});

	it('never repeats state, verifier or nonce', async () => {
		const requests = await Promise.all(Array.from({ length: 100 }, request));

		for (const key of ['state', 'codeVerifier', 'nonce'] as const) {
			expect(new Set(requests.map((one) => one[key])).size).toBe(100);
		}
	});
});

describe('exchangeCode', () => {
	const call = (fetchImpl: typeof fetch) =>
		exchangeCode({
			code: 'the-code',
			codeVerifier: 'the-verifier',
			redirectUri: REDIRECT_URI,
			clientId: CLIENT_ID,
			clientSecret: CLIENT_SECRET,
			fetch: fetchImpl
		});

	it('posts the authorization code and PKCE verifier as a form', async () => {
		let seen: { url: string; init: RequestInit } | null = null;

		const idToken = await call((async (url: string, init: RequestInit) => {
			seen = { url, init };

			return new Response(JSON.stringify({ id_token: 'the.id.token' }), {
				headers: { 'content-type': 'application/json' }
			});
		}) as unknown as typeof fetch);

		expect(idToken).toBe('the.id.token');
		expect(seen!.url).toBe(GOOGLE_TOKEN_URL);
		expect(seen!.init.method).toBe('POST');

		const body = Object.fromEntries(new URLSearchParams(seen!.init.body as string));

		expect(body).toEqual({
			grant_type: 'authorization_code',
			code: 'the-code',
			code_verifier: 'the-verifier',
			redirect_uri: REDIRECT_URI,
			client_id: CLIENT_ID,
			client_secret: CLIENT_SECRET
		});
	});

	it('reports Google’s own error rather than a bare status', async () => {
		const failing = (async () =>
			new Response(JSON.stringify({ error: 'invalid_grant' }), {
				status: 400,
				headers: { 'content-type': 'application/json' }
			})) as unknown as typeof fetch;

		// invalid_grant is what a replayed or expired code looks like, and knowing that
		// is the difference between a five-minute fix and an afternoon.
		await expect(call(failing)).rejects.toThrow(/invalid_grant/);
	});

	it('refuses a response with no ID token', async () => {
		const tokenless = (async () =>
			new Response(JSON.stringify({ access_token: 'only-this' }), {
				headers: { 'content-type': 'application/json' }
			})) as unknown as typeof fetch;

		await expect(call(tokenless)).rejects.toThrow(/id token/i);
	});
});
