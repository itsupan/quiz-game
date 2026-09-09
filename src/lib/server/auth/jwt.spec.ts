import { beforeAll, describe, expect, it } from 'vitest';

import { verifyIdToken, type Jwks } from './jwt';

const CLIENT_ID = '1234567890-abc.apps.googleusercontent.com';
const NONCE = 'the-nonce';
const KID = 'test-key-1';
const NOW = new Date('2026-09-09T12:00:00Z');

let keyPair: CryptoKeyPair;
let jwks: Jwks;

function base64url(input: string | Uint8Array): string {
	const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
	let binary = '';

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

/** Mints an ID token the way Google would, so the verifier is exercised for real. */
async function signToken(
	claims: Record<string, unknown> = {},
	header: Record<string, unknown> = {}
): Promise<string> {
	const fullHeader = base64url(JSON.stringify({ alg: 'RS256', kid: KID, typ: 'JWT', ...header }));
	const seconds = Math.floor(NOW.getTime() / 1000);

	const payload = base64url(
		JSON.stringify({
			iss: 'https://accounts.google.com',
			aud: CLIENT_ID,
			sub: '110169484474386276334',
			email: 'learner@example.com',
			email_verified: true,
			name: '学習者テスト',
			picture: 'https://lh3.googleusercontent.com/a/abc',
			nonce: NONCE,
			iat: seconds - 10,
			exp: seconds + 3600,
			...claims
		})
	);

	const signature = await crypto.subtle.sign(
		'RSASSA-PKCS1-v1_5',
		keyPair.privateKey,
		new TextEncoder().encode(`${fullHeader}.${payload}`)
	);

	return `${fullHeader}.${payload}.${base64url(new Uint8Array(signature))}`;
}

const verify = (token: string, overrides: Record<string, unknown> = {}) =>
	verifyIdToken(token, {
		clientId: CLIENT_ID,
		nonce: NONCE,
		now: NOW,
		fetchJwks: async () => jwks,
		...overrides
	});

beforeAll(async () => {
	keyPair = (await crypto.subtle.generateKey(
		{
			name: 'RSASSA-PKCS1-v1_5',
			modulusLength: 2048,
			publicExponent: new Uint8Array([1, 0, 1]),
			hash: 'SHA-256'
		},
		true,
		['sign', 'verify']
	)) as CryptoKeyPair;

	const publicKey = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

	jwks = { keys: [{ ...publicKey, kid: KID, alg: 'RS256', use: 'sig' }] };
});

describe('verifyIdToken', () => {
	it('accepts a well-formed Google token and returns the profile', async () => {
		const profile = await verify(await signToken());

		expect(profile).toEqual({
			sub: '110169484474386276334',
			email: 'learner@example.com',
			emailVerified: true,
			name: '学習者テスト',
			picture: 'https://lh3.googleusercontent.com/a/abc'
		});
	});

	it('accepts the bare issuer Google also uses', async () => {
		await expect(verify(await signToken({ iss: 'accounts.google.com' }))).resolves.toBeDefined();
	});

	it('rejects a tampered payload', async () => {
		const token = await signToken();
		const [header, , signature] = token.split('.');
		const forged = base64url(JSON.stringify({ sub: 'attacker', aud: CLIENT_ID }));

		// The signature no longer covers the payload — this is the case that matters.
		await expect(verify(`${header}.${forged}.${signature}`)).rejects.toThrow(/signature/i);
	});

	it('rejects alg: none, however well-formed the rest is', async () => {
		const header = base64url(JSON.stringify({ alg: 'none', kid: KID }));
		const payload = (await signToken()).split('.')[1];

		await expect(verify(`${header}.${payload}.`)).rejects.toThrow(/RS256/i);
	});

	it('rejects a symmetric algorithm, which would let the public key act as a secret', async () => {
		const header = base64url(JSON.stringify({ alg: 'HS256', kid: KID }));
		const payload = (await signToken()).split('.')[1];

		await expect(verify(`${header}.${payload}.signature`)).rejects.toThrow(/RS256/i);
	});

	it('rejects a key id that is not in the JWKS', async () => {
		await expect(verify(await signToken({}, { kid: 'someone-elses-key' }))).rejects.toThrow(/key/i);
	});

	it('rejects a token minted for a different client', async () => {
		await expect(
			verify(await signToken({ aud: 'another-app.apps.googleusercontent.com' }))
		).rejects.toThrow(/audience/i);
	});

	it('rejects a token from a different issuer', async () => {
		await expect(verify(await signToken({ iss: 'https://evil.example.com' }))).rejects.toThrow(
			/issuer/i
		);
	});

	it('rejects a token expired beyond the clock-skew allowance', async () => {
		const seconds = Math.floor(NOW.getTime() / 1000);

		await expect(verify(await signToken({ exp: seconds - 120 }))).rejects.toThrow(/expired/i);
	});

	it('rejects a token issued in the future beyond the clock-skew allowance', async () => {
		const seconds = Math.floor(NOW.getTime() / 1000);

		await expect(verify(await signToken({ iat: seconds + 600 }))).rejects.toThrow(/issued/i);
	});

	it('tolerates a little clock skew in both directions', async () => {
		const seconds = Math.floor(NOW.getTime() / 1000);

		await expect(verify(await signToken({ iat: seconds + 30 }))).resolves.toBeDefined();
		await expect(verify(await signToken({ exp: seconds - 30 }))).resolves.toBeDefined();
	});

	it('rejects a replayed token from a different sign-in attempt', async () => {
		// The nonce ties the token to the browser that started the flow.
		await expect(verify(await signToken({ nonce: 'a-different-nonce' }))).rejects.toThrow(/nonce/i);
	});

	it('rejects an unverified email address', async () => {
		// An unverified Google address may belong to someone else entirely, and `email` is
		// the unique key on the users table.
		await expect(verify(await signToken({ email_verified: false }))).rejects.toThrow(/verified/i);
	});

	it('rejects a token with no email, since a user row cannot exist without one', async () => {
		await expect(verify(await signToken({ email: undefined }))).rejects.toThrow(/email/i);
	});

	it.each(['', 'not-a-jwt', 'only.two', 'a.b.c.d'])('rejects malformed input %j', async (token) => {
		await expect(verify(token)).rejects.toThrow();
	});

	it('leaves optional profile fields null rather than undefined', async () => {
		const profile = await verify(await signToken({ name: undefined, picture: undefined }));

		expect(profile.name).toBeNull();
		expect(profile.picture).toBeNull();
	});
});
