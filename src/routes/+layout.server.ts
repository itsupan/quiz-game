import type { LayoutServerLoad } from './$types';

/**
 * The signed-in user, for the site header.
 *
 * Deliberately narrow: a display name and a role are all the header needs. The email
 * address and the internal id stay on the server.
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		user: locals.user ? { displayName: locals.user.displayName, role: locals.user.role } : null
	};
};
