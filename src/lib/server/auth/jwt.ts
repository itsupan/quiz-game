/**
 * Google ID-token verification.
 *
 * The token is collected from Google's token endpoint over TLS, so OIDC §3.1.3.7 allows
 * skipping signature verification entirely. It is done here anyway, because that is what
 * makes this function safe to point at a token arriving from anywhere else — and because
 * "we trusted the transport" is a footnote nobody reads before reusing a helper.
 */

import { base64urlDecode } from './encoding';
import { SignInError } from './errors';

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

/** Google's issuer has been written both ways for years; both are legitimate. */
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

/** Allowance for clocks that disagree slightly. */
const CLOCK_SKEW_SECONDS = 60;

/** `kid` is not on the DOM's JsonWebKey, but every key in a JWKS carries one. */
export type JsonWebKeyWithKid = JsonWebKey & { kid?: string };

export type Jwks = { keys: JsonWebKeyWithKid[] };

export type GoogleProfile = {
	sub: string;
	email: string;
	emailVerified: boolean;
	name: string | null;
	picture: string | null;
};

export type VerifyOptions = {
	clientId: string;
	nonce: string;
	now?: Date;
	/** `force` bypasses the cache, for the key-rotation case below. */
	fetchJwks?: (options?: { force?: boolean }) => Promise<Jwks>;
};

type Cached = { jwks: Jwks; expiresAt: number };

/**
 * Module scope, so a warm isolate reuses the keys. They are public and Google publishes a
 * cache lifetime, so honouring it is both correct and much cheaper than a fetch per
 * sign-in.
 */
let cache: Cached | null = null;

function decodeSegment(segment: string): unknown {
	return JSON.parse(new TextDecoder().decode(base64urlDecode(segment)));
}

/** The default fetcher. Cached for as long as Google's `Cache-Control` allows. */
export async function fetchGoogleJwks(now: number = Date.now(), force = false): Promise<Jwks> {
	if (!force && cache && cache.expiresAt > now) {
		return cache.jwks;
	}

	const response = await fetch(GOOGLE_JWKS_URL);

	if (!response.ok) {
		throw new Error(`Could not fetch Google's signing keys (${response.status}).`);
	}

	const jwks = (await response.json()) as Jwks;
	const maxAge = Number(/max-age=(\d+)/.exec(response.headers.get('cache-control') ?? '')?.[1]);

	cache = {
		jwks,
		// A short floor rather than zero, so a missing header cannot mean a fetch per request.
		expiresAt: now + (Number.isFinite(maxAge) ? maxAge : 300) * 1000
	};

	return jwks;
}

/** Only used by tests, which need a cold cache between cases. */
export function resetJwksCache(): void {
	cache = null;
}

export async function verifyIdToken(token: string, options: VerifyOptions): Promise<GoogleProfile> {
	const {
		clientId,
		nonce,
		now = new Date(),
		fetchJwks = () => fetchGoogleJwks(now.getTime())
	} = options;

	const parts = token.split('.');

	if (parts.length !== 3) {
		throw new SignInError('The ID token is malformed.');
	}

	const [encodedHeader, encodedPayload, encodedSignature] = parts;
	const header = decodeSegment(encodedHeader) as { alg?: string; kid?: string };

	// Checked before anything else. Accepting `none` would make the signature optional,
	// and accepting an HMAC algorithm would let a public key be used as a shared secret.
	if (header.alg !== 'RS256') {
		throw new SignInError('The ID token must be signed with RS256.');
	}

	if (!header.kid) {
		throw new SignInError('The ID token names no signing key.');
	}

	let { keys } = await fetchJwks();
	let jwk = keys.find((key) => key.kid === header.kid);

	if (!jwk) {
		// Google's keys are cached for the hours its Cache-Control allows, so a key added
		// during that window is unknown to a warm isolate. Without this refetch every
		// sign-in on that isolate fails until the cache lapses, with no way to recover.
		({ keys } = await fetchJwks({ force: true }));
		jwk = keys.find((key) => key.kid === header.kid);
	}

	if (!jwk) {
		throw new SignInError('The ID token was signed with an unknown key.');
	}

	const key = await crypto.subtle.importKey(
		'jwk',
		jwk,
		{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
		false,
		['verify']
	);

	const signed = await crypto.subtle.verify(
		'RSASSA-PKCS1-v1_5',
		key,
		base64urlDecode(encodedSignature),
		new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
	);

	if (!signed) {
		throw new SignInError('The ID token signature does not match.');
	}

	const claims = decodeSegment(encodedPayload) as Record<string, unknown>;
	const seconds = Math.floor(now.getTime() / 1000);

	if (typeof claims.iss !== 'string' || !ISSUERS.includes(claims.iss)) {
		throw new SignInError('The ID token has the wrong issuer.');
	}

	if (claims.aud !== clientId) {
		// A token minted for another application is not evidence about this one.
		throw new SignInError('The ID token has the wrong audience.');
	}

	if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_SECONDS < seconds) {
		throw new SignInError('The ID token has expired.');
	}

	if (typeof claims.iat !== 'number' || claims.iat - CLOCK_SKEW_SECONDS > seconds) {
		throw new SignInError('The ID token was issued in the future.');
	}

	if (claims.nonce !== nonce) {
		// Ties the token to the browser that started this sign-in, so one cannot be replayed.
		throw new SignInError('The ID token nonce does not match this sign-in.');
	}

	if (typeof claims.sub !== 'string' || claims.sub === '') {
		throw new SignInError('The ID token carries no subject.');
	}

	if (typeof claims.email !== 'string' || claims.email === '') {
		throw new SignInError('The ID token carries no email address.');
	}

	if (claims.email_verified !== true) {
		// An unverified address may belong to someone else, and `users.email` is unique.
		throw new SignInError('That Google account has no verified email address.');
	}

	return {
		sub: claims.sub,
		email: claims.email,
		emailVerified: true,
		name: typeof claims.name === 'string' ? claims.name : null,
		picture: typeof claims.picture === 'string' ? claims.picture : null
	};
}
