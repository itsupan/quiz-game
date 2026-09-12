import type { User } from '$lib/server/db/schema';

/**
 * The slice of a user every request carries.
 *
 * Deliberately narrow. It lives in its own module so `session.ts` and `user.ts` can both
 * refer to it without importing each other.
 */
export type AuthUser = Pick<
	User,
	'id' | 'publicId' | 'email' | 'displayName' | 'avatarUrl' | 'role' | 'status'
>;
