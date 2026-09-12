import { describe, expect, it } from 'vitest';
import {
	hashPassword,
	passwordNeedsRehash,
	validatePasswordStrength,
	verifyPassword
} from '$lib/server/auth/password';

describe('password hashing and verification', () => {
	it('hashes and verifies a correct password', async () => {
		const password = 'mySecurePassword123!';
		const hash = await hashPassword(password);

		expect(hash).toMatch(/^pbkdf2:sha256:600000:[0-9a-f]{32}:[0-9a-f]{64}$/);
		expect(await verifyPassword(password, hash)).toBe(true);
	});

	it('identifies legacy work factors for upgrade', () => {
		expect(passwordNeedsRehash('pbkdf2:sha256:100000:salt:hash')).toBe(true);
		expect(passwordNeedsRehash('pbkdf2:sha256:600000:salt:hash')).toBe(false);
	});

	it('rejects an incorrect password', async () => {
		const hash = await hashPassword('correct-password');

		expect(await verifyPassword('wrong-password', hash)).toBe(false);
	});

	it('produces different hashes for the same password due to random salt', async () => {
		const password = 'repeatPassword123!';
		const hash1 = await hashPassword(password);
		const hash2 = await hashPassword(password);

		expect(hash1).not.toBe(hash2);
		expect(await verifyPassword(password, hash1)).toBe(true);
		expect(await verifyPassword(password, hash2)).toBe(true);
	});

	it('returns false for malformed hashes', async () => {
		expect(await verifyPassword('password', '')).toBe(false);
		expect(await verifyPassword('password', 'invalid:hash')).toBe(false);
		expect(await verifyPassword('password', 'pbkdf2:sha256:notanumber:salt:hash')).toBe(false);
	});

	it('validates password strength', () => {
		expect(validatePasswordStrength('')).toBe('Password must be at least 8 characters long.');
		expect(validatePasswordStrength('short')).toBe('Password must be at least 8 characters long.');
		expect(validatePasswordStrength('1234567')).toBe(
			'Password must be at least 8 characters long.'
		);
		expect(validatePasswordStrength('12345678')).toBeNull();
		expect(validatePasswordStrength('securePassword123!')).toBeNull();
	});
});
