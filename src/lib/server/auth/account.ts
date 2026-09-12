import { eq } from 'drizzle-orm';

import type { Database } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import type { WriteResult } from '$lib/domain/write-result';
import { hashPassword, validatePasswordStrength, verifyPassword } from './password';

/** Whether there is a password to change — false for an account that only ever used Google. */
export async function hasPassword(db: Database, userId: number): Promise<boolean> {
	const [found] = await db
		.select({ passwordHash: users.passwordHash })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	return found?.passwordHash != null;
}

/** A learner editing their own name — same floor as `registerUser`, no ceiling worth enforcing. */
export async function updateDisplayName(
	db: Database,
	userId: number,
	displayName: string
): Promise<WriteResult<string>> {
	const trimmed = displayName.trim();

	if (trimmed.length < 1) {
		return { ok: false, message: 'Please provide your name.' };
	}

	if (trimmed.length > 100) {
		return { ok: false, message: 'Name must be 100 characters or fewer.' };
	}

	await db.update(users).set({ displayName: trimmed }).where(eq(users.id, userId));

	return { ok: true, value: trimmed };
}

/**
 * A learner changing their own password, from the account settings page rather than a
 * reset link — so the current password stands in for the identity check a reset email
 * would otherwise provide.
 */
export async function changePassword(
	db: Database,
	userId: number,
	currentPassword: string,
	newPassword: string
): Promise<WriteResult<void>> {
	const [found] = await db
		.select({ passwordHash: users.passwordHash })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	if (!found?.passwordHash) {
		return {
			ok: false,
			message: 'This account signs in with Google and has no password to change.'
		};
	}

	const valid = await verifyPassword(currentPassword, found.passwordHash);
	if (!valid) {
		return { ok: false, message: 'Current password is incorrect.' };
	}

	const strengthError = validatePasswordStrength(newPassword);
	if (strengthError) {
		return { ok: false, message: strengthError };
	}

	const newHash = await hashPassword(newPassword);
	await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, userId));

	return { ok: true, value: undefined };
}
