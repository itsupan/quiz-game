import { assertAdmin } from '$lib/server/auth/guards';
import type { LayoutServerLoad } from './$types';

/**
 * Supplies the administrator to the shell.
 *
 * The authorization gate itself is in `src/hooks.server.ts`, not here: SvelteKit runs a
 * form action before this load, so a guard in this file would let a POST through. The
 * `assertAdmin` call below is a type narrowing and a second line of defence, not the
 * control.
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	const user = locals.user;

	assertAdmin(user);

	return {
		admin: {
			displayName: user.displayName,
			email: user.email
		}
	};
};
