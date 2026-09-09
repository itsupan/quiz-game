/**
 * Base64url and hashing helpers shared by the auth modules.
 *
 * Every value in this flow — session tokens, PKCE verifiers, state, nonces, JWT segments —
 * is base64url, and getting the `+/=` substitutions subtly wrong in one of four copies is
 * exactly the kind of bug that only shows up for some random inputs.
 */

export function base64urlEncode(bytes: Uint8Array): string {
	let binary = '';

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

/** Returns a Uint8Array over a plain ArrayBuffer, which is what Web Crypto accepts. */
export function base64urlDecode(value: string): Uint8Array<ArrayBuffer> {
	const padded = value.replaceAll('-', '+').replaceAll('_', '/');
	const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));

	return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

/** A fresh unguessable value: session tokens, PKCE verifiers, state and nonces. */
export function randomToken(bytes = 32): string {
	const buffer = new Uint8Array(bytes);

	crypto.getRandomValues(buffer);

	return base64urlEncode(buffer);
}

export async function sha256(input: string): Promise<Uint8Array<ArrayBuffer>> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));

	return new Uint8Array(digest);
}

export async function sha256Hex(input: string): Promise<string> {
	return [...(await sha256(input))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
