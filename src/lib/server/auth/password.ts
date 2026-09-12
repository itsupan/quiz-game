/**
 * Password hashing and verification using Web Crypto PBKDF2-HMAC-SHA256.
 *
 * Runs natively in Cloudflare Workers and Node.js with zero native binary dependencies.
 * Uses 600,000 iterations of PBKDF2 with SHA-256 and a cryptographically random 16-byte salt,
 * matching the current OWASP recommendation. The iteration count stays encoded in every
 * hash so older values remain verifiable and can be upgraded after a successful login.
 */

const ITERATIONS = 600_000;
const KEY_LENGTH_BITS = 256;
const SALT_BYTES = 16;
const PREFIX = 'pbkdf2:sha256';

const encoder = new TextEncoder();

export function validatePasswordStrength(password: string): string | null {
	if (!password || password.length < 8) {
		return 'Password must be at least 8 characters long.';
	}
	if (password.length > 256) {
		return 'Password must be 256 characters or fewer.';
	}
	return null;
}

export async function hashPassword(password: string): Promise<string> {
	const salt = new Uint8Array(SALT_BYTES);
	crypto.getRandomValues(salt);

	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		encoder.encode(password),
		'PBKDF2',
		false,
		['deriveBits']
	);

	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			salt,
			iterations: ITERATIONS,
			hash: 'SHA-256'
		},
		keyMaterial,
		KEY_LENGTH_BITS
	);

	const saltHex = [...salt].map((byte) => byte.toString(16).padStart(2, '0')).join('');
	const hashHex = [...new Uint8Array(derivedBits)]
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');

	return `${PREFIX}:${ITERATIONS}:${saltHex}:${hashHex}`;
}

export function passwordNeedsRehash(storedHash: string): boolean {
	const parts = storedHash.split(':');
	if (parts.length !== 5 || parts[0] !== 'pbkdf2' || parts[1] !== 'sha256') {
		return true;
	}

	const iterations = Number(parts[2]);

	return !Number.isInteger(iterations) || iterations < ITERATIONS;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
	if (!password || !storedHash) {
		return false;
	}

	const parts = storedHash.split(':');
	if (parts.length !== 5 || parts[0] !== 'pbkdf2' || parts[1] !== 'sha256') {
		return false;
	}

	const iterations = parseInt(parts[2], 10);
	const saltHex = parts[3];
	const expectedHashHex = parts[4];

	if (isNaN(iterations) || iterations < 1 || !saltHex || !expectedHashHex) {
		return false;
	}

	const saltMatches = saltHex.match(/.{1,2}/g);
	if (!saltMatches) {
		return false;
	}

	const salt = new Uint8Array(saltMatches.map((byte) => parseInt(byte, 16)));

	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		encoder.encode(password),
		'PBKDF2',
		false,
		['deriveBits']
	);

	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			salt,
			iterations,
			hash: 'SHA-256'
		},
		keyMaterial,
		KEY_LENGTH_BITS
	);

	const derivedHashHex = [...new Uint8Array(derivedBits)]
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');

	if (derivedHashHex.length !== expectedHashHex.length) {
		return false;
	}

	// Constant-time string comparison to prevent timing attacks.
	let diff = 0;
	for (let i = 0; i < derivedHashHex.length; i++) {
		diff |= derivedHashHex.charCodeAt(i) ^ expectedHashHex.charCodeAt(i);
	}

	return diff === 0;
}
