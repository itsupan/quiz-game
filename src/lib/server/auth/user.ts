import { eq } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';

import { users } from '$lib/server/db/schema';
import type { User } from '$lib/server/db/schema';

/**
 * The slice of a user every request carries. Deliberately narrow: nothing here is
 * sensitive if it reaches a page's serialised data, and the internal `id` is used only
 * on the server, for `audit_logs.actor_user_id`.
 */
export type AuthUser = Pick<User, 'id' | 'publicId' | 'email' | 'displayName' | 'role' | 'status'>;

/** The account the dev stub signs in as when no `dev_user` cookie says otherwise. */
const DEFAULT_DEV_EMAIL = 'admin@example.com';

/** Lets a test become a different seeded user. Never read outside the dev stub. */
const DEV_USER_COOKIE = 'dev_user';

/**
 * Populates `locals.user`.
 *
 * TEMPORARY. Google sign-in is issue #9; until it lands there is no session cookie to
 * validate, so this resolves an identity from configuration instead. It is fenced by
 * `ALLOW_DEV_AUTH`, which is declared at the TOP LEVEL of wrangler.jsonc only — named
 * environments do not inherit vars, so staging and production get `null` here and a 403
 * from every admin route. `wrangler-config.spec.ts` fails if anyone adds it to one.
 *
 * When #9 lands, this function is replaced by session-cookie validation and nothing
 * else moves: `assertAdmin` and every route already work against whatever it returns.
 */
export async function resolveUser(event: RequestEvent): Promise<AuthUser | null> {
	// Compared to the exact string, not merely truthy: this flag is the only thing
	// keeping /admin shut on a deployed worker, and `ALLOW_DEV_AUTH: "false"` is the
	// obvious way somebody would try to turn it off.
	if (event.platform?.env?.ALLOW_DEV_AUTH !== 'true') {
		return null;
	}

	const requested = event.cookies.get(DEV_USER_COOKIE);

	// A real row, not a fabricated object, so audit entries reference a real user.
	const [found] = await event.locals.db
		.select({
			id: users.id,
			publicId: users.publicId,
			email: users.email,
			displayName: users.displayName,
			role: users.role,
			status: users.status
		})
		.from(users)
		.where(requested ? eq(users.publicId, requested) : eq(users.email, DEFAULT_DEV_EMAIL))
		.limit(1);

	return found ?? null;
}
