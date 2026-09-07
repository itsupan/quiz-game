/**
 * ULID generation for the `public_id` columns.
 *
 * Internal primary keys are integers; anything that appears in a URL — a quiz, an
 * attempt, a user — is addressed by a ULID instead, so nobody can walk `/quiz/1`,
 * `/quiz/2` to enumerate the catalogue or infer how many attempts exist.
 *
 * A ULID is 26 Crockford base32 characters: a 48-bit millisecond timestamp followed by
 * 80 bits of randomness. Because the timestamp leads, IDs sort by creation time, which
 * keeps the unique index on them from fragmenting the way a random UUID would.
 *
 * Hand-rolled rather than pulled from npm: it is twenty lines, it removes a dependency
 * from the Worker bundle, and `crypto.getRandomValues` is available both in workerd and
 * in Node 22, so the same code runs in tests and in production.
 */

/** Crockford base32 — no I, L, O or U, so IDs cannot be misread aloud or mistyped. */
const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TIME_LENGTH = 10;
const RANDOM_LENGTH = 16;

export const PUBLIC_ID_LENGTH = TIME_LENGTH + RANDOM_LENGTH;

function encodeTime(milliseconds: number): string {
	let remaining = milliseconds;
	let encoded = '';

	for (let i = 0; i < TIME_LENGTH; i++) {
		const digit = remaining % 32;
		encoded = ENCODING[digit] + encoded;
		remaining = (remaining - digit) / 32;
	}

	return encoded;
}

function encodeRandom(): string {
	const bytes = new Uint8Array(RANDOM_LENGTH);
	crypto.getRandomValues(bytes);

	// A uniform byte masked to its low 5 bits stays uniform over 0-31, because 256 is a
	// whole multiple of 32 — so this discards no entropy and needs no rejection loop.
	let encoded = '';
	for (const byte of bytes) {
		encoded += ENCODING[byte & 0x1f];
	}

	return encoded;
}

/** Returns a new 26-character ULID for a `public_id` column. */
export function newPublicId(now: number = Date.now()): string {
	return encodeTime(now) + encodeRandom();
}
